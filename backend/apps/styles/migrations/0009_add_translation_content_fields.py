# Generated manually - Add Chinese translation fields
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('styles', '0008_backfill_organization'),
    ]

    operations = [
        # BOMItem - Add Chinese translation fields
        migrations.AddField(
            model_name='bomitem',
            name='material_name_zh',
            field=models.CharField(
                blank=True,
                max_length=200,
                help_text='Chinese translation of material name'
            ),
        ),
        migrations.AddField(
            model_name='bomitem',
            name='description_zh',
            field=models.TextField(
                blank=True,
                help_text='Chinese translation of description/notes'
            ),
        ),
        migrations.AddField(
            model_name='bomitem',
            name='translated_at',
            field=models.DateTimeField(
                blank=True,
                null=True,
                help_text='When this item was translated'
            ),
        ),
        migrations.AddField(
            model_name='bomitem',
            name='translated_by',
            field=models.CharField(
                blank=True,
                max_length=50,
                help_text='Who/what translated this (e.g., ai:claude-sonnet, human:username)'
            ),
        ),

        # ConstructionStep - Add Chinese translation fields
        migrations.AddField(
            model_name='constructionstep',
            name='description_zh',
            field=models.TextField(
                blank=True,
                help_text='Chinese translation of description'
            ),
        ),
        migrations.AddField(
            model_name='constructionstep',
            name='stitch_type_zh',
            field=models.CharField(
                blank=True,
                max_length=100,
                help_text='Chinese translation of stitch type'
            ),
        ),
        migrations.AddField(
            model_name='constructionstep',
            name='machine_type_zh',
            field=models.CharField(
                blank=True,
                max_length=150,
                help_text='Chinese translation of machine type'
            ),
        ),
        migrations.AddField(
            model_name='constructionstep',
            name='translated_at',
            field=models.DateTimeField(
                blank=True,
                null=True,
                help_text='When this step was translated'
            ),
        ),
        migrations.AddField(
            model_name='constructionstep',
            name='translated_by',
            field=models.CharField(
                blank=True,
                max_length=50,
                help_text='Who/what translated this'
            ),
        ),

        # Measurement - Add Chinese translation field
        migrations.AddField(
            model_name='measurement',
            name='point_name_zh',
            field=models.CharField(
                blank=True,
                max_length=100,
                help_text='Chinese translation of measurement point name'
            ),
        ),
        migrations.AddField(
            model_name='measurement',
            name='translated_at',
            field=models.DateTimeField(
                blank=True,
                null=True,
            ),
        ),
        migrations.AddField(
            model_name='measurement',
            name='translated_by',
            field=models.CharField(
                blank=True,
                max_length=50,
            ),
        ),
    ]
