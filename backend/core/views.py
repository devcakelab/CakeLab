from collections import defaultdict
from datetime import datetime, time, timedelta
from decimal import Decimal
from functools import wraps
from io import BytesIO
import hashlib
import hmac
import os
from pathlib import Path
import re
import smtplib
import ssl
from email.message import EmailMessage

from django.conf import settings
from django.contrib.auth.models import User
from django.db import transaction
from django.db.models import Count, F, Sum
from django.db.models.deletion import ProtectedError
from django.http import HttpRequest, HttpResponse
from django.utils.dateparse import parse_date
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response

from .models import Product, Sale, SaleItem, Section
from .serializers import (
    CheckoutSerializer,
    ProductSerializer,
    RegisterSerializer,
    SaleSerializer,
    SectionSerializer,
    UserProfileSerializer,
    to_money,
)


def _parse_env_file(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    if not path.exists():
        return values
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        values[key.strip()] = value.strip().strip('"').strip("'")
    return values


def _runtime_env_value(key: str, default: str = "") -> str:
    env_values: dict[str, str] = {}
    # Backward compatible: support both legacy Gmail.env and clearer smtp.env.
    for file_name in (".env", "smtp.env", "Gmail.env"):
        env_values.update(_parse_env_file(settings.BASE_DIR.parent / file_name))
        env_values.update(_parse_env_file(settings.BASE_DIR / file_name))
    if key in env_values and env_values[key] != "":
        return env_values[key]
    return os.environ.get(key, default)


@api_view(["GET"])
def api_root_view(request):
    return Response(
        {
            "name": "CakeLab API",
            "status": "ok",
            "endpoints": [
                "/api/auth/register",
                "/api/auth/login",
                "/api/auth/logout",
                "/api/auth/me",
                "/api/auth/reset-password",
                "/api/sections",
                "/api/products",
                "/api/products/<id>",
                "/api/products/low-stock",
                "/api/checkout",
                "/api/sales",
                "/api/sales/<id>",
                "/api/sales/<id>/receipt.pdf",
                "/api/sales/<id>/receipt/email",
                "/api/dashboard/stats",
                "/api/dashboard/insights",
                "/api/reports?period=daily|weekly|monthly|quarterly|yearly",
                "/api/reports/details?period=weekly&period_label=2026-W15",
                "/api/users/performance",
            ],
        }
    )


def _session_user(request: HttpRequest) -> User | None:
    user_id = request.session.get("user_id")
    if not user_id:
        return None
    try:
        return User.objects.get(id=user_id)
    except User.DoesNotExist:
        return None


def login_required_api(func):
    @wraps(func)
    def wrapper(request, *args, **kwargs):
        if not _session_user(request):
            return Response({"detail": "Authentication required."}, status=status.HTTP_401_UNAUTHORIZED)
        return func(request, *args, **kwargs)

    return wrapper


def _authorized_by(request: HttpRequest, sale: Sale) -> str:
    actor = _session_user(request)
    if actor:
        return actor.first_name or actor.username
    if sale.user:
        return sale.user.first_name or sale.user.username
    return "System"


def _build_receipt_auth_code(sale: Sale, authorized_by: str) -> str:
    payload = "|".join(
        [
            str(sale.id),
            str(sale.created_at),
            f"{float(sale.total):.2f}",
            str(sale.customer_name or ""),
            str(sale.user.username if sale.user else "unknown"),
            authorized_by,
        ]
    )
    digest = hmac.new(
        settings.SECRET_KEY.encode("utf-8"),
        payload.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()
    return digest[:20].upper()


def _signature_image_path() -> str | None:
    direct = os.environ.get("SIGNATURE_IMAGE", "").strip()
    if direct and os.path.isfile(direct):
        return direct
    fallbacks = [
        os.path.join(settings.BASE_DIR, "assets", "signature.png"),
        os.path.join(settings.BASE_DIR.parent, "sig.jpg"),
        os.path.join(settings.BASE_DIR.parent, "sig.jpeg"),
        os.path.join(settings.BASE_DIR.parent, "sig.png"),
    ]
    for fallback in fallbacks:
        if os.path.isfile(fallback):
            return fallback
    return None


def _is_valid_email(value: str) -> bool:
    return bool(re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", value or ""))


def _build_receipt_pdf_bytes(sale: Sale, authorized_by: str) -> bytes:
    from reportlab.lib.pagesizes import A4
    from reportlab.lib import colors
    from reportlab.pdfgen import canvas

    buffer = BytesIO()
    pdf = canvas.Canvas(buffer, pagesize=A4)
    width, height = A4
    y = height - 54
    left = 50
    right = width - 50
    auth_code = _build_receipt_auth_code(sale, authorized_by)
    cashier_name = sale.user.first_name if sale.user and sale.user.first_name else (sale.user.username if sale.user else "Unknown")

    pdf.setTitle(f"Receipt {sale.id}")
    pdf.setFillColor(colors.HexColor("#2B1F47"))
    pdf.roundRect(left, y - 14, right - left, 34, 8, stroke=0, fill=1)
    pdf.setFillColor(colors.white)
    pdf.setFont("Helvetica-Bold", 15)
    pdf.drawString(left + 12, y, f"CakeLab Receipt #{sale.id}")
    pdf.setFont("Helvetica", 9)
    pdf.drawRightString(right - 12, y + 1, sale.created_at.strftime("%Y-%m-%d %H:%M:%S"))
    y -= 32

    pdf.setStrokeColor(colors.HexColor("#DDCFF5"))
    pdf.setLineWidth(1)
    pdf.roundRect(left, y - 48, right - left, 46, 6, stroke=1, fill=0)
    pdf.setFillColor(colors.HexColor("#3A2B5E"))
    pdf.setFont("Helvetica-Bold", 10)
    pdf.drawString(left + 10, y - 14, "Cashier")
    pdf.drawString(left + 205, y - 14, "Customer")
    pdf.setFillColor(colors.black)
    pdf.setFont("Helvetica", 10)
    pdf.drawString(left + 10, y - 30, cashier_name)
    pdf.drawString(left + 205, y - 30, sale.customer_name or "Walk-in Customer")
    y -= 64

    # Table columns (A4 ~595pt wide): no SKU on receipt; product column uses full left margin.
    col_product_x = left + 6
    col_qty_right = left + 320
    col_unit_right = left + 410
    col_line_right = right - 10
    product_clip_w = col_qty_right - col_product_x - 10

    def draw_table_header(pos_y: float) -> float:
        pdf.setFillColor(colors.HexColor("#F7F2FF"))
        pdf.roundRect(left, pos_y - 16, right - left, 18, 4, stroke=0, fill=1)
        pdf.setFillColor(colors.HexColor("#3A2B5E"))
        pdf.setFont("Helvetica-Bold", 9)
        pdf.drawString(col_product_x, pos_y - 10, "Product")
        pdf.drawRightString(col_qty_right, pos_y - 10, "Qty")
        pdf.drawRightString(col_unit_right, pos_y - 10, "Unit Price")
        pdf.drawRightString(col_line_right, pos_y - 10, "Line Total")
        pdf.setFillColor(colors.black)
        return pos_y - 24

    y = draw_table_header(y)
    pdf.setFont("Helvetica", 10)
    row_height = 18
    row_num = 0
    for item in sale.items.all():
        if y < 190:
            pdf.showPage()
            y = height - 56
            y = draw_table_header(y)
            pdf.setFont("Helvetica", 10)

        if row_num % 2 == 0:
            pdf.setFillColor(colors.HexColor("#FCFAFF"))
            pdf.rect(left, y - 12, right - left, row_height, stroke=0, fill=1)
            pdf.setFillColor(colors.black)

        raw_name = str(item.product.name or "")
        max_chars = max(12, int(product_clip_w / 5.2))
        name = raw_name if len(raw_name) <= max_chars else f"{raw_name[: max(0, max_chars - 3)]}..."
        pdf.drawString(col_product_x, y, name)
        pdf.drawRightString(col_qty_right, y, str(item.quantity))
        pdf.drawRightString(col_unit_right, y, f"PHP {to_money(item.unit_price):.2f}")
        pdf.drawRightString(col_line_right, y, f"PHP {to_money(item.line_total):.2f}")
        y -= row_height
        row_num += 1

    y -= 8
    pdf.setStrokeColor(colors.HexColor("#DDCFF5"))
    pdf.line(left, y, right, y)
    y -= 26

    total_box_width = 220
    total_box_height = 30
    total_box_x = right - total_box_width
    pdf.setFillColor(colors.HexColor("#2B1F47"))
    pdf.roundRect(total_box_x, y - 8, total_box_width, total_box_height, 6, stroke=0, fill=1)
    pdf.setFillColor(colors.white)
    pdf.setFont("Helvetica-Bold", 13)
    pdf.drawString(total_box_x + 12, y + 5, "Grand Total")
    pdf.drawRightString(right - 12, y + 5, f"PHP {to_money(sale.total):.2f}")
    y -= 34

    pdf.setFillColor(colors.HexColor("#4B5563"))
    pdf.setFont("Helvetica-Oblique", 9)
    pdf.drawString(left, y, "Thank you for your purchase.")
    y -= 22

    pdf.setFillColor(colors.HexColor("#3A2B5E"))
    pdf.setFont("Helvetica-Bold", 10)
    pdf.drawString(left, y, "E-Signature Authorization")
    y -= 16
    pdf.setFillColor(colors.black)
    pdf.setFont("Helvetica", 10)
    pdf.drawString(left, y, f"Authorized by: {authorized_by}")
    y -= 18

    signature_path = _signature_image_path()
    sig_img_w, sig_img_h = 150.0, 36.0
    if signature_path:
        label_y = y
        pdf.drawString(left, label_y, "E-signature:")
        # Image lower-left: place entire graphic below the label (PDF y increases upward).
        img_bottom = label_y - 12 - sig_img_h
        pdf.drawImage(
            signature_path,
            left,
            img_bottom,
            width=sig_img_w,
            height=sig_img_h,
            preserveAspectRatio=True,
            mask="auto",
        )
        y = img_bottom - 14
    else:
        pdf.drawString(left, y, f"E-signature: /s/ {authorized_by}")
        y -= 18

    signed_at = timezone.localtime().strftime("%Y-%m-%d %H:%M:%S")
    pdf.drawString(left, y, f"Signed at: {signed_at}")
    y -= 14
    pdf.setFont("Helvetica-Bold", 9)
    pdf.setFillColor(colors.HexColor("#4B5563"))
    pdf.drawString(left, y, f"Authorization code: {auth_code}")

    pdf.showPage()
    pdf.save()
    buffer.seek(0)
    return buffer.getvalue()


def _send_receipt_email(recipient: str, sale_id: int, pdf_bytes: bytes) -> tuple[bool, str]:
    smtp_host = _runtime_env_value("SMTP_HOST", "").strip()
    smtp_port = int(_runtime_env_value("SMTP_PORT", "587").strip() or "587")
    smtp_user = _runtime_env_value("SMTP_USER", "").strip()
    # Gmail app passwords are often copied with spaces; normalize safely.
    smtp_pass = re.sub(r"\s+", "", _runtime_env_value("SMTP_PASS", ""))
    smtp_from = _runtime_env_value("SMTP_FROM", smtp_user).strip()
    smtp_use_tls = _runtime_env_value("SMTP_USE_TLS", "true").strip().lower() in {"1", "true", "yes", "on"}

    if not (smtp_host and smtp_port and smtp_user and smtp_pass and smtp_from):
        return (
            False,
            "Email is not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, and SMTP_FROM.",
        )

    msg = EmailMessage()
    msg["Subject"] = f"CakeLab Receipt #{sale_id}"
    msg["From"] = smtp_from
    msg["To"] = recipient
    msg.set_content(
        f"Hello,\n\nAttached is your CakeLab receipt #{sale_id} in PDF format.\n\nThank you."
    )
    msg.add_attachment(
        pdf_bytes,
        maintype="application",
        subtype="pdf",
        filename=f"receipt-{sale_id}.pdf",
    )

    try:
        if smtp_use_tls:
            with smtplib.SMTP(smtp_host, smtp_port, timeout=20) as server:
                server.starttls(context=ssl.create_default_context())
                server.login(smtp_user, smtp_pass)
                server.send_message(msg)
        else:
            with smtplib.SMTP_SSL(
                smtp_host,
                smtp_port,
                timeout=20,
                context=ssl.create_default_context(),
            ) as server:
                server.login(smtp_user, smtp_pass)
                server.send_message(msg)
    except smtplib.SMTPAuthenticationError:
        return (
            False,
            "Failed to send email: Gmail rejected credentials. Recreate an App Password, "
            "set SMTP_USER to the same Gmail account, and update SMTP_PASS.",
        )
    except Exception as exc:
        return False, f"Failed to send email: {exc}"

    return True, "Receipt emailed successfully."


@csrf_exempt
@api_view(["POST"])
def register_view(request):
    serializer = RegisterSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    payload = serializer.validated_data
    username = payload["username"].strip().lower()
    if User.objects.filter(username=username).exists():
        return Response({"detail": "Username already exists."}, status=status.HTTP_400_BAD_REQUEST)
    user = User.objects.create_user(
        username=username,
        password=payload["password"],
        first_name=payload["full_name"].strip(),
    )
    return Response(UserProfileSerializer(user).data, status=status.HTTP_201_CREATED)


@csrf_exempt
@api_view(["POST"])
def login_view(request):
    username = str(request.data.get("username", "")).strip().lower()
    password = str(request.data.get("password", ""))
    try:
        user = User.objects.get(username=username)
    except User.DoesNotExist:
        return Response({"detail": "Invalid username or password."}, status=status.HTTP_401_UNAUTHORIZED)
    if not user.check_password(password):
        return Response({"detail": "Invalid username or password."}, status=status.HTTP_401_UNAUTHORIZED)
    request.session["user_id"] = user.id
    request.session.modified = True
    return Response({"user": UserProfileSerializer(user).data})


@csrf_exempt
@api_view(["POST"])
def logout_view(request):
    request.session.flush()
    return Response(status=status.HTTP_204_NO_CONTENT)


@csrf_exempt
@api_view(["POST"])
def reset_password_view(request):
    username = str(request.data.get("username", "")).strip().lower()
    new_password = str(request.data.get("new_password", ""))
    if not username:
        return Response({"detail": "Username is required."}, status=status.HTTP_400_BAD_REQUEST)
    if len(new_password) < 6:
        return Response(
            {"detail": "New password must be at least 6 characters."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    try:
        user = User.objects.get(username=username)
    except User.DoesNotExist:
        return Response({"detail": "User not found."}, status=status.HTTP_404_NOT_FOUND)

    user.set_password(new_password)
    user.save(update_fields=["password"])
    return Response({"detail": "Password reset successful. You can now log in."})


@api_view(["GET"])
def me_view(request):
    user = _session_user(request)
    if not user:
        return Response({"detail": "Not logged in."}, status=status.HTTP_401_UNAUTHORIZED)
    return Response(UserProfileSerializer(user).data)


@csrf_exempt
@api_view(["GET", "POST"])
def sections_view(request):
    if request.method == "GET":
        return Response(SectionSerializer(Section.objects.all(), many=True).data)
    if not _session_user(request):
        return Response({"detail": "Authentication required."}, status=status.HTTP_401_UNAUTHORIZED)
    name = str(request.data.get("name", "")).strip()
    if not name:
        return Response({"detail": "Section name is required."}, status=status.HTTP_400_BAD_REQUEST)
    section = Section.objects.create(name=name)
    return Response(SectionSerializer(section).data, status=status.HTTP_201_CREATED)


@csrf_exempt
@api_view(["PUT", "DELETE"])
@login_required_api
def section_detail_view(request, section_id: int):
    try:
        section = Section.objects.get(id=section_id)
    except Section.DoesNotExist:
        return Response({"detail": "Section not found."}, status=status.HTTP_404_NOT_FOUND)

    if request.method == "PUT":
        name = str(request.data.get("name", "")).strip()
        if not name:
            return Response({"detail": "Section name is required."}, status=status.HTTP_400_BAD_REQUEST)
        section.name = name
        section.save(update_fields=["name"])
        return Response(SectionSerializer(section).data)

    if Product.objects.filter(section=section).exists():
        return Response(
            {"detail": "Cannot delete section with assigned products."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    if Section.objects.count() <= 1:
        return Response({"detail": "At least one section must remain."}, status=status.HTTP_400_BAD_REQUEST)
    section.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)


@csrf_exempt
@api_view(["GET", "POST"])
def products_view(request):
    if request.method == "GET":
        include_archived = str(request.query_params.get("include_archived", "0")).lower() in {"1", "true", "yes", "on"}
        queryset = Product.objects.select_related("section").all()
        if not include_archived:
            queryset = queryset.filter(is_archived=False)
        return Response(ProductSerializer(queryset, many=True).data)
    if not _session_user(request):
        return Response({"detail": "Authentication required."}, status=status.HTTP_401_UNAUTHORIZED)
    serializer = ProductSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    if serializer.validated_data.get("is_archived") is True:
        return Response({"detail": "Archived products cannot be created."}, status=status.HTTP_400_BAD_REQUEST)
    product = serializer.save()
    return Response(ProductSerializer(product).data, status=status.HTTP_201_CREATED)


@csrf_exempt
@api_view(["PUT", "DELETE"])
@login_required_api
def product_detail_view(request, product_id: int):
    try:
        product = Product.objects.get(id=product_id)
    except Product.DoesNotExist:
        return Response({"detail": "Product not found."}, status=status.HTTP_404_NOT_FOUND)
    if request.method == "DELETE":
        try:
          product.delete()
        except ProtectedError:
          return Response(
              {"detail": "Cannot delete product because it is referenced by sales history."},
              status=status.HTTP_400_BAD_REQUEST,
          )
        return Response(status=status.HTTP_204_NO_CONTENT)
    serializer = ProductSerializer(product, data=request.data, partial=True)
    serializer.is_valid(raise_exception=True)
    serializer.save()
    return Response(serializer.data)


@csrf_exempt
@api_view(["POST"])
@login_required_api
def checkout_view(request):
    serializer = CheckoutSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    payload = serializer.validated_data
    items = payload["items"]
    customer_name = payload.get("customer_name", "").strip() or "Walk-in Customer"
    order_type = str(payload.get("order_type", "walk_in")).strip() or "walk_in"
    user = _session_user(request)
    if not items:
        return Response({"detail": "Cart is empty."}, status=status.HTTP_400_BAD_REQUEST)

    with transaction.atomic():
        sale = Sale.objects.create(user=user, customer_name=customer_name, order_type=order_type, total=Decimal("0.00"))
        total = Decimal("0.00")
        for item in items:
            try:
                product = Product.objects.select_for_update().get(id=item["product_id"])
            except Product.DoesNotExist:
                return Response({"detail": "Product not found in checkout."}, status=status.HTTP_400_BAD_REQUEST)
            qty = int(item["quantity"])
            if product.stock < qty:
                return Response(
                    {"detail": f"Insufficient stock for {product.sku}. Available: {product.stock}"},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            unit_price = product.price
            line_total = unit_price * qty
            total += line_total
            SaleItem.objects.create(
                sale=sale,
                product=product,
                quantity=qty,
                unit_price=unit_price,
                line_total=line_total,
            )
            product.stock -= qty
            product.save(update_fields=["stock"])
        sale.total = total
        sale.save(update_fields=["total"])

    return Response({"sale_id": sale.id, "total": to_money(sale.total)}, status=status.HTTP_201_CREATED)


@api_view(["GET"])
@login_required_api
def sales_view(request):
    queryset = Sale.objects.select_related("user").prefetch_related("items__product").all()[:200]
    return Response(SaleSerializer(queryset, many=True).data)


@api_view(["GET"])
@login_required_api
def dashboard_stats_view(request):
    total_products = Product.objects.count()
    low_stock_count = Product.objects.filter(stock__lte=F("low_stock_threshold")).count()
    sales_agg = Sale.objects.aggregate(total_sales=Count("id"), gross_revenue=Sum("total"))
    now = timezone.localtime()
    today_sales = Sale.objects.filter(created_at__date=now.date())
    month_sales = Sale.objects.filter(
        created_at__year=now.year,
        created_at__month=now.month,
    )
    return Response(
        {
            "total_products": total_products,
            "low_stock_count": low_stock_count,
            "total_sales": sales_agg["total_sales"] or 0,
            "gross_revenue": to_money(sales_agg["gross_revenue"] or Decimal("0.00")),
            "today_sales": today_sales.count(),
            "today_revenue": to_money(today_sales.aggregate(total=Sum("total"))["total"] or Decimal("0.00")),
            "this_month_revenue": to_money(
                month_sales.aggregate(total=Sum("total"))["total"] or Decimal("0.00")
            ),
        }
    )


@api_view(["GET"])
@login_required_api
def low_stock_products_view(request):
    queryset = Product.objects.select_related("section").filter(stock__lte=F("low_stock_threshold"))
    return Response(ProductSerializer(queryset, many=True).data)


@api_view(["GET"])
@login_required_api
def sale_receipt_view(request, sale_id: int):
    try:
        sale = Sale.objects.select_related("user").prefetch_related("items__product").get(id=sale_id)
    except Sale.DoesNotExist:
        return Response({"detail": "Sale not found."}, status=status.HTTP_404_NOT_FOUND)
    data = SaleSerializer(sale).data
    return Response({"sale": data, "items": data["items"]})


@api_view(["GET"])
@login_required_api
def sale_receipt_pdf_view(request, sale_id: int):
    try:
        sale = Sale.objects.select_related("user").prefetch_related("items__product").get(id=sale_id)
    except Sale.DoesNotExist:
        return Response({"detail": "Sale not found."}, status=status.HTTP_404_NOT_FOUND)

    try:
        authorized_by = _authorized_by(request, sale)
        payload = _build_receipt_pdf_bytes(sale, authorized_by=authorized_by)
    except ModuleNotFoundError:
        return Response({"detail": "reportlab is not installed."}, status=status.HTTP_501_NOT_IMPLEMENTED)
    return HttpResponse(
        payload,
        content_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="receipt-{sale.id}.pdf"'},
    )


@csrf_exempt
@api_view(["POST"])
@login_required_api
def sale_receipt_email_view(request, sale_id: int):
    recipient = str(request.data.get("email", "")).strip()
    if not _is_valid_email(recipient):
        return Response({"detail": "Please provide a valid email address."}, status=status.HTTP_400_BAD_REQUEST)

    try:
        sale = Sale.objects.select_related("user").prefetch_related("items__product").get(id=sale_id)
    except Sale.DoesNotExist:
        return Response({"detail": "Sale not found."}, status=status.HTTP_404_NOT_FOUND)

    try:
        authorized_by = _authorized_by(request, sale)
        payload = _build_receipt_pdf_bytes(sale, authorized_by=authorized_by)
    except ModuleNotFoundError:
        return Response({"detail": "reportlab is not installed."}, status=status.HTTP_501_NOT_IMPLEMENTED)

    ok, info = _send_receipt_email(recipient=recipient, sale_id=sale_id, pdf_bytes=payload)
    if not ok:
        return Response({"detail": info}, status=status.HTTP_400_BAD_REQUEST)
    return Response({"detail": info})


def _period_bucket(dt_value, period: str, tzinfo=None) -> str:
    local = timezone.localtime(dt_value, tzinfo) if tzinfo is not None else timezone.localtime(dt_value)
    if period == "daily":
        return local.strftime("%Y-%m-%d")
    if period == "weekly":
        iso = local.isocalendar()
        return f"{iso.year}-W{iso.week:02d}"
    if period == "monthly":
        return local.strftime("%Y-%m")
    if period == "quarterly":
        quarter = ((local.month - 1) // 3) + 1
        return f"{local.year}-Q{quarter}"
    return str(local.year)


@api_view(["GET"])
@login_required_api
def sales_report_view(request):
    period = str(request.query_params.get("period", "daily")).lower()
    if period not in {"daily", "weekly", "monthly", "quarterly", "yearly"}:
        return Response({"detail": "Invalid period."}, status=status.HTTP_400_BAD_REQUEST)

    tzinfo = timezone.get_current_timezone()
    raw_offset = str(request.query_params.get("tz_offset_minutes", "")).strip()
    if raw_offset:
        try:
            tzinfo = timezone.get_fixed_timezone(-int(raw_offset))
        except ValueError:
            tzinfo = timezone.get_current_timezone()

    start_date = None
    end_date = None
    if period == "daily":
        raw_start = str(request.query_params.get("start_date", "")).strip()
        raw_end = str(request.query_params.get("end_date", "")).strip()
        raw_single = str(request.query_params.get("date", "")).strip()

        if raw_single and not (raw_start or raw_end):
            start_date = parse_date(raw_single)
            end_date = start_date
            if not start_date:
                return Response({"detail": "Invalid date. Use YYYY-MM-DD."}, status=status.HTTP_400_BAD_REQUEST)
        else:
            if raw_start:
                start_date = parse_date(raw_start)
                if not start_date:
                    return Response({"detail": "Invalid start_date. Use YYYY-MM-DD."}, status=status.HTTP_400_BAD_REQUEST)
            if raw_end:
                end_date = parse_date(raw_end)
                if not end_date:
                    return Response({"detail": "Invalid end_date. Use YYYY-MM-DD."}, status=status.HTTP_400_BAD_REQUEST)
            if start_date and end_date and start_date > end_date:
                return Response({"detail": "start_date must be before or equal to end_date."}, status=status.HTTP_400_BAD_REQUEST)

    grouped = defaultdict(lambda: {"sale_count": 0, "revenue": Decimal("0.00")})
    queryset = Sale.objects.all().only("created_at", "total")
    if period == "daily":
        if start_date:
            start_dt = timezone.make_aware(datetime.combine(start_date, time.min), tzinfo)
            queryset = queryset.filter(created_at__gte=start_dt)
        if end_date:
            # End boundary is exclusive next-day midnight in local timezone.
            end_exclusive_dt = timezone.make_aware(datetime.combine(end_date + timedelta(days=1), time.min), tzinfo)
            queryset = queryset.filter(created_at__lt=end_exclusive_dt)

    for sale in queryset:
        key = _period_bucket(sale.created_at, period, tzinfo=tzinfo)
        grouped[key]["sale_count"] += 1
        grouped[key]["revenue"] += sale.total

    rows = []
    for label in sorted(grouped.keys(), reverse=True)[:30]:
        rows.append(
            {
                "period_label": label,
                "sale_count": grouped[label]["sale_count"],
                "revenue": to_money(grouped[label]["revenue"]),
            }
        )
    return Response(rows)


def _period_bounds(period: str, label: str):
    if period == "daily":
        day = parse_date(label)
        if not day:
            return None, None
        return day, day + timedelta(days=1)

    if period == "weekly":
        match = re.fullmatch(r"(\d{4})-W(\d{2})", label)
        if not match:
            return None, None
        year = int(match.group(1))
        week = int(match.group(2))
        try:
            start = datetime.fromisocalendar(year, week, 1).date()
        except ValueError:
            return None, None
        return start, start + timedelta(days=7)

    if period == "monthly":
        match = re.fullmatch(r"(\d{4})-(\d{2})", label)
        if not match:
            return None, None
        year = int(match.group(1))
        month = int(match.group(2))
        if month < 1 or month > 12:
            return None, None
        start = datetime(year, month, 1).date()
        if month == 12:
            end = datetime(year + 1, 1, 1).date()
        else:
            end = datetime(year, month + 1, 1).date()
        return start, end

    if period == "quarterly":
        match = re.fullmatch(r"(\d{4})-Q([1-4])", label)
        if not match:
            return None, None
        year = int(match.group(1))
        quarter = int(match.group(2))
        start_month = ((quarter - 1) * 3) + 1
        start = datetime(year, start_month, 1).date()
        if quarter == 4:
            end = datetime(year + 1, 1, 1).date()
        else:
            end = datetime(year, start_month + 3, 1).date()
        return start, end

    if period == "yearly":
        match = re.fullmatch(r"\d{4}", label)
        if not match:
            return None, None
        year = int(label)
        start = datetime(year, 1, 1).date()
        end = datetime(year + 1, 1, 1).date()
        return start, end

    return None, None


@api_view(["GET"])
@login_required_api
def sales_report_detail_view(request):
    period = str(request.query_params.get("period", "daily")).lower()
    if period not in {"daily", "weekly", "monthly", "quarterly", "yearly"}:
        return Response({"detail": "Invalid period."}, status=status.HTTP_400_BAD_REQUEST)

    period_label = str(request.query_params.get("period_label", "")).strip()
    if not period_label:
        return Response({"detail": "period_label is required."}, status=status.HTTP_400_BAD_REQUEST)

    tzinfo = timezone.get_current_timezone()
    raw_offset = str(request.query_params.get("tz_offset_minutes", "")).strip()
    if raw_offset:
        try:
            tzinfo = timezone.get_fixed_timezone(-int(raw_offset))
        except ValueError:
            tzinfo = timezone.get_current_timezone()

    start_date, end_date = _period_bounds(period, period_label)
    if not start_date or not end_date:
        return Response({"detail": "Invalid period_label for selected period."}, status=status.HTTP_400_BAD_REQUEST)

    start_dt = timezone.make_aware(datetime.combine(start_date, time.min), tzinfo)
    end_dt = timezone.make_aware(datetime.combine(end_date, time.min), tzinfo)

    queryset = (
        Sale.objects.select_related("user")
        .prefetch_related("items__product")
        .filter(created_at__gte=start_dt, created_at__lt=end_dt)
        .order_by("-created_at")[:300]
    )
    return Response(SaleSerializer(queryset, many=True).data)


def _dessert_icon(name: str) -> str:
    lower = name.lower()
    if "brownie" in lower or "chocolate" in lower:
        return "cake"
    if "cheesecake" in lower or "cake" in lower:
        return "slice"
    if "cupcake" in lower:
        return "cupcake"
    if "pudding" in lower:
        return "pudding"
    if "croissant" in lower:
        return "croissant"
    if "mango" in lower:
        return "mango"
    return "dessert"


@api_view(["GET"])
@login_required_api
def dashboard_insights_view(request):
    top_rows = (
        SaleItem.objects.select_related("product")
        .values("product__name")
        .annotate(qty_sold=Sum("quantity"), revenue=Sum("line_total"))
        .order_by("-qty_sold", "-revenue")[:3]
    )

    week_grouped = defaultdict(Decimal)
    month_grouped = defaultdict(Decimal)
    weekday_grouped = {idx: Decimal("0.00") for idx in range(7)}
    for sale in Sale.objects.all().only("created_at", "total"):
        week_grouped[_period_bucket(sale.created_at, "weekly")] += sale.total
        month_grouped[_period_bucket(sale.created_at, "monthly")] += sale.total
        weekday_grouped[timezone.localtime(sale.created_at).weekday()] += sale.total

    weekly = [
        {"label": key, "value": to_money(value)}
        for key, value in sorted(week_grouped.items())[-5:]
    ]
    monthly = [
        {"label": key, "value": to_money(value)}
        for key, value in sorted(month_grouped.items())[-3:]
    ]
    weekday_labels = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    weekday_revenue = [
        {"label": weekday_labels[idx], "value": to_money(weekday_grouped[idx])}
        for idx in range(7)
    ]

    top_sellers = [
        {
            "name": row["product__name"],
            "icon": _dessert_icon(row["product__name"]),
            "qty_sold": int(row["qty_sold"] or 0),
            "revenue": to_money(row["revenue"] or Decimal("0.00")),
        }
        for row in top_rows
    ]
    return Response(
        {
            "top_sellers": top_sellers,
            "weekly": weekly,
            "monthly": monthly,
            "weekday_revenue": weekday_revenue,
        }
    )


@api_view(["GET"])
@login_required_api
def user_performance_view(request):
    rows = (
        User.objects.values("id", "username", "first_name")
        .annotate(sales_count=Count("sales"), revenue=Sum("sales__total"))
        .order_by("-revenue", "-sales_count")
    )
    data = [
        {
            "id": row["id"],
            "username": row["username"],
            "full_name": row["first_name"] or row["username"],
            "sales_count": int(row["sales_count"] or 0),
            "revenue": to_money(row["revenue"] or Decimal("0.00")),
        }
        for row in rows
    ]
    return Response(data)
