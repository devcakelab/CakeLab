from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("core", "0007_incidentreport"),
    ]

    operations = [
        migrations.RemoveField(
            model_name="incidentreport",
            name="status",
        ),
        migrations.AddField(
            model_name="incidentreport",
            name="attachment",
            field=models.ImageField(blank=True, null=True, upload_to="incident_reports/"),
        ),
    ]
