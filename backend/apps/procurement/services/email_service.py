"""
P24: PO Email Service
發送採購單給供應商
"""

from django.core.mail import EmailMessage
from django.template.loader import render_to_string
from django.conf import settings
from django.utils import timezone
import logging

from ..models import PurchaseOrder
from .po_pdf_export import export_po_pdf

logger = logging.getLogger(__name__)


class POEmailService:
    """
    PO Email 發送服務

    使用方式：
        service = POEmailService()
        result = service.send_po_to_supplier(po)
    """

    def __init__(self):
        self.from_email = getattr(settings, 'DEFAULT_FROM_EMAIL', 'noreply@example.com')

    def send_po_to_supplier(self, po: PurchaseOrder, custom_email: str = None) -> dict:
        """
        發送 PO 給供應商

        Args:
            po: PurchaseOrder 實例
            custom_email: 自訂收件人（可選，預設使用 supplier.email）

        Returns:
            dict: {
                'success': bool,
                'message': str,
                'sent_to': str,
                'sent_at': datetime
            }
        """
        # 驗證
        validation = self._validate_po(po, custom_email)
        if not validation['valid']:
            return {
                'success': False,
                'message': validation['error'],
                'sent_to': None,
                'sent_at': None
            }

        recipient_email = custom_email or po.supplier.email

        try:
            # 生成 PDF
            pdf_bytes = export_po_pdf(po)

            # 渲染 Email 內容
            context = self._build_email_context(po)
            subject = f"Purchase Order {po.po_number} - {po.supplier.name}"
            html_content = render_to_string('emails/po_to_supplier.html', context)

            # 建立 Email
            email = EmailMessage(
                subject=subject,
                body=html_content,
                from_email=self.from_email,
                to=[recipient_email],
            )
            email.content_subtype = 'html'

            # 附加 PDF
            email.attach(
                filename=f"{po.po_number}.pdf",
                content=pdf_bytes,
                mimetype='application/pdf'
            )

            # 發送
            email.send(fail_silently=False)

            # 更新 PO 記錄
            now = timezone.now()
            po.sent_at = now
            po.sent_to_email = recipient_email
            po.sent_count += 1
            po.status = 'sent'
            po.save(update_fields=['sent_at', 'sent_to_email', 'sent_count', 'status', 'updated_at'])

            logger.info(f"PO {po.po_number} sent to {recipient_email}")

            return {
                'success': True,
                'message': f'PO sent successfully to {recipient_email}',
                'sent_to': recipient_email,
                'sent_at': now
            }

        except Exception as e:
            logger.error(f"Failed to send PO {po.po_number}: {str(e)}")
            return {
                'success': False,
                'message': f'Failed to send email: {str(e)}',
                'sent_to': recipient_email,
                'sent_at': None
            }

    def _validate_po(self, po: PurchaseOrder, custom_email: str = None) -> dict:
        """驗證 PO 是否可以發送"""

        # 檢查狀態
        if po.status not in ['draft', 'ready', 'sent']:
            return {
                'valid': False,
                'error': f'PO status must be draft, ready, or sent. Current: {po.status}'
            }

        # 檢查是否有 lines
        if not po.lines.exists():
            return {
                'valid': False,
                'error': 'PO has no line items'
            }

        # 檢查是否所有 lines 都已確認
        if not po.all_lines_confirmed:
            return {
                'valid': False,
                'error': f'Not all lines confirmed ({po.confirmed_lines_count}/{po.total_lines_count})'
            }

        # 檢查收件人 Email
        recipient = custom_email or po.supplier.email
        if not recipient:
            return {
                'valid': False,
                'error': 'Supplier email is not set. Please provide an email address.'
            }

        return {'valid': True, 'error': None}

    def _build_email_context(self, po: PurchaseOrder) -> dict:
        """建立 Email 模板的 context"""
        lines = po.lines.all().order_by('material_name')

        return {
            'po': po,
            'po_number': po.po_number,
            'supplier_name': po.supplier.name,
            'supplier_contact': po.supplier.contact_person,
            'po_date': po.po_date,
            'expected_delivery': po.expected_delivery,
            'lines': lines,
            'total_amount': po.total_amount,
            'notes': po.notes,
            'company_name': getattr(settings, 'COMPANY_NAME', 'Fashion Production System'),
        }


def send_po_to_supplier(po: PurchaseOrder, custom_email: str = None) -> dict:
    """
    便捷函數：發送 PO 給供應商

    Usage:
        from apps.procurement.services.email_service import send_po_to_supplier
        result = send_po_to_supplier(po)
    """
    service = POEmailService()
    return service.send_po_to_supplier(po, custom_email)
