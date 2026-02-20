"""
P3: Batch Export Service
批量匯出多個 SampleRun 的文件到 ZIP

支持匯出類型：
- mwo: 製造工作單
- estimate: 成本估算
- po: 採購訂單
- techpack: Tech Pack 雙語對照版（新增）
"""

import zipfile
from io import BytesIO
from django.http import HttpResponse
from datetime import datetime
import logging

from .pdf_export import MWOPDFExporter, EstimatePDFExporter, T2POPDFExporter
from .excel_export import MWOExcelExporter, EstimateExcelExporter, T2POExcelExporter

logger = logging.getLogger(__name__)


def batch_export_sample_runs(
    run_ids: list,
    export_types: list = None,
    format: str = 'pdf',
    organization=None,
    include_techpack: bool = False,
    techpack_mode: str = 'side_by_side'
):
    """
    批量匯出多個 SampleRun 的文件到 ZIP

    Args:
        run_ids: SampleRun UUID 列表
        export_types: ['mwo', 'estimate', 'po'] 子集，默認全部
        format: 'pdf' or 'excel'
        organization: 租戶過濾
        include_techpack: 是否包含 Tech Pack 雙語版（新增）
        techpack_mode: Tech Pack 匯出模式（side_by_side/alternating/overlay_offset/overlay_background）

    Returns:
        HttpResponse with ZIP file

    ZIP 結構:
        export_2026-01-04_143022.zip
        ├── Run-001_LW1FLWS/
        │   ├── MWO-2601-000001.pdf
        │   ├── EST-2601-000001-v1.pdf
        │   ├── T2PO-2601-000001.pdf
        │   └── TechPack_LW1FLWS_對照版.pdf  (新增)
        └── Run-002_LW1DKES/
            └── ...
    """
    from apps.samples.models import SampleRun

    if export_types is None:
        export_types = ['mwo', 'estimate', 'po']

    # 查詢 Runs（使用租戶過濾）
    runs = SampleRun.objects.filter(id__in=run_ids)
    if organization:
        runs = runs.filter(organization=organization)

    runs = runs.select_related(
        'sample_request__revision__style',
        'sample_request__revision',  # 需要訪問 Tech Pack
        'sample_request'
    ).prefetch_related(
        'mwos',
        'sample_request__estimates',
        't2pos'
    )

    if not runs.exists():
        return HttpResponse('No runs found', status=404)

    # 準備 ZIP 緩衝區
    zip_buffer = BytesIO()
    results = {'total': runs.count(), 'succeeded': 0, 'failed': 0, 'errors': []}

    with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
        for run in runs:
            # 資料夾名稱
            style_number = 'Unknown'
            if run.sample_request and run.sample_request.revision and run.sample_request.revision.style:
                style_number = run.sample_request.revision.style.style_number
            folder = f"Run-{run.run_no:03d}_{style_number}/"

            # 匯出 MWO
            if 'mwo' in export_types:
                try:
                    mwo = run.mwos.filter(is_latest=True).first()
                    if mwo:
                        if format == 'pdf':
                            exporter = MWOPDFExporter()
                            # Read from snapshot or guidance_usage
                            bom_data = getattr(mwo, 'bom_snapshot_json', None) or []
                            if not bom_data:
                                try:
                                    if hasattr(run, 'guidance_usage') and run.guidance_usage:
                                        usage_lines = run.guidance_usage.usage_lines.select_related('bom_item').all()
                                        bom_data = []
                                        for idx, ul in enumerate(usage_lines, 1):
                                            bom_item = ul.bom_item
                                            bom_data.append({
                                                'line_no': idx,
                                                'material_name': bom_item.material_name,
                                                'uom': ul.consumption_unit or '',
                                                'consumption': float(ul.consumption) if ul.consumption else 0,
                                                'unit_price': float(getattr(bom_item, 'unit_price', 0) or 0),
                                                'supplier_name': getattr(bom_item, 'supplier', '') or '',
                                            })
                                except Exception:
                                    pass

                            context = {
                                'mwo': mwo,
                                'bom_data': bom_data,
                                'ops_data': getattr(mwo, 'construction_snapshot_json', None) or [],
                                'qc_data': getattr(mwo, 'qc_snapshot_json', None) or [],
                            }
                            file_data = exporter.render_to_pdf('pdf/mwo.html', context)
                            ext = 'pdf'
                        else:  # excel
                            exporter = MWOExcelExporter()
                            response = exporter.export(mwo)
                            file_data = response.content
                            ext = 'xlsx'

                        zip_file.writestr(f"{folder}MWO_{mwo.mwo_no}.{ext}", file_data)
                        results['succeeded'] += 1
                except Exception as e:
                    results['failed'] += 1
                    results['errors'].append(f"Run {run.id} MWO: {str(e)}")

            # 匯出 Estimate
            if 'estimate' in export_types:
                try:
                    estimate = run.sample_request.estimates.filter(
                        status__in=['accepted', 'sent', 'draft']
                    ).order_by('-estimate_version').first()

                    if estimate:
                        if format == 'pdf':
                            exporter = EstimatePDFExporter()
                            context = {
                                'estimate': estimate,
                                'breakdown': getattr(estimate, 'breakdown_snapshot_json', None) or {},
                            }
                            file_data = exporter.render_to_pdf('pdf/estimate.html', context)
                            ext = 'pdf'
                        else:  # excel
                            exporter = EstimateExcelExporter()
                            response = exporter.export(estimate)
                            file_data = response.content
                            ext = 'xlsx'

                        zip_file.writestr(f"{folder}EST_{estimate.id}.{ext}", file_data)
                        results['succeeded'] += 1
                except Exception as e:
                    results['failed'] += 1
                    results['errors'].append(f"Run {run.id} Estimate: {str(e)}")

            # 匯出 PO
            if 'po' in export_types:
                try:
                    po = run.t2pos.filter(
                        status__in=['issued', 'confirmed', 'delivered']
                    ).order_by('-version_no').first()

                    if not po:
                        po = run.t2pos.filter(status='draft').order_by('-version_no').first()

                    if po:
                        if format == 'pdf':
                            exporter = T2POPDFExporter()
                            lines = list(po.lines.all().order_by('line_no'))
                            context = {
                                'po': po,
                                'lines': lines,
                            }
                            file_data = exporter.render_to_pdf('pdf/t2po.html', context)
                            ext = 'pdf'
                        else:  # excel
                            exporter = T2POExcelExporter()
                            response = exporter.export(po)
                            file_data = response.content
                            ext = 'xlsx'

                        zip_file.writestr(f"{folder}T2PO_{po.po_no}.{ext}", file_data)
                        results['succeeded'] += 1
                except Exception as e:
                    results['failed'] += 1
                    results['errors'].append(f"Run {run.id} PO: {str(e)}")

            # 匯出 Tech Pack 雙語版（新增）
            if include_techpack or 'techpack' in export_types:
                try:
                    techpack_data = _export_techpack_for_run(run, techpack_mode)
                    if techpack_data:
                        mode_suffix = {
                            'side_by_side': '對照版',
                            'alternating': '交替版',
                            'overlay_offset': '偏移版',
                            'overlay_background': '疊加版',
                        }
                        filename = f"TechPack_{style_number}_{mode_suffix.get(techpack_mode, 'bilingual')}.pdf"
                        zip_file.writestr(f"{folder}{filename}", techpack_data)
                        results['succeeded'] += 1
                        logger.info(f"Run {run.id}: Tech Pack exported ({techpack_mode})")
                except Exception as e:
                    results['failed'] += 1
                    results['errors'].append(f"Run {run.id} TechPack: {str(e)}")
                    logger.warning(f"Run {run.id}: Tech Pack export failed - {e}")

    # 返回 ZIP
    zip_buffer.seek(0)
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')

    # 如果包含 techpack，在文件名中標記
    extra_tag = '_with_techpack' if (include_techpack or 'techpack' in export_types) else ''
    filename = f"export_{len(runs)}_runs_{format}{extra_tag}_{timestamp}.zip"

    response = HttpResponse(zip_buffer, content_type='application/zip')
    response['Content-Disposition'] = f'attachment; filename="{filename}"'
    return response


def _export_techpack_for_run(run, mode: str = 'side_by_side') -> bytes:
    """
    為單個 SampleRun 匯出 Tech Pack 雙語版

    Args:
        run: SampleRun instance
        mode: 匯出模式

    Returns:
        bytes: PDF 數據，如果沒有 Tech Pack 則返回 None
    """
    # 嘗試找到關聯的 TechPackRevision
    tech_pack_revision = None

    # 路徑 1: SampleRequest -> Revision -> TechPackRevision (如果存在)
    if run.sample_request and run.sample_request.revision:
        revision = run.sample_request.revision

        # 查找 TechPackRevision (假設通過 Style 關聯)
        try:
            from apps.parsing.models import TechPackRevision as TPRevision
            style = revision.style

            # 嘗試多種查找方式
            # 方式 1: 直接通過 style 關聯
            if hasattr(style, 'techpack_revisions'):
                tech_pack_revision = style.techpack_revisions.filter(
                    status='parsed'
                ).order_by('-created_at').first()

            # 方式 2: 通過 TechPackUpload -> TechPackRevision
            if not tech_pack_revision:
                from apps.parsing.models import TechPackUpload
                upload = TechPackUpload.objects.filter(
                    style=style
                ).order_by('-created_at').first()

                if upload and hasattr(upload, 'revisions'):
                    tech_pack_revision = upload.revisions.filter(
                        status='parsed'
                    ).order_by('-created_at').first()

        except Exception as e:
            logger.debug(f"Could not find TechPackRevision for run {run.id}: {e}")

    if not tech_pack_revision:
        logger.info(f"Run {run.id}: No Tech Pack found, skipping")
        return None

    # 匯出 Tech Pack
    try:
        from apps.parsing.services.techpack_pdf_export import TechPackBilingualPDFExporter

        exporter = TechPackBilingualPDFExporter(
            tech_pack_revision,
            font_size=18,
            mode=mode
        )

        # 根據模式選擇對應的方法
        if mode == 'side_by_side':
            return exporter._export_side_by_side()
        elif mode == 'alternating':
            return exporter._export_alternating()
        elif mode == 'overlay_offset':
            return exporter._export_overlay_offset()
        elif mode == 'overlay_background':
            return exporter._export_overlay_background()
        else:
            return exporter._export_side_by_side()  # 默認雙欄對照

    except Exception as e:
        logger.error(f"Tech Pack export failed for run {run.id}: {e}")
        raise


def export_single_run_with_techpack(
    run_id,
    export_types: list = None,
    format: str = 'pdf',
    techpack_mode: str = 'side_by_side',
    organization=None
):
    """
    匯出單個 SampleRun 的所有文件（包含 Tech Pack）到 ZIP

    這是 MWO 下載整合的主要入口，將：
    - MWO PDF/Excel
    - Estimate PDF/Excel
    - T2 PO PDF/Excel
    - Tech Pack 雙語對照版 PDF

    一起打包成 ZIP 下載。

    Args:
        run_id: SampleRun UUID
        export_types: ['mwo', 'estimate', 'po', 'techpack']
        format: 'pdf' or 'excel'（Tech Pack 只有 PDF）
        techpack_mode: Tech Pack 匯出模式
        organization: 租戶過濾

    Returns:
        HttpResponse with ZIP file
    """
    if export_types is None:
        export_types = ['mwo', 'estimate', 'po', 'techpack']

    # 確保包含 techpack
    include_techpack = 'techpack' in export_types

    return batch_export_sample_runs(
        run_ids=[run_id],
        export_types=[t for t in export_types if t != 'techpack'],
        format=format,
        organization=organization,
        include_techpack=include_techpack,
        techpack_mode=techpack_mode
    )


def get_export_summary(run_ids: list, organization=None) -> dict:
    """
    獲取批量匯出的預覽摘要

    Args:
        run_ids: SampleRun UUID 列表
        organization: 租戶過濾

    Returns:
        dict: 匯出摘要信息
    """
    from apps.samples.models import SampleRun

    runs = SampleRun.objects.filter(id__in=run_ids)
    if organization:
        runs = runs.filter(organization=organization)

    runs = runs.select_related(
        'sample_request__revision__style',
        'sample_request'
    ).prefetch_related(
        'mwos',
        'sample_request__estimates',
        't2pos'
    )

    summary = {
        'total_runs': runs.count(),
        'mwo_count': 0,
        'estimate_count': 0,
        'po_count': 0,
        'techpack_count': 0,
        'runs': []
    }

    for run in runs:
        run_info = {
            'id': str(run.id),
            'run_no': run.run_no,
            'style_number': 'Unknown',
            'has_mwo': False,
            'has_estimate': False,
            'has_po': False,
            'has_techpack': False
        }

        if run.sample_request and run.sample_request.revision and run.sample_request.revision.style:
            run_info['style_number'] = run.sample_request.revision.style.style_number

        # 檢查 MWO
        if run.mwos.filter(is_latest=True).exists():
            run_info['has_mwo'] = True
            summary['mwo_count'] += 1

        # 檢查 Estimate
        if run.sample_request.estimates.filter(
            status__in=['accepted', 'sent', 'draft']
        ).exists():
            run_info['has_estimate'] = True
            summary['estimate_count'] += 1

        # 檢查 PO
        if run.t2pos.filter(status__in=['draft', 'issued', 'confirmed', 'delivered']).exists():
            run_info['has_po'] = True
            summary['po_count'] += 1

        # 檢查 Tech Pack
        try:
            from apps.parsing.models import TechPackUpload
            if run.sample_request and run.sample_request.revision:
                style = run.sample_request.revision.style
                if TechPackUpload.objects.filter(style=style).exists():
                    run_info['has_techpack'] = True
                    summary['techpack_count'] += 1
        except Exception:
            pass

        summary['runs'].append(run_info)

    return summary
