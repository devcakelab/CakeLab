from decimal import Decimal
import re

from django.contrib.auth.models import User
from rest_framework import serializers

from .models import IncidentReport, PendingOrder, PendingOrderItem, Product, Sale, SaleItem, Section, UserProfile


class UserProfileSerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField()
    role = serializers.SerializerMethodField()
    allowed_tabs = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ["id", "username", "full_name", "role", "allowed_tabs"]

    def get_full_name(self, obj: User) -> str:
        return obj.first_name or obj.get_full_name() or obj.username

    def get_role(self, obj: User) -> str:
        if hasattr(obj, "profile") and obj.profile:
            return obj.profile.role
        if obj.is_superuser:
            return UserProfile.ROLE_ADMIN
        return UserProfile.ROLE_CASHIER

    def get_allowed_tabs(self, obj: User) -> list[str]:
        role = self.get_role(obj)
        if role == UserProfile.ROLE_ADMIN:
            return ["dashboard", "pos", "inventory", "sales", "reports", "incident_reports", "accounts"]
        if role == UserProfile.ROLE_CASHIER:
            return ["pos", "sales"]
        return ["pos"]


class RegisterSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=150)
    password = serializers.CharField(min_length=6, max_length=128)
    full_name = serializers.CharField(max_length=150)
    role = serializers.ChoiceField(
        choices=[UserProfile.ROLE_ADMIN, UserProfile.ROLE_CASHIER, UserProfile.ROLE_GUEST],
        required=False,
        default=UserProfile.ROLE_CASHIER,
    )

    def validate_password(self, value: str) -> str:
        if any(char in value for char in ['$', '"', "'", ","]):
            raise serializers.ValidationError("Password cannot contain $, \", ', or comma (,).")
        has_upper = bool(re.search(r"[A-Z]", value))
        has_lower = bool(re.search(r"[a-z]", value))
        has_number = bool(re.search(r"\d", value))
        has_symbol = bool(re.search(r"[^A-Za-z0-9]", value))
        if not (has_upper and has_lower and has_number and has_symbol):
            raise serializers.ValidationError(
                "Password must include at least 1 uppercase letter, 1 lowercase letter, 1 number, and 1 symbol."
            )
        return value


class SectionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Section
        fields = ["id", "name"]


class ProductSerializer(serializers.ModelSerializer):
    section_name = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = [
            "id",
            "sku",
            "name",
            "price",
            "stock",
            "low_stock_threshold",
            "is_ingredient",
            "is_archived",
            "section",
            "section_name",
        ]

    def get_section_name(self, obj: Product) -> str:
        return obj.section.name if obj.section else "General"


class CheckoutItemSerializer(serializers.Serializer):
    product_id = serializers.IntegerField(min_value=1)
    quantity = serializers.IntegerField(min_value=1)


class CheckoutSerializer(serializers.Serializer):
    customer_name = serializers.CharField(required=False, allow_blank=True, max_length=200)
    order_type = serializers.ChoiceField(choices=["walk_in", "online"], required=False, default="walk_in")
    senior_discount_applied = serializers.BooleanField(required=False, default=False)
    items = CheckoutItemSerializer(many=True)


class SaleItemSerializer(serializers.ModelSerializer):
    sku = serializers.CharField(source="product.sku", read_only=True)
    name = serializers.CharField(source="product.name", read_only=True)

    class Meta:
        model = SaleItem
        fields = ["sku", "name", "quantity", "unit_price", "line_total"]


class SaleSerializer(serializers.ModelSerializer):
    cashier_name = serializers.SerializerMethodField()
    items = SaleItemSerializer(many=True, read_only=True)

    class Meta:
        model = Sale
        fields = [
            "id",
            "created_at",
            "customer_name",
            "senior_discount_applied",
            "discount_amount",
            "total",
            "cashier_name",
            "items",
        ]

    def get_cashier_name(self, obj: Sale) -> str:
        if not obj.user:
            return "Unknown"
        return obj.user.first_name or obj.user.username


class IncidentReportSerializer(serializers.ModelSerializer):
    sale_id = serializers.IntegerField(write_only=True)
    attachment = serializers.FileField(required=False, allow_null=True)
    sale_number = serializers.IntegerField(source="sale.id", read_only=True)
    sale_customer = serializers.CharField(source="sale.customer_name", read_only=True)
    sale_total = serializers.DecimalField(source="sale.total", max_digits=12, decimal_places=2, read_only=True)
    sale_created_at = serializers.DateTimeField(source="sale.created_at", read_only=True)
    created_by_name = serializers.SerializerMethodField()
    attachment_url = serializers.SerializerMethodField()

    class Meta:
        model = IncidentReport
        fields = [
            "id",
            "sale_id",
            "sale_number",
            "sale_customer",
            "sale_total",
            "sale_created_at",
            "details",
            "attachment",
            "attachment_url",
            "created_by_name",
            "created_at",
            "updated_at",
        ]
        extra_kwargs = {
            "attachment": {"required": False, "allow_null": True},
        }

    def get_created_by_name(self, obj: IncidentReport) -> str:
        if not obj.created_by:
            return "Unknown"
        return obj.created_by.first_name or obj.created_by.username

    def get_attachment_url(self, obj: IncidentReport) -> str | None:
        if not obj.attachment:
            return None
        request = self.context.get("request")
        if request:
            return request.build_absolute_uri(obj.attachment.url)
        return obj.attachment.url

    def validate_attachment(self, value):
        if value is None:
            return value
        content_type = getattr(value, "content_type", "") or ""
        if not content_type.startswith("image/"):
            raise serializers.ValidationError("Attachment must be an image file.")
        return value

    def create(self, validated_data):
        sale_id = validated_data.pop("sale_id")
        try:
            sale = Sale.objects.get(id=sale_id)
        except Sale.DoesNotExist as exc:
            raise serializers.ValidationError({"sale_id": "Sale not found."}) from exc
        return IncidentReport.objects.create(sale=sale, **validated_data)


class PendingOrderItemSerializer(serializers.ModelSerializer):
    sku = serializers.CharField(source="product.sku", read_only=True)
    name = serializers.CharField(source="product.name", read_only=True)
    unit_price = serializers.DecimalField(source="product.price", max_digits=10, decimal_places=2, read_only=True)
    line_total = serializers.SerializerMethodField()

    class Meta:
        model = PendingOrderItem
        fields = ["sku", "name", "quantity", "unit_price", "line_total"]

    def get_line_total(self, obj: PendingOrderItem) -> float:
        return to_money(obj.product.price * obj.quantity)


class PendingOrderSerializer(serializers.ModelSerializer):
    created_by_name = serializers.SerializerMethodField()
    approved_by_name = serializers.SerializerMethodField()
    items = PendingOrderItemSerializer(many=True, read_only=True)
    total = serializers.SerializerMethodField()

    class Meta:
        model = PendingOrder
        fields = [
            "id",
            "created_at",
            "customer_name",
            "order_type",
            "status",
            "created_by_name",
            "approved_by_name",
            "approved_sale",
            "items",
            "total",
        ]

    def get_created_by_name(self, obj: PendingOrder) -> str:
        if not obj.created_by:
            return "Unknown"
        return obj.created_by.first_name or obj.created_by.username

    def get_approved_by_name(self, obj: PendingOrder) -> str:
        if not obj.approved_by:
            return ""
        return obj.approved_by.first_name or obj.approved_by.username

    def get_total(self, obj: PendingOrder) -> float:
        return to_money(
            sum((item.product.price * item.quantity for item in obj.items.all()), start=Decimal("0.00"))
        )


def to_money(value: Decimal) -> float:
    return round(float(value), 2)
