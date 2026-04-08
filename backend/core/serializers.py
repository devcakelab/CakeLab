from decimal import Decimal

from django.contrib.auth.models import User
from rest_framework import serializers

from .models import Product, Sale, SaleItem, Section


class UserProfileSerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ["id", "username", "full_name"]

    def get_full_name(self, obj: User) -> str:
        return obj.first_name or obj.get_full_name() or obj.username


class RegisterSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=150)
    password = serializers.CharField(min_length=6, max_length=128)
    full_name = serializers.CharField(max_length=150)


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


def to_money(value: Decimal) -> float:
    return round(float(value), 2)
