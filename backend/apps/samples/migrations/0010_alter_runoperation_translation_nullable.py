# Fix NOT NULL constraint on RunOperation translation fields
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('samples', '0009_add_runoperation_translation_fields'),
    ]

    operations = [
        migrations.AlterField(
            model_name='runoperation',
            name='description_zh',
            field=models.TextField(
                blank=True,
                default='',
                help_text='Chinese translation of operation description'
            ),
        ),
        migrations.AlterField(
            model_name='runoperation',
            name='machine_type_zh',
            field=models.CharField(
                blank=True,
                default='',
                max_length=150,
                help_text='Chinese translation of machine type'
            ),
        ),
        migrations.AlterField(
            model_name='runoperation',
            name='stitch_type_zh',
            field=models.CharField(
                blank=True,
                default='',
                max_length=100,
                help_text='Chinese translation of stitch type'
            ),
        ),
    ]
