from decimal import Decimal

from django.contrib.auth.models import User
from rest_framework import serializers

from .models import PendingOrder, PendingOrderItem, Product, Sale, SaleItem, Section, UserProfile


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
            return ["dashboard", "pos", "inventory", "sales", "reports", "accounts"]
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
            "total",
            "cashier_name",
            "items",
        ]

    def get_cashier_name(self, obj: Sale) -> str:
        if not obj.user:
            return "Unknown"
        return obj.user.first_name or obj.user.username


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
