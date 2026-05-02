from django.conf import settings
from django.db import models


class UserProfile(models.Model):
    ROLE_ADMIN = "admin"
    ROLE_CASHIER = "cashier"
    ROLE_GUEST = "guest"
    ROLE_CHOICES = [
        (ROLE_ADMIN, "System Admin"),
        (ROLE_CASHIER, "Cashier"),
        (ROLE_GUEST, "Guest"),
    ]

    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="profile")
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default=ROLE_CASHIER)

    def __str__(self) -> str:
        return f"{self.user.username} ({self.role})"


class Section(models.Model):
    name = models.CharField(max_length=120, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "core_category"
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name


class Product(models.Model):
    sku = models.CharField(max_length=60, unique=True)
    name = models.CharField(max_length=200)
    price = models.DecimalField(max_digits=10, decimal_places=2)
    stock = models.IntegerField(default=0)
    low_stock_threshold = models.IntegerField(default=10)
    is_ingredient = models.BooleanField(default=False)
    is_archived = models.BooleanField(default=False)
    section = models.ForeignKey(
        Section,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="products",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["name"]

    def __str__(self) -> str:
        return f"{self.sku} - {self.name}"


class Sale(models.Model):
    ORDER_TYPE_WALK_IN = "walk_in"
    ORDER_TYPE_ONLINE = "online"
    ORDER_TYPE_CHOICES = [
        (ORDER_TYPE_WALK_IN, "Walk-in"),
        (ORDER_TYPE_ONLINE, "Online"),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="sales",
    )
    customer_name = models.CharField(max_length=200, default="Walk-in Customer")
    order_type = models.CharField(max_length=20, choices=ORDER_TYPE_CHOICES, default=ORDER_TYPE_WALK_IN)
    senior_discount_applied = models.BooleanField(default=False)
    discount_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    total = models.DecimalField(max_digits=12, decimal_places=2)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-id"]


class SaleItem(models.Model):
    sale = models.ForeignKey(Sale, on_delete=models.CASCADE, related_name="items")
    product = models.ForeignKey(Product, on_delete=models.PROTECT, related_name="sale_items")
    quantity = models.PositiveIntegerField()
    unit_price = models.DecimalField(max_digits=10, decimal_places=2)
    line_total = models.DecimalField(max_digits=12, decimal_places=2)


class PendingOrder(models.Model):
    STATUS_PENDING = "pending"
    STATUS_APPROVED = "approved"
    STATUS_REJECTED = "rejected"
    STATUS_CHOICES = [
        (STATUS_PENDING, "Pending"),
        (STATUS_APPROVED, "Approved"),
        (STATUS_REJECTED, "Rejected"),
    ]

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="created_pending_orders",
    )
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="approved_pending_orders",
    )
    customer_name = models.CharField(max_length=200, default="Walk-in Customer")
    order_type = models.CharField(max_length=20, choices=Sale.ORDER_TYPE_CHOICES, default=Sale.ORDER_TYPE_WALK_IN)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_PENDING)
    approved_sale = models.ForeignKey(
        Sale,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="source_pending_orders",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    approved_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-id"]


class PendingOrderItem(models.Model):
    pending_order = models.ForeignKey(PendingOrder, on_delete=models.CASCADE, related_name="items")
    product = models.ForeignKey(Product, on_delete=models.PROTECT, related_name="pending_order_items")
    quantity = models.PositiveIntegerField()


class IncidentReport(models.Model):
    sale = models.ForeignKey(Sale, on_delete=models.CASCADE, related_name="incident_reports")
    details = models.TextField()
    attachment = models.ImageField(upload_to="incident_reports/", null=True, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="incident_reports",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
