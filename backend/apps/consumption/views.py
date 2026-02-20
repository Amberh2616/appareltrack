from rest_framework import viewsets
from .models import OrderItemBOM, MarkerReport, TrimMeasurement
from .serializers import (
    OrderItemBOMSerializer,
    MarkerReportSerializer,
    TrimMeasurementSerializer
)


class OrderItemBOMViewSet(viewsets.ModelViewSet):
    queryset = OrderItemBOM.objects.all()
    serializer_class = OrderItemBOMSerializer


class MarkerReportViewSet(viewsets.ModelViewSet):
    queryset = MarkerReport.objects.all()
    serializer_class = MarkerReportSerializer


class TrimMeasurementViewSet(viewsets.ModelViewSet):
    queryset = TrimMeasurement.objects.all()
    serializer_class = TrimMeasurementSerializer
