from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("core", "0008_incidentreport_attachment_remove_status"),
    ]

    operations = [
        migrations.AddField(
            model_name="sale",
            name="discount_amount",
            field=models.DecimalField(decimal_places=2, default=0, max_digits=12),
        ),
        migrations.AddField(
            model_name="sale",
            name="senior_discount_applied",
            field=models.BooleanField(default=False),
        ),
    ]
