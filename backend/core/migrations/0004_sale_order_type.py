from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("core", "0003_product_is_archived"),
    ]

    operations = [
        migrations.AddField(
            model_name="sale",
            name="order_type",
            field=models.CharField(default="walk_in", max_length=20),
        ),
    ]

