from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from django.utils import timezone
from django.db.models import Sum, Count
from django.http import HttpResponse
from .models import Supplier, Material, PurchaseOrder, POLine
from .services.po_pdf_export import export_po_pdf
from .serializers import (
    SupplierSerializer,
    MaterialSerializer,
    PurchaseOrderSerializer,
    PurchaseOrderDetailSerializer,
    POLineSerializer
)


class SupplierViewSet(viewsets.ModelViewSet):
    queryset = Supplier.objects.all()
    serializer_class = SupplierSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['supplier_type', 'is_active']
    search_fields = ['name', 'supplier_code']

    def perform_create(self, serializer):
        # Auto-set organization from first available (demo mode)
        from apps.core.models import Organization
        org = Organization.objects.first()
        serializer.save(organization=org)


class MaterialViewSet(viewsets.ModelViewSet):
    queryset = Material.objects.select_related('supplier').all()
    serializer_class = MaterialSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['category', 'supplier', 'status', 'is_active']
    search_fields = ['article_no', 'name', 'name_zh', 'color']

    def perform_create(self, serializer):
        # Auto-set organization from first available (demo mode)
        from apps.core.models import Organization
        org = Organization.objects.first()
        serializer.save(organization=org)


class PurchaseOrderViewSet(viewsets.ModelViewSet):
    queryset = PurchaseOrder.objects.select_related('supplier').prefetch_related('lines').all()
    serializer_class = PurchaseOrderSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['status', 'po_type', 'supplier']
    search_fields = ['po_number', 'supplier__name']

    def perform_create(self, serializer):
        # Auto-set organization from first available (demo mode)
        from apps.core.models import Organization
        org = Organization.objects.first()
        serializer.save(organization=org)

    def get_serializer_class(self):
        if self.action == 'retrieve':
            return PurchaseOrderDetailSerializer
        return PurchaseOrderSerializer

    # P24: Send PO to supplier via email
    @action(detail=True, methods=['post'])
    def send(self, request, pk=None):
        """
        發送 PO 給供應商（附帶 PDF）

        Request body (optional):
            { "email": "custom@email.com" }  // 可自訂收件人
        """
        from .services.email_service import send_po_to_supplier

        po = self.get_object()

        # 允許 draft, ready, sent 狀態發送（sent = 重發）
        if po.status not in ['draft', 'ready', 'sent']:
            return Response(
                {'error': f'Cannot send PO in {po.status} status'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # 取得自訂 email（可選）
        custom_email = request.data.get('email')

        # 發送 Email
        result = send_po_to_supplier(po, custom_email)

        if result['success']:
            return Response({
                'status': 'sent',
                'message': result['message'],
                'sent_to': result['sent_to'],
                'sent_at': result['sent_at'].isoformat() if result['sent_at'] else None,
                'sent_count': po.sent_count
            })
        else:
            return Response(
                {'error': result['message']},
                status=status.HTTP_400_BAD_REQUEST
            )

    # P23: List all overdue POs
    @action(detail=False, methods=['get'])
    def overdue(self, request):
        """
        列出所有逾期的 PO
        逾期條件：expected_delivery < today AND status not in ['received', 'cancelled']
        """
        from datetime import date
        today = date.today()

        overdue_pos = self.get_queryset().filter(
            expected_delivery__lt=today
        ).exclude(
            status__in=['received', 'cancelled']
        ).order_by('expected_delivery')[:50]

        serializer = self.get_serializer(overdue_pos, many=True)
        return Response({
            'count': overdue_pos.count(),
            'results': serializer.data
        })

    # Status transition: sent → confirmed
    @action(detail=True, methods=['post'])
    def confirm(self, request, pk=None):
        po = self.get_object()
        if po.status != 'sent':
            return Response(
                {'error': 'Can only confirm PO in sent status'},
                status=status.HTTP_400_BAD_REQUEST
            )
        po.status = 'confirmed'
        po.save()
        return Response({'status': 'confirmed', 'message': 'PO confirmed by supplier'})

    # P23: Status transition: confirmed → in_production
    @action(detail=True, methods=['post'])
    def start_production(self, request, pk=None):
        """
        標記 PO 開始生產（confirmed → in_production）
        """
        po = self.get_object()
        if po.status != 'confirmed':
            return Response(
                {'error': 'Can only start production for PO in confirmed status'},
                status=status.HTTP_400_BAD_REQUEST
            )
        po.status = 'in_production'
        po.save()
        return Response({'status': 'in_production', 'message': 'PO marked as in production'})

    # P23: Status transition: in_production/confirmed → shipped
    @action(detail=True, methods=['post'])
    def ship(self, request, pk=None):
        """
        標記 PO 已出貨（in_production/confirmed → shipped）
        允許跳過 in_production 直接從 confirmed 轉到 shipped
        """
        po = self.get_object()
        if po.status not in ['confirmed', 'in_production']:
            return Response(
                {'error': 'Can only ship PO in confirmed or in_production status'},
                status=status.HTTP_400_BAD_REQUEST
            )
        po.status = 'shipped'
        po.save()
        return Response({'status': 'shipped', 'message': 'PO marked as shipped'})

    # Status transition: confirmed/in_production/shipped → partial_received / received
    @action(detail=True, methods=['post'])
    def receive(self, request, pk=None):
        po = self.get_object()
        # P23: Allow receive from shipped status as well
        if po.status not in ['confirmed', 'in_production', 'shipped', 'partial_received']:
            return Response(
                {'error': 'Can only receive PO in confirmed, in_production, shipped, or partial_received status'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Check if all lines are fully received
        lines = po.lines.all()
        all_received = all(line.quantity_received >= line.quantity for line in lines)

        if all_received:
            po.status = 'received'
            po.actual_delivery = timezone.now().date()
        else:
            po.status = 'partial_received'
        po.save()
        return Response({'status': po.status, 'message': f'PO status updated to {po.status}'})

    # Status transition: any → cancelled
    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        po = self.get_object()
        if po.status in ['received', 'cancelled']:
            return Response(
                {'error': 'Cannot cancel PO that is already received or cancelled'},
                status=status.HTTP_400_BAD_REQUEST
            )
        po.status = 'cancelled'
        po.save()
        return Response({'status': 'cancelled', 'message': 'PO cancelled'})

    # Dashboard statistics
    @action(detail=False, methods=['get'])
    def stats(self, request):
        qs = self.get_queryset()
        stats = {
            'total': qs.count(),
            'by_status': {},
            'total_amount': qs.aggregate(total=Sum('total_amount'))['total'] or 0,
        }
        # Count by status
        status_counts = qs.values('status').annotate(count=Count('id'))
        for item in status_counts:
            stats['by_status'][item['status']] = item['count']
        return Response(stats)

    # Export PO as PDF
    @action(detail=True, methods=['get'], url_path='export-pdf')
    def export_pdf(self, request, pk=None):
        """匯出採購單 PDF (需全部 Line 確認後才能下載)"""
        po = self.get_object()

        # Check if all lines are confirmed
        if not po.all_lines_confirmed:
            return Response(
                {
                    'error': 'Cannot export PDF: Not all lines are confirmed',
                    'confirmed_lines_count': po.confirmed_lines_count,
                    'total_lines_count': po.total_lines_count,
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            pdf_bytes = export_po_pdf(po)
            response = HttpResponse(pdf_bytes, content_type='application/pdf')
            response['Content-Disposition'] = f'attachment; filename="{po.po_number}.pdf"'
            return response
        except Exception as e:
            return Response(
                {'error': f'Failed to generate PDF: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    # Confirm all lines at once
    @action(detail=True, methods=['post'], url_path='confirm-all-lines')
    def confirm_all_lines(self, request, pk=None):
        """Confirm all lines in this PO at once"""
        po = self.get_object()
        now = timezone.now()

        updated_count = po.lines.filter(is_confirmed=False).update(
            is_confirmed=True,
            confirmed_at=now
        )

        return Response({
            'confirmed_count': updated_count,
            'all_lines_confirmed': po.all_lines_confirmed,
            'message': f'{updated_count} lines confirmed'
        })


class POLineViewSet(viewsets.ModelViewSet):
    queryset = POLine.objects.select_related('purchase_order', 'material').all()
    serializer_class = POLineSerializer
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['purchase_order']

    # Update quantity received
    @action(detail=True, methods=['post'])
    def update_received(self, request, pk=None):
        line = self.get_object()
        quantity = request.data.get('quantity_received')
        if quantity is None:
            return Response(
                {'error': 'quantity_received is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        line.quantity_received = quantity
        line.save()
        return Response({
            'id': str(line.id),
            'quantity_received': str(line.quantity_received),
            'message': 'Quantity received updated'
        })

    # Confirm a single line after review
    @action(detail=True, methods=['post'])
    def confirm(self, request, pk=None):
        """Confirm a POLine after review"""
        line = self.get_object()

        # Allow updating fields before confirming
        if 'quantity' in request.data:
            line.quantity = request.data['quantity']
        if 'unit_price' in request.data:
            line.unit_price = request.data['unit_price']
        if 'notes' in request.data:
            line.notes = request.data['notes']

        # Recalculate line total if quantity or price changed
        from decimal import Decimal
        line.line_total = Decimal(str(line.quantity)) * Decimal(str(line.unit_price))

        # Mark as confirmed
        line.is_confirmed = True
        line.confirmed_at = timezone.now()
        line.save()

        # Update PO total
        po = line.purchase_order
        po.total_amount = sum(l.line_total for l in po.lines.all())
        po.save(update_fields=['total_amount'])

        return Response({
            'id': str(line.id),
            'is_confirmed': True,
            'line_total': str(line.line_total),
            'po_total_amount': str(po.total_amount),
            'all_lines_confirmed': po.all_lines_confirmed,
            'message': 'Line confirmed successfully'
        })

    # Unconfirm a line (for re-editing)
    @action(detail=True, methods=['post'])
    def unconfirm(self, request, pk=None):
        """Unconfirm a POLine for re-editing"""
        line = self.get_object()
        line.is_confirmed = False
        line.confirmed_at = None
        line.save()

        return Response({
            'id': str(line.id),
            'is_confirmed': False,
            'message': 'Line unconfirmed for re-editing'
        })
