"""
Command Parser Service for Assistant (Method A - No ChatGPT)

Parses user input and executes corresponding commands.
"""

import re
from datetime import date, timedelta
from typing import Optional, Dict, Any, List, Tuple
from django.db.models import Q
from django.utils import timezone


class CommandParser:
    """
    Parse user commands and return structured responses.
    No AI/LLM - pure keyword matching and rule-based logic.
    """

    # Command patterns (regex)
    COMMANDS = {
        'overdue': r'^(overdue|expired|late|past due)$',
        'overdue_po': r'^(overdue po|late po|delayed po)$',  # P23: Overdue PO command
        'this_week': r'^(this week|weekly|week tasks?)$',
        'all_tasks': r'^(tasks?|my tasks?|show tasks?|list tasks?)$',
        'check_style': r'^(check|status|info)\s+(.+)$',
        'draft_email': r'^(draft email|email draft|write email)\s+(.+)$',
        'add_task': r'^(add task|new task|create task)\s+(.+)$',
        'add_note': r'^(add note|note|memo)\s+(.+)$',
        'help': r'^(help|\?|commands?)$',
        'summary': r'^(summary|overview|dashboard)$',
        'pending_po': r'^(pending po|po status|purchase orders?)$',
        'recent': r'^(recent|latest|new)$',
    }

    def __init__(self):
        self.compiled_patterns = {
            name: re.compile(pattern, re.IGNORECASE)
            for name, pattern in self.COMMANDS.items()
        }

    def parse(self, user_input: str) -> Tuple[str, Optional[str]]:
        """
        Parse user input and return (command_name, argument).
        Returns ('unknown', None) if no command matched.
        """
        user_input = user_input.strip()

        for cmd_name, pattern in self.compiled_patterns.items():
            match = pattern.match(user_input)
            if match:
                # Extract argument if present (group 2)
                arg = match.group(2) if match.lastindex and match.lastindex >= 2 else None
                return cmd_name, arg

        return 'unknown', user_input


def parse_and_execute(user_input: str) -> Dict[str, Any]:
    """
    Main entry point: parse command and execute it.
    Returns a structured response dict.
    """
    from apps.samples.models import SampleRun
    from apps.procurement.models import PurchaseOrder
    from apps.styles.models import Style
    from apps.assistant.models import AssistantTask, AssistantNote

    parser = CommandParser()
    command, arg = parser.parse(user_input)

    today = date.today()

    # ========== COMMAND HANDLERS ==========

    if command == 'help':
        return {
            'type': 'help',
            'message': 'Here are the commands I understand:',
            'commands': [
                {'cmd': 'overdue', 'desc': 'Show overdue sample runs'},
                {'cmd': 'overdue po', 'desc': 'Show overdue purchase orders'},
                {'cmd': 'this week', 'desc': 'Show tasks due this week'},
                {'cmd': 'tasks', 'desc': 'Show all your tasks'},
                {'cmd': 'check [style#]', 'desc': 'Check status of a style'},
                {'cmd': 'draft email [style#]', 'desc': 'Draft PO email for style'},
                {'cmd': 'add task [text]', 'desc': 'Create a new task'},
                {'cmd': 'add note [text]', 'desc': 'Add a quick note'},
                {'cmd': 'pending po', 'desc': 'Show pending purchase orders'},
                {'cmd': 'summary', 'desc': 'Show production summary'},
                {'cmd': 'recent', 'desc': 'Show recent updates'},
            ]
        }

    elif command == 'overdue':
        # Find overdue sample runs (target_due_date < today)
        overdue_runs = SampleRun.objects.filter(
            target_due_date__lt=today,
            status__in=['draft', 'materials_planning', 'po_drafted', 'po_issued',
                       'mwo_drafted', 'mwo_issued', 'in_progress']
        ).select_related('sample_request__revision__style')[:10]

        items = []
        for run in overdue_runs:
            style = run.sample_request.revision.style if run.sample_request else None
            days_overdue = (today - run.target_due_date).days if run.target_due_date else 0
            items.append({
                'id': run.id,
                'style_number': style.style_number if style else 'N/A',
                'run_no': run.run_no,
                'status': run.status,
                'target_date': str(run.target_due_date) if run.target_due_date else None,
                'days_overdue': days_overdue,
            })

        return {
            'type': 'overdue',
            'message': f'Found {len(items)} overdue sample runs:' if items else 'No overdue items found!',
            'items': items,
            'count': len(items),
        }

    elif command == 'overdue_po':
        # P23: Find overdue purchase orders
        overdue_pos = PurchaseOrder.objects.filter(
            expected_delivery__lt=today
        ).exclude(
            status__in=['received', 'cancelled']
        ).select_related('supplier').order_by('expected_delivery')[:15]

        items = []
        for po in overdue_pos:
            days_overdue = (today - po.expected_delivery).days if po.expected_delivery else 0
            items.append({
                'id': str(po.id),
                'po_number': po.po_number,
                'status': po.status,
                'supplier': po.supplier.name if po.supplier else 'N/A',
                'expected_delivery': str(po.expected_delivery) if po.expected_delivery else None,
                'days_overdue': days_overdue,
                'total_amount': float(po.total_amount) if po.total_amount else 0,
            })

        return {
            'type': 'overdue_po',
            'message': f'Found {len(items)} overdue purchase orders:' if items else 'No overdue POs found!',
            'items': items,
            'count': len(items),
        }

    elif command == 'this_week':
        week_end = today + timedelta(days=7)
        runs_this_week = SampleRun.objects.filter(
            target_due_date__gte=today,
            target_due_date__lte=week_end,
            status__in=['draft', 'materials_planning', 'po_drafted', 'po_issued',
                       'mwo_drafted', 'mwo_issued', 'in_progress']
        ).select_related('sample_request__revision__style')[:15]

        items = []
        for run in runs_this_week:
            style = run.sample_request.revision.style if run.sample_request else None
            items.append({
                'id': run.id,
                'style_number': style.style_number if style else 'N/A',
                'run_no': run.run_no,
                'status': run.status,
                'target_date': str(run.target_due_date) if run.target_due_date else None,
            })

        return {
            'type': 'this_week',
            'message': f'{len(items)} items due this week:' if items else 'Nothing due this week!',
            'items': items,
            'count': len(items),
        }

    elif command == 'all_tasks':
        tasks = AssistantTask.objects.filter(
            status__in=['pending', 'in_progress']
        ).order_by('-priority', 'due_date')[:20]

        items = []
        for task in tasks:
            items.append({
                'id': task.id,
                'title': task.title,
                'priority': task.priority,
                'status': task.status,
                'due_date': str(task.due_date) if task.due_date else None,
            })

        return {
            'type': 'tasks',
            'message': f'You have {len(items)} active tasks:' if items else 'No tasks yet. Add one with "add task [text]"',
            'items': items,
            'count': len(items),
        }

    elif command == 'check_style':
        style_number = arg.strip() if arg else ''
        styles = Style.objects.filter(
            Q(style_number__icontains=style_number) |
            Q(style_name__icontains=style_number)
        ).prefetch_related('revisions__sample_requests__runs')[:5]

        if not styles.exists():
            return {
                'type': 'check_style',
                'message': f'No style found matching "{style_number}"',
                'items': [],
            }

        items = []
        for style in styles:
            # Get latest revision and its runs
            latest_rev = style.revisions.order_by('-version').first()
            runs_info = []
            if latest_rev:
                for req in latest_rev.sample_requests.all():
                    for run in req.runs.all():
                        runs_info.append({
                            'run_id': run.id,
                            'run_no': run.run_no,
                            'run_type': run.run_type,
                            'status': run.status,
                            'target_date': str(run.target_due_date) if run.target_due_date else None,
                        })

            items.append({
                'style_id': style.id,
                'style_number': style.style_number,
                'style_name': style.style_name,
                'brand': style.brand.name if style.brand else None,
                'season': style.season,
                'revision_count': style.revisions.count(),
                'runs': runs_info,
            })

        return {
            'type': 'check_style',
            'message': f'Found {len(items)} style(s):',
            'items': items,
        }

    elif command == 'draft_email':
        style_number = arg.strip() if arg else ''
        # Find style and its pending POs
        style = Style.objects.filter(style_number__icontains=style_number).first()

        if not style:
            return {
                'type': 'draft_email',
                'message': f'No style found matching "{style_number}"',
                'email_draft': None,
            }

        # Find associated POs
        pos = PurchaseOrder.objects.filter(
            sample_run__sample_request__revision__style=style,
            status='draft'
        ).select_related('supplier')[:5]

        if not pos.exists():
            return {
                'type': 'draft_email',
                'message': f'No draft POs found for style {style.style_number}',
                'email_draft': None,
            }

        # Generate email draft template
        po = pos.first()
        supplier_name = po.supplier.name if po.supplier else 'Supplier'
        supplier_email = po.supplier.email if po.supplier else '[email]'

        email_draft = {
            'to': supplier_email,
            'subject': f'Purchase Order #{po.po_number} - {style.style_number}',
            'body': f"""Dear {supplier_name},

Please find attached the Purchase Order #{po.po_number} for style {style.style_number}.

Order Details:
- PO Number: {po.po_number}
- Style: {style.style_number}
- Total Amount: ${po.total_amount or 0:.2f}

Please confirm receipt and expected delivery date.

Best regards,
[Your Name]
""",
        }

        return {
            'type': 'draft_email',
            'message': f'Email draft ready for PO #{po.po_number}:',
            'email_draft': email_draft,
            'po_id': po.id,
        }

    elif command == 'add_task':
        task_text = arg.strip() if arg else ''
        if not task_text:
            return {
                'type': 'add_task',
                'message': 'Please specify task text. Example: add task Follow up with supplier',
                'success': False,
            }

        task = AssistantTask.objects.create(
            title=task_text,
            priority='medium',
            status='pending',
        )

        return {
            'type': 'add_task',
            'message': f'Task created: "{task_text}"',
            'success': True,
            'task_id': task.id,
        }

    elif command == 'add_note':
        note_text = arg.strip() if arg else ''
        if not note_text:
            return {
                'type': 'add_note',
                'message': 'Please specify note text. Example: add note Customer wants blue fabric',
                'success': False,
            }

        note = AssistantNote.objects.create(
            content=note_text,
        )

        return {
            'type': 'add_note',
            'message': f'Note saved!',
            'success': True,
            'note_id': note.id,
            'preview': note_text[:100],
        }

    elif command == 'pending_po':
        pending_pos = PurchaseOrder.objects.filter(
            status__in=['draft', 'sent']
        ).select_related('supplier', 'sample_run__sample_request__revision__style')[:15]

        items = []
        for po in pending_pos:
            style = None
            if po.sample_run and po.sample_run.sample_request:
                style = po.sample_run.sample_request.revision.style

            items.append({
                'id': po.id,
                'po_number': po.po_number,
                'status': po.status,
                'supplier': po.supplier.name if po.supplier else 'N/A',
                'style_number': style.style_number if style else 'N/A',
                'total_amount': float(po.total_amount) if po.total_amount else 0,
                'created_at': po.created_at.strftime('%Y-%m-%d') if po.created_at else None,
            })

        return {
            'type': 'pending_po',
            'message': f'{len(items)} pending purchase orders:' if items else 'No pending POs!',
            'items': items,
            'count': len(items),
        }

    elif command == 'summary':
        # Production summary dashboard
        active_runs = SampleRun.objects.exclude(
            status__in=['sample_done', 'cancelled', 'accepted']
        ).count()

        overdue_count = SampleRun.objects.filter(
            target_due_date__lt=today,
            status__in=['draft', 'materials_planning', 'po_drafted', 'po_issued',
                       'mwo_drafted', 'mwo_issued', 'in_progress']
        ).count()

        pending_po_count = PurchaseOrder.objects.filter(
            status__in=['draft', 'sent']
        ).count()

        tasks_count = AssistantTask.objects.filter(
            status__in=['pending', 'in_progress']
        ).count()

        # Status breakdown
        status_counts = {}
        for run in SampleRun.objects.exclude(status__in=['cancelled']).values('status'):
            status = run['status']
            status_counts[status] = status_counts.get(status, 0) + 1

        return {
            'type': 'summary',
            'message': 'Production Summary:',
            'stats': {
                'active_runs': active_runs,
                'overdue': overdue_count,
                'pending_pos': pending_po_count,
                'tasks': tasks_count,
            },
            'status_breakdown': status_counts,
        }

    elif command == 'recent':
        # Recent updates
        recent_runs = SampleRun.objects.order_by('-updated_at')[:10]

        items = []
        for run in recent_runs:
            style = None
            if run.sample_request and run.sample_request.revision:
                style = run.sample_request.revision.style

            items.append({
                'id': run.id,
                'style_number': style.style_number if style else 'N/A',
                'run_no': run.run_no,
                'status': run.status,
                'updated_at': run.updated_at.strftime('%Y-%m-%d %H:%M') if run.updated_at else None,
            })

        return {
            'type': 'recent',
            'message': 'Recent updates:',
            'items': items,
        }

    else:
        # Unknown command
        return {
            'type': 'unknown',
            'message': f'I don\'t understand "{user_input}". Type "help" to see available commands.',
            'suggestion': 'Try: overdue, this week, check [style#], or help',
        }
