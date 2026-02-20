# Generated manually - Add Chinese translation fields to RunOperation
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('samples', '0008_samplecostestimate_organization_and_more'),
    ]

    operations = [
        # RunOperation - Add Chinese translation fields
        migrations.AddField(
            model_name='runoperation',
            name='description_zh',
            field=models.TextField(
                blank=True,
                help_text='Chinese translation of operation description'
            ),
        ),
        migrations.AddField(
            model_name='runoperation',
            name='machine_type_zh',
            field=models.CharField(
                blank=True,
                max_length=150,
                help_text='Chinese translation of machine type'
            ),
        ),
        migrations.AddField(
            model_name='runoperation',
            name='stitch_type_zh',
            field=models.CharField(
                blank=True,
                max_length=100,
                help_text='Chinese translation of stitch type'
            ),
        ),
    ]
