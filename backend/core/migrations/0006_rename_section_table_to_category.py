from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("core", "0005_user_roles_and_pending_orders"),
    ]

    operations = [
        migrations.AlterModelTable(
            name="section",
            table="core_category",
        ),
    ]

