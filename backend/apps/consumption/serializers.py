from rest_framework import serializers
from .models import OrderItemBOM, MarkerReport, TrimMeasurement


class OrderItemBOMSerializer(serializers.ModelSerializer):
    material_name = serializers.CharField(
        source='template_bom_item.material_name',
        read_only=True
    )

    class Meta:
        model = OrderItemBOM
        fields = '__all__'


class MarkerReportSerializer(serializers.ModelSerializer):
    class Meta:
        model = MarkerReport
        fields = '__all__'


class TrimMeasurementSerializer(serializers.ModelSerializer):
    class Meta:
        model = TrimMeasurement
        fields = '__all__'
