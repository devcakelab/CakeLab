from __future__ import annotations

import os
import sqlite3
import hmac
import hashlib
import smtplib
import ssl
import re
from datetime import datetime
from io import BytesIO
from functools import wraps
from email.message import EmailMessage

from flask import Flask, abort, jsonify, redirect, render_template, request, send_file, session, url_for
from werkzeug.security import check_password_hash, generate_password_hash

from db import init_db
from services import (
    CartItem,
    add_product,
    add_section,
    checkout,
    create_user,
    dashboard_insights,
    dashboard_stats,
    delete_section,
    delete_product_by_id,
    find_product_by_sku,
    get_product_by_id,
    get_sale_receipt,
    get_user_by_username,
    list_products,
    list_sections,
    list_sales,
    low_stock_products,
    sales_report,
    sales_summary,
    seed_sample_desserts,
    update_section,
    update_product,
    user_performance_metrics,
)


app = Flask(__name__)
app.secret_key = os.environ.get("FLASK_SECRET_KEY", "change-this-secret-key")

DEFAULT_ADMIN_USERNAME = "admin"
DEFAULT_ADMIN_PASSWORD = "admin123"
DEFAULT_ADMIN_FULLNAME = "System Admin"
LOGIN_BG_IMAGE = r"C:\Users\legio\.cursor\projects\C-Users-legio-AppData-Local-Temp-1b59fb65-4775-46fe-96c4-3a095ba4e9a0\assets\c__Users_legio_AppData_Roaming_Cursor_User_workspaceStorage_1773648292526_images_image-4650a07b-7fdf-403f-bde5-472f1c3ebd79.png"
LOGIN_ART_IMAGE = r"C:\Users\legio\.cursor\projects\C-Users-legio-AppData-Local-Temp-1b59fb65-4775-46fe-96c4-3a095ba4e9a0\assets\c__Users_legio_AppData_Roaming_Cursor_User_workspaceStorage_1773648292526_images_image-a46adcdc-9167-4059-b477-97250b4d4c36.png"
LOGIN_HERO_IMAGE = r"C:\Users\legio\.cursor\projects\C-Users-legio-AppData-Local-Temp-1b59fb65-4775-46fe-96c4-3a095ba4e9a0\assets\c__Users_legio_AppData_Roaming_Cursor_User_workspaceStorage_1773648292526_images_image-317e3461-7255-491d-bd48-784aa7fc5d5f.png"
LOGIN_LOGO_IMAGE = r"C:\Users\legio\.cursor\projects\C-Users-legio-AppData-Local-Temp-1b59fb65-4775-46fe-96c4-3a095ba4e9a0\assets\c__Users_legio_AppData_Roaming_Cursor_User_workspaceStorage_1773648292526_images_d7240dcf-ccc7-41e9-8120-b89033e4f6a4-6fdfab0b-39a5-453d-8597-796a6acbfa89.png"
SIGNATURE_IMAGE = r"C:\Users\legio\.cursor\projects\C-Users-legio-AppData-Local-Temp-1b59fb65-4775-46fe-96c4-3a095ba4e9a0\assets\c__Users_legio_AppData_Roaming_Cursor_User_workspaceStorage_1773648292526_images_image-4b5e1490-c904-45c1-88b8-aefb02694599.png"


def bootstrap() -> None:
    init_db()
    seed_sample_desserts()
    if not get_user_by_username(DEFAULT_ADMIN_USERNAME):
        create_user(
            username=DEFAULT_ADMIN_USERNAME,
            password_hash=generate_password_hash(DEFAULT_ADMIN_PASSWORD),
            full_name=DEFAULT_ADMIN_FULLNAME,
        )


def login_required(view_func):
    @wraps(view_func)
    def wrapped(*args, **kwargs):
        if not session.get("logged_in"):
            return redirect(url_for("login"))
        return view_func(*args, **kwargs)

    return wrapped


def nav_context(active_page: str, message: str = "", status: str = "info") -> dict:
    return {
        "message": message,
        "status": status,
        "username": session.get("username", DEFAULT_ADMIN_USERNAME),
        "full_name": session.get("full_name", DEFAULT_ADMIN_FULLNAME),
        "active_page": active_page,
    }


def _auto_sku_from_name(name: str) -> str:
    base = "".join(ch for ch in name.upper() if ch.isalnum())[:8] or "PRODUCT"
    candidate = base
    idx = 1
    while find_product_by_sku(candidate):
        idx += 1
        candidate = f"{base}{idx}"
    return candidate


def _dessert_icon(name: str) -> str:
    n = name.lower()
    if "chocolate" in n or "brownie" in n:
        return "🍫"
    if "cheesecake" in n:
        return "🍰"
    if "cupcake" in n:
        return "🧁"
    if "pudding" in n:
        return "🍮"
    if "croissant" in n or "kwasan" in n or "quasant" in n:
        return "🥐"
    if "mango" in n:
        return "🥭"
    if "bread" in n:
        return "🍞"
    return "🍩"


def _get_cart() -> list[dict]:
    return session.get("cart", [])


def _save_cart(cart: list[dict]) -> None:
    session["cart"] = cart
    session.modified = True


def _build_cart_view() -> tuple[list[dict], float]:
    cart = _get_cart()
    detailed: list[dict] = []
    total = 0.0
    for row in cart:
        product = get_product_by_id(int(row["product_id"]))
        if not product:
            continue
        qty = int(row["quantity"])
        line_total = qty * float(product["price"])
        total += line_total
        detailed.append(
            {
                "product_id": product["id"],
                "sku": product["sku"],
                "name": product["name"],
                "icon": _dessert_icon(product["name"]),
                "quantity": qty,
                "price": product["price"],
                "stock": product["stock"],
                "line_total": line_total,
            }
        )
    return detailed, total


def _build_receipt_auth_code(receipt: dict, authorized_by: str) -> str:
    sale = receipt["sale"]
    payload = "|".join(
        [
            str(sale["id"]),
            str(sale["created_at"]),
            f"{float(sale['total']):.2f}",
            str(sale.get("customer_name", "")),
            str(sale["cashier_name"]),
            authorized_by,
        ]
    )
    digest = hmac.new(
        app.secret_key.encode("utf-8"),
        payload.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()
    return digest[:20].upper()


def _signature_image_bytes() -> bytes | None:
    if not os.path.isfile(SIGNATURE_IMAGE):
        return None
    try:
        import importlib

        pil_image = importlib.import_module("PIL.Image")
        image = pil_image.open(SIGNATURE_IMAGE).convert("RGBA")
        pixels = image.getdata()
        transparent = []
        for r, g, b, a in pixels:
            if r > 242 and g > 242 and b > 242:
                transparent.append((255, 255, 255, 0))
            else:
                transparent.append((r, g, b, a))
        image.putdata(transparent)

        bbox = image.getbbox()
        if bbox:
            image = image.crop(bbox)
        image.thumbnail((220, 70))

        out = BytesIO()
        image.save(out, format="PNG")
        out.seek(0)
        return out.getvalue()
    except ModuleNotFoundError:
        return None


def _receipt_pdf_bytes(receipt: dict, authorized_by: str) -> bytes:
    # Import lazily so app still runs even before dependency install.
    import importlib

    pagesizes = importlib.import_module("reportlab.lib.pagesizes")
    pdfgen_canvas = importlib.import_module("reportlab.pdfgen.canvas")
    reportlab_utils = importlib.import_module("reportlab.lib.utils")
    A4 = pagesizes.A4
    canvas = pdfgen_canvas
    image_reader_cls = reportlab_utils.ImageReader

    buffer = BytesIO()
    pdf = canvas.Canvas(buffer, pagesize=A4)
    width, height = A4

    left = 50
    top = height - 50
    line_h = 16

    def draw_line(text: str, x: float = left, size: int = 10, bold: bool = False) -> None:
        nonlocal top
        if top < 60:
            pdf.showPage()
            top = height - 50
        font_name = "Helvetica-Bold" if bold else "Helvetica"
        pdf.setFont(font_name, size)
        pdf.drawString(x, top, text)
        top -= line_h

    sale = receipt["sale"]
    items = receipt["items"]
    auth_code = _build_receipt_auth_code(receipt, authorized_by)
    signed_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    draw_line(f"CakeLab Receipt #{sale['id']}", size=15, bold=True)
    draw_line(f"Date: {sale['created_at']}")
    draw_line(f"Customer: {sale.get('customer_name', 'Walk-in Customer')}")
    draw_line(f"Cashier: {sale['cashier_name']}")
    top -= 4

    # Table header
    pdf.setFont("Helvetica-Bold", 10)
    pdf.drawString(left, top, "SKU")
    pdf.drawString(left + 90, top, "Product")
    pdf.drawString(left + 320, top, "Qty")
    pdf.drawString(left + 360, top, "Unit Price")
    pdf.drawString(left + 450, top, "Line Total")
    top -= 8
    pdf.line(left, top, width - 50, top)
    top -= 14

    for item in items:
        if top < 70:
            pdf.showPage()
            top = height - 50
        pdf.setFont("Helvetica", 10)
        name = str(item["name"])
        if len(name) > 34:
            name = name[:31] + "..."
        pdf.drawString(left, top, str(item["sku"]))
        pdf.drawString(left + 90, top, name)
        pdf.drawRightString(left + 350, top, str(item["quantity"]))
        pdf.drawRightString(left + 445, top, f"PHP {float(item['unit_price']):.2f}")
        pdf.drawRightString(width - 50, top, f"PHP {float(item['line_total']):.2f}")
        top -= 15

    top -= 6
    pdf.line(left, top, width - 50, top)
    top -= 18
    pdf.setFont("Helvetica-Bold", 12)
    pdf.drawRightString(width - 50, top, f"Grand Total: PHP {float(sale['total']):.2f}")
    top -= 24
    pdf.setFont("Helvetica", 10)
    pdf.drawString(left, top, "Thank you for your purchase.")
    top -= 22
    pdf.setFont("Helvetica-Bold", 10)
    pdf.drawString(left, top, "E-Signature Authorization")
    top -= 16
    pdf.setFont("Helvetica", 10)
    pdf.drawString(left, top, f"Authorized by: {authorized_by}")
    top -= 14
    signature_data = _signature_image_bytes()
    if signature_data:
        signature_reader = image_reader_cls(BytesIO(signature_data))
        img_w, img_h = signature_reader.getSize()
        scale = min(180 / img_w, 52 / img_h)
        draw_w = img_w * scale
        draw_h = img_h * scale
        pdf.drawString(left, top, "E-signature:")
        pdf.drawImage(
            signature_reader,
            left + 74,
            top - draw_h + 10,
            width=draw_w,
            height=draw_h,
            mask="auto",
        )
        top -= draw_h + 2
    else:
        pdf.drawString(left, top, f"E-signature: /s/ {authorized_by}")
        top -= 14
    pdf.drawString(left, top, f"Signed at: {signed_at}")
    top -= 14
    pdf.drawString(left, top, f"Authorization code: {auth_code}")

    pdf.save()
    buffer.seek(0)
    return buffer.getvalue()


def _is_valid_email(value: str) -> bool:
    return bool(re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", value))


def _send_receipt_email(recipient: str, sale_id: int, pdf_bytes: bytes) -> tuple[bool, str]:
    smtp_host = os.environ.get("SMTP_HOST", "").strip()
    smtp_port = int(os.environ.get("SMTP_PORT", "587").strip() or "587")
    smtp_user = os.environ.get("SMTP_USER", "").strip()
    smtp_pass = os.environ.get("SMTP_PASS", "").strip()
    smtp_from = os.environ.get("SMTP_FROM", smtp_user).strip()
    smtp_use_tls = os.environ.get("SMTP_USE_TLS", "true").strip().lower() in {"1", "true", "yes", "on"}

    if not (smtp_host and smtp_port and smtp_user and smtp_pass and smtp_from):
        return False, "Email sender is not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM."

    msg = EmailMessage()
    msg["Subject"] = f"CakeLab Receipt #{sale_id}"
    msg["From"] = smtp_from
    msg["To"] = recipient
    msg.set_content(
        f"Attached is your CakeLab receipt #{sale_id} in PDF format.\n\n"
        "Thank you for your purchase."
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
            with smtplib.SMTP_SSL(smtp_host, smtp_port, timeout=20, context=ssl.create_default_context()) as server:
                server.login(smtp_user, smtp_pass)
                server.send_message(msg)
    except Exception as exc:
        return False, f"Failed to send email: {exc}"
    return True, "Receipt PDF sent successfully."


@app.get("/login")
def login():
    bootstrap()
    if session.get("logged_in"):
        return redirect(url_for("dashboard_page"))
    return render_template(
        "login.html",
        message=request.args.get("message", ""),
        status=request.args.get("status", "info"),
        body_class="login-page",
    )


@app.get("/login-assets/<asset_name>")
def login_asset(asset_name: str):
    asset_map = {
        "bakery-bg": LOGIN_BG_IMAGE,
        "bakery-art": LOGIN_ART_IMAGE,
        "bakery-hero": LOGIN_HERO_IMAGE,
        "bakery-logo": LOGIN_LOGO_IMAGE,
    }
    path = asset_map.get(asset_name)
    if not path or not os.path.isfile(path):
        return abort(404)
    return send_file(path)


@app.post("/login")
def login_submit():
    bootstrap()
    username = request.form.get("username", "").strip().lower()
    password = request.form.get("password", "").strip()
    user = get_user_by_username(username)
    if not user or not check_password_hash(user["password_hash"], password):
        return redirect(
            url_for("login", status="error", message="Invalid username or password.")
        )

    session["logged_in"] = True
    session["user_id"] = user["id"]
    session["username"] = user["username"]
    session["full_name"] = user["full_name"]
    session["cart"] = []
    return redirect(url_for("dashboard_page"))


@app.get("/register")
def register():
    bootstrap()
    if session.get("logged_in"):
        return redirect(url_for("dashboard_page"))
    return render_template(
        "register.html",
        message=request.args.get("message", ""),
        status=request.args.get("status", "info"),
    )


@app.post("/register")
def register_submit():
    bootstrap()
    username = request.form.get("username", "").strip().lower()
    full_name = request.form.get("full_name", "").strip()
    password = request.form.get("password", "").strip()
    confirm_password = request.form.get("confirm_password", "").strip()

    if not username or not full_name or not password:
        return redirect(url_for("register", status="error", message="All fields are required."))
    if len(password) < 6:
        return redirect(
            url_for("register", status="error", message="Password must be at least 6 characters.")
        )
    if password != confirm_password:
        return redirect(url_for("register", status="error", message="Passwords do not match."))

    try:
        create_user(
            username=username,
            password_hash=generate_password_hash(password),
            full_name=full_name,
        )
    except sqlite3.IntegrityError:
        return redirect(url_for("register", status="error", message="Username already exists."))

    return redirect(
        url_for("login", status="success", message="Registration successful. Please login.")
    )


@app.get("/logout")
def logout():
    session.clear()
    return redirect(url_for("login", status="success", message="Logged out successfully."))


@app.get("/")
def home():
    bootstrap()
    if session.get("logged_in"):
        return redirect(url_for("dashboard_page"))
    return redirect(url_for("login"))


@app.get("/dashboard")
@login_required
def dashboard_page():
    bootstrap()
    stats = dashboard_stats()
    insights = dashboard_insights()
    lows = low_stock_products()
    return render_template(
        "dashboard.html",
        stats=stats,
        insights=insights,
        low_stock=lows,
        **nav_context(
            "dashboard",
            message=request.args.get("message", ""),
            status=request.args.get("status", "info"),
        ),
    )


@app.get("/api/dashboard-stats")
@login_required
def dashboard_stats_api():
    return jsonify(dashboard_stats())


@app.get("/api/dashboard-data")
@login_required
def dashboard_data_api():
    return jsonify({"stats": dashboard_stats(), "insights": dashboard_insights()})


@app.get("/pos")
@login_required
def pos_page():
    bootstrap()
    cart_items, cart_subtotal = _build_cart_view()
    tax_rate = 0.0
    tax_amount = 0.0
    cart_total = round(cart_subtotal, 2)
    products = list_products()
    sections = list_sections()
    for p in products:
        p["icon"] = _dessert_icon(p["name"])
    return render_template(
        "pos.html",
        products=products,
        sections=sections,
        cart_items=cart_items,
        cart_subtotal=cart_subtotal,
        tax_rate=tax_rate,
        tax_amount=tax_amount,
        cart_total=cart_total,
        **nav_context(
            "pos",
            message=request.args.get("message", ""),
            status=request.args.get("status", "info"),
        ),
    )


@app.post("/pos/sections/add")
@login_required
def pos_section_add():
    name = request.form.get("name", "").strip()
    if not name:
        return redirect(url_for("pos_page", status="error", message="Section name is required."))
    try:
        add_section(name)
    except sqlite3.IntegrityError:
        return redirect(url_for("pos_page", status="error", message="Section already exists."))
    return redirect(url_for("pos_page", status="success", message=f"Added section {name}."))


@app.post("/pos/sections/edit")
@login_required
def pos_section_edit():
    section_id_raw = request.form.get("section_id", "0").strip()
    name = request.form.get("name", "").strip()
    try:
        section_id = int(section_id_raw)
        if section_id <= 0:
            raise ValueError
    except ValueError:
        return redirect(url_for("pos_page", status="error", message="Invalid section id."))
    if not name:
        return redirect(url_for("pos_page", status="error", message="New section name is required."))
    try:
        ok = update_section(section_id, name)
    except sqlite3.IntegrityError:
        return redirect(url_for("pos_page", status="error", message="Section name already exists."))
    if not ok:
        return redirect(url_for("pos_page", status="error", message="Section not found."))
    return redirect(url_for("pos_page", status="success", message="Section updated."))


@app.post("/pos/sections/delete")
@login_required
def pos_section_delete():
    section_id_raw = request.form.get("section_id", "0").strip()
    try:
        section_id = int(section_id_raw)
        if section_id <= 0:
            raise ValueError
    except ValueError:
        return redirect(url_for("pos_page", status="error", message="Invalid section id."))
    try:
        delete_section(section_id)
    except ValueError as exc:
        return redirect(url_for("pos_page", status="error", message=str(exc)))
    return redirect(url_for("pos_page", status="success", message="Section deleted."))


@app.post("/pos/cart/add")
@login_required
def pos_add_to_cart():
    sku = request.form.get("sku", "").strip().upper()
    quantity_raw = request.form.get("quantity", "0").strip()
    product = find_product_by_sku(sku)
    if not product:
        return redirect(url_for("pos_page", status="error", message=f"SKU {sku} not found."))
    try:
        quantity = int(quantity_raw)
        if quantity <= 0:
            raise ValueError
    except ValueError:
        return redirect(url_for("pos_page", status="error", message="Invalid quantity."))

    cart = _get_cart()
    for row in cart:
        if int(row["product_id"]) == product["id"]:
            if int(row["quantity"]) + quantity > int(product["stock"]):
                return redirect(
                    url_for(
                        "pos_page",
                        status="error",
                        message=f"Insufficient stock for {sku}.",
                    )
                )
            row["quantity"] = int(row["quantity"]) + quantity
            _save_cart(cart)
            return redirect(url_for("pos_page", status="success", message="Cart updated."))

    if quantity > int(product["stock"]):
        return redirect(url_for("pos_page", status="error", message=f"Insufficient stock for {sku}."))

    cart.append({"product_id": product["id"], "quantity": quantity})
    _save_cart(cart)
    return redirect(url_for("pos_page", status="success", message="Item added to cart."))


@app.post("/pos/cart/remove")
@login_required
def pos_remove_from_cart():
    product_id_raw = request.form.get("product_id", "0").strip()
    try:
        product_id = int(product_id_raw)
    except ValueError:
        return redirect(url_for("pos_page", status="error", message="Invalid cart item."))

    cart = [row for row in _get_cart() if int(row["product_id"]) != product_id]
    _save_cart(cart)
    return redirect(url_for("pos_page", status="success", message="Item removed from cart."))


@app.post("/pos/cart/adjust")
@login_required
def pos_adjust_cart():
    product_id_raw = request.form.get("product_id", "0").strip()
    delta_raw = request.form.get("delta", "0").strip()
    try:
        product_id = int(product_id_raw)
        delta = int(delta_raw)
    except ValueError:
        return redirect(url_for("pos_page", status="error", message="Invalid cart adjustment."))

    product = get_product_by_id(product_id)
    if not product:
        return redirect(url_for("pos_page", status="error", message="Product no longer exists."))

    cart = _get_cart()
    for idx, row in enumerate(cart):
        if int(row["product_id"]) != product_id:
            continue
        new_qty = int(row["quantity"]) + delta
        if new_qty <= 0:
            cart.pop(idx)
            _save_cart(cart)
            return redirect(url_for("pos_page", status="success", message="Item removed from cart."))
        if new_qty > int(product["stock"]):
            return redirect(
                url_for("pos_page", status="error", message=f"Only {product['stock']} in stock.")
            )
        row["quantity"] = new_qty
        _save_cart(cart)
        return redirect(url_for("pos_page", status="success", message="Cart updated."))

    return redirect(url_for("pos_page", status="error", message="Item not found in cart."))


@app.post("/pos/cart/clear")
@login_required
def pos_clear_cart():
    _save_cart([])
    return redirect(url_for("pos_page", status="success", message="Cart cleared."))


@app.post("/pos/checkout")
@login_required
def pos_checkout():
    cart_view, _ = _build_cart_view()
    if not cart_view:
        return redirect(url_for("pos_page", status="error", message="Cart is empty."))

    items = [
        CartItem(
            product_id=row["product_id"],
            sku=row["sku"],
            name=row["name"],
            quantity=row["quantity"],
            unit_price=row["price"],
        )
        for row in cart_view
    ]
    customer_name = request.form.get("customer_name", "").strip()
    try:
        sale_id = checkout(
            items,
            user_id=session.get("user_id"),
            customer_name=customer_name,
        )
    except ValueError as exc:
        return redirect(url_for("pos_page", status="error", message=str(exc)))

    _save_cart([])
    return redirect(
        url_for(
            "receipt_page",
            sale_id=sale_id,
            status="success",
            message=f"Checkout complete. Receipt #{sale_id}.",
        )
    )


@app.get("/inventory")
@login_required
def inventory_page():
    bootstrap()
    products = list_products()
    sections = list_sections()
    lows = low_stock_products()
    return render_template(
        "inventory.html",
        products=products,
        sections=sections,
        low_stock=lows,
        edit_product_id=request.args.get("edit_id", ""),
        **nav_context(
            "inventory",
            message=request.args.get("message", ""),
            status=request.args.get("status", "info"),
        ),
    )


@app.post("/inventory/add")
@login_required
def inventory_add():
    name = request.form.get("name", "").strip()
    price_raw = request.form.get("price", "0").strip()
    stock_raw = request.form.get("stock", "0").strip()
    threshold_raw = request.form.get("low_stock_threshold", "10").strip()
    section_id_raw = request.form.get("section_id", "").strip()
    if not name:
        return redirect(url_for("inventory_page", status="error", message="Product name is required."))
    try:
        price = float(price_raw)
        stock = int(stock_raw)
        threshold = int(threshold_raw)
        section_id = int(section_id_raw) if section_id_raw else None
        if price < 0 or stock < 0 or threshold < 0:
            raise ValueError
    except ValueError:
        return redirect(url_for("inventory_page", status="error", message="Invalid product values."))

    sku = _auto_sku_from_name(name)
    try:
        add_product(sku, name, price, stock, threshold, section_id=section_id)
    except sqlite3.IntegrityError:
        return redirect(url_for("inventory_page", status="error", message="Failed to add product."))
    return redirect(url_for("inventory_page", status="success", message=f"Added product {name}."))


@app.post("/inventory/update")
@login_required
def inventory_update():
    product_id_raw = request.form.get("product_id", "0").strip()
    name = request.form.get("name", "").strip()
    price_raw = request.form.get("price", "0").strip()
    stock_raw = request.form.get("stock", "0").strip()
    threshold_raw = request.form.get("low_stock_threshold", "10").strip()
    section_id_raw = request.form.get("section_id", "").strip()
    try:
        product_id = int(product_id_raw)
        price = float(price_raw)
        stock = int(stock_raw)
        threshold = int(threshold_raw)
        section_id = int(section_id_raw) if section_id_raw else None
        if product_id <= 0 or price < 0 or stock < 0 or threshold < 0:
            raise ValueError
    except ValueError:
        return redirect(url_for("inventory_page", status="error", message="Invalid update values."))

    existing = get_product_by_id(product_id)
    if not existing:
        return redirect(url_for("inventory_page", status="error", message="Product not found."))

    try:
        ok = update_product(
            product_id,
            existing["sku"],
            name,
            price,
            stock,
            threshold,
            section_id=section_id,
        )
    except sqlite3.IntegrityError:
        return redirect(url_for("inventory_page", status="error", message="SKU already exists."))
    if not ok:
        return redirect(url_for("inventory_page", status="error", message="Product not found."))
    return redirect(url_for("inventory_page", status="success", message="Product updated."))


@app.post("/inventory/delete")
@login_required
def inventory_delete():
    product_id_raw = request.form.get("product_id", "0").strip()
    try:
        product_id = int(product_id_raw)
    except ValueError:
        return redirect(url_for("inventory_page", status="error", message="Invalid product id."))
    if not delete_product_by_id(product_id):
        return redirect(url_for("inventory_page", status="error", message="Product not found."))
    return redirect(url_for("inventory_page", status="success", message="Product deleted."))


@app.get("/sales")
@login_required
def sales_page():
    bootstrap()
    period = request.args.get("period", "daily").lower()
    if period not in {"daily", "weekly", "monthly"}:
        period = "daily"
    return render_template(
        "sales.html",
        summary=sales_summary(),
        sales=list_sales(),
        report=sales_report(period),
        period=period,
        performance=user_performance_metrics(),
        **nav_context(
            "sales",
            message=request.args.get("message", ""),
            status=request.args.get("status", "info"),
        ),
    )


@app.get("/sales/<int:sale_id>/receipt")
@login_required
def receipt_page(sale_id: int):
    receipt = get_sale_receipt(sale_id)
    if not receipt:
        return redirect(url_for("sales_page", status="error", message="Receipt not found."))
    return render_template(
        "receipt.html",
        receipt=receipt,
        **nav_context(
            "sales",
            message=request.args.get("message", ""),
            status=request.args.get("status", "info"),
        ),
    )


@app.get("/sales/<int:sale_id>/receipt/pdf")
@login_required
def receipt_pdf(sale_id: int):
    receipt = get_sale_receipt(sale_id)
    if not receipt:
        return redirect(url_for("sales_page", status="error", message="Receipt not found."))
    authorized_by = session.get("full_name", "System Admin")

    try:
        payload = _receipt_pdf_bytes(receipt, authorized_by=authorized_by)
    except ModuleNotFoundError:
        return redirect(
            url_for(
                "receipt_page",
                sale_id=sale_id,
                status="error",
                message="PDF export dependency missing. Install reportlab first.",
            )
        )

    return send_file(
        BytesIO(payload),
        mimetype="application/pdf",
        as_attachment=True,
        download_name=f"receipt-{sale_id}.pdf",
    )


@app.post("/sales/<int:sale_id>/receipt/email")
@login_required
def receipt_email(sale_id: int):
    recipient = request.form.get("email", "").strip()
    if not _is_valid_email(recipient):
        return redirect(
            url_for(
                "receipt_page",
                sale_id=sale_id,
                status="error",
                message="Please enter a valid email address.",
            )
        )

    receipt = get_sale_receipt(sale_id)
    if not receipt:
        return redirect(url_for("sales_page", status="error", message="Receipt not found."))

    authorized_by = session.get("full_name", "System Admin")
    try:
        payload = _receipt_pdf_bytes(receipt, authorized_by=authorized_by)
    except ModuleNotFoundError:
        return redirect(
            url_for(
                "receipt_page",
                sale_id=sale_id,
                status="error",
                message="PDF export dependency missing. Install reportlab and Pillow first.",
            )
        )

    ok, info = _send_receipt_email(recipient=recipient, sale_id=sale_id, pdf_bytes=payload)
    return redirect(
        url_for(
            "receipt_page",
            sale_id=sale_id,
            status="success" if ok else "error",
            message=info,
        )
    )


if __name__ == "__main__":
    bootstrap()
    app.run(debug=True)
