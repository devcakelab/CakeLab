from decimal import Decimal

from django.contrib.auth.models import User
from django.core.management.base import BaseCommand

from core.models import Product, Section

SAMPLE_DESSERTS = [
    ("DSRT-001", "Chocolate Cake Slice", Decimal("4.50"), 30, 10, "Section 3"),
    ("DSRT-002", "Cheesecake", Decimal("5.25"), 25, 10, "Section 3"),
    ("DSRT-003", "Brownie", Decimal("3.00"), 40, 15, "Section 3"),
    ("DSRT-004", "Strawberry Cupcake", Decimal("3.75"), 35, 12, "Section 3"),
    ("DSRT-005", "Mango Pudding", Decimal("4.00"), 20, 8, "Section 3"),
]


class Command(BaseCommand):
    help = "Seed default admin, sections, and sample products."

    def handle(self, *args, **options):
        for section_name in ["General", "Croissant", "Bread", "Section 3"]:
            Section.objects.get_or_create(name=section_name)

        section_map = {section.name: section for section in Section.objects.all()}
        for sku, name, price, stock, threshold, section_name in SAMPLE_DESSERTS:
            Product.objects.get_or_create(
                sku=sku,
                defaults={
                    "name": name,
                    "price": price,
                    "stock": stock,
                    "low_stock_threshold": threshold,
                    "section": section_map.get(section_name),
                },
            )

        if not User.objects.filter(username="admin").exists():
            User.objects.create_user(
                username="admin",
                password="admin123",
                first_name="System Admin",
            )

        self.stdout.write(self.style.SUCCESS("POS seed data ready."))
