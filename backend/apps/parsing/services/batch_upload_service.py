"""
Batch Upload Service for Tech Packs
支援 ZIP 上傳，自動分組處理多款 Tech Pack

Cases supported:
- Case A: {style_number}.pdf - 一個 PDF 包含所有內容
- Case B: {style_number}_techpack.pdf, {style_number}_bom.pdf - 多個 PDF 按款式分組
"""

import os
import re
import zipfile
import tempfile
import logging
from typing import Dict, List, Tuple, Optional
from dataclasses import dataclass, field
from pathlib import Path

from django.core.files.base import ContentFile
from django.db import transaction

from apps.styles.models import Style, StyleRevision
from apps.parsing.models import UploadedDocument

logger = logging.getLogger(__name__)


@dataclass
class FileInfo:
    """單個文件的資訊"""
    filename: str
    style_number: str
    file_type: str  # 'combined', 'techpack', 'bom', 'spec', 'unknown'
    content: bytes
    original_path: str


@dataclass
class StyleGroup:
    """按款式分組的文件集合"""
    style_number: str
    files: List[FileInfo] = field(default_factory=list)

    @property
    def has_techpack(self) -> bool:
        return any(f.file_type in ('combined', 'techpack') for f in self.files)

    @property
    def has_bom(self) -> bool:
        return any(f.file_type in ('combined', 'bom') for f in self.files)


@dataclass
class BatchUploadResult:
    """批量上傳結果"""
    total_files: int = 0
    styles_found: int = 0
    styles_created: int = 0
    documents_created: int = 0
    errors: List[str] = field(default_factory=list)
    style_results: Dict[str, dict] = field(default_factory=dict)


class BatchUploadService:
    """批量上傳服務"""

    # 文件類型識別模式
    FILE_TYPE_PATTERNS = [
        (r'_techpack\.pdf$', 'techpack'),
        (r'_tech_pack\.pdf$', 'techpack'),
        (r'_tech\.pdf$', 'techpack'),
        (r'_bom\.pdf$', 'bom'),
        (r'_spec\.pdf$', 'spec'),
        (r'_measurement\.pdf$', 'spec'),
    ]

    # 款號提取模式（支援多種格式）
    STYLE_NUMBER_PATTERNS = [
        # LW1FLWS_techpack.pdf → LW1FLWS
        r'^([A-Z0-9]{5,15})_',
        # LW1FLWS.pdf → LW1FLWS
        r'^([A-Z0-9]{5,15})\.pdf$',
        # 123456_techpack.pdf → 123456
        r'^(\d{5,10})_',
        # 123456.pdf → 123456
        r'^(\d{5,10})\.pdf$',
        # Style-LW1FLWS.pdf → LW1FLWS
        r'^(?:Style[_-])?([A-Z0-9]{5,15})\.pdf$',
    ]

    def __init__(self, user=None):
        self.user = user

    def extract_style_number(self, filename: str) -> Optional[str]:
        """從文件名提取款號"""
        basename = os.path.basename(filename)

        for pattern in self.STYLE_NUMBER_PATTERNS:
            match = re.match(pattern, basename, re.IGNORECASE)
            if match:
                return match.group(1).upper()

        # 備用方案：取下劃線前的部分
        parts = basename.split('_')
        if len(parts) >= 1:
            name = parts[0].replace('.pdf', '').replace('.PDF', '')
            if len(name) >= 5:
                return name.upper()

        return None

    def detect_file_type(self, filename: str) -> str:
        """檢測文件類型"""
        basename = os.path.basename(filename).lower()

        for pattern, file_type in self.FILE_TYPE_PATTERNS:
            if re.search(pattern, basename, re.IGNORECASE):
                return file_type

        # 默認：如果只有款號.pdf，認為是 combined
        if re.match(r'^[a-z0-9_-]+\.pdf$', basename):
            return 'combined'

        return 'unknown'

    def parse_zip_contents(self, zip_file) -> Tuple[List[FileInfo], List[str]]:
        """解析 ZIP 文件內容"""
        files: List[FileInfo] = []
        errors: List[str] = []

        with zipfile.ZipFile(zip_file, 'r') as zf:
            for name in zf.namelist():
                # 跳過目錄和隱藏文件
                if name.endswith('/') or name.startswith('__MACOSX') or name.startswith('.'):
                    continue

                # 只處理 PDF 文件
                if not name.lower().endswith('.pdf'):
                    logger.info(f"跳過非 PDF 文件: {name}")
                    continue

                basename = os.path.basename(name)
                style_number = self.extract_style_number(basename)

                if not style_number:
                    errors.append(f"無法從文件名識別款號: {basename}")
                    continue

                file_type = self.detect_file_type(basename)

                try:
                    content = zf.read(name)
                    files.append(FileInfo(
                        filename=basename,
                        style_number=style_number,
                        file_type=file_type,
                        content=content,
                        original_path=name
                    ))
                except Exception as e:
                    errors.append(f"讀取文件失敗 {basename}: {str(e)}")

        return files, errors

    def group_files_by_style(self, files: List[FileInfo]) -> Dict[str, StyleGroup]:
        """按款式分組文件"""
        groups: Dict[str, StyleGroup] = {}

        for file_info in files:
            style_number = file_info.style_number
            if style_number not in groups:
                groups[style_number] = StyleGroup(style_number=style_number)
            groups[style_number].files.append(file_info)

        return groups

    @transaction.atomic
    def process_style_group(self, group: StyleGroup) -> dict:
        """處理單個款式的所有文件"""
        result = {
            'style_number': group.style_number,
            'style_id': None,
            'revision_id': None,
            'documents': [],
            'status': 'pending',
            'error': None
        }

        try:
            # 1. 查找或創建 Style
            from apps.core.models import Organization
            org = Organization.objects.first()

            style, created = Style.objects.get_or_create(
                organization=org,
                style_number=group.style_number,
                defaults={
                    'style_name': f'{group.style_number} (Auto)',
                    'season': '',
                    'customer': ''
                }
            )
            result['style_id'] = str(style.id)
            result['style_created'] = created

            # 2. 創建新的 Revision
            revision = StyleRevision.objects.create(
                organization=org,
                style=style,
                revision_label=self._get_next_revision_label(style),
                status='draft',
                notes='Batch upload'
            )
            result['revision_id'] = str(revision.id)

            # 3. 為每個文件創建 UploadedDocument
            for file_info in group.files:
                doc = self._create_uploaded_document(file_info, style, revision)
                result['documents'].append({
                    'id': str(doc.id),
                    'filename': file_info.filename,
                    'file_type': file_info.file_type,
                    'status': doc.status
                })

            result['status'] = 'created'

        except Exception as e:
            logger.exception(f"處理款式 {group.style_number} 失敗")
            result['status'] = 'error'
            result['error'] = str(e)

        return result

    def _get_next_revision_label(self, style: Style) -> str:
        """獲取下一個版本標籤 (Rev A, Rev B, ...)"""
        count = StyleRevision.objects.filter(style=style).count()
        # A=65 in ASCII, so count 0 → 'A', count 1 → 'B', etc.
        letter = chr(65 + count) if count < 26 else f'{count + 1}'
        return f'Rev {letter}'

    def _create_uploaded_document(
        self,
        file_info: FileInfo,
        style: Style,
        revision: StyleRevision
    ) -> UploadedDocument:
        """創建上傳文檔記錄"""
        from apps.core.models import Organization

        # 保存文件
        content_file = ContentFile(file_info.content, name=file_info.filename)

        # Get default organization
        org = Organization.objects.first()

        doc = UploadedDocument.objects.create(
            organization=org,
            filename=file_info.filename,
            file=content_file,
            file_type='pdf',
            file_size=len(file_info.content),
            status='uploaded',
            style_revision=revision,
            created_by=self.user,
            # Store batch info in extraction_errors (repurposed as metadata)
            extraction_errors=[{
                'type': 'batch_upload_info',
                'detected_file_type': file_info.file_type,
                'original_path': file_info.original_path,
                'style_number': file_info.style_number
            }]
        )

        return doc

    def process_zip(self, zip_file) -> BatchUploadResult:
        """處理 ZIP 文件的主入口"""
        result = BatchUploadResult()

        # 1. 解析 ZIP 內容
        files, parse_errors = self.parse_zip_contents(zip_file)
        result.errors.extend(parse_errors)
        result.total_files = len(files)

        if not files:
            result.errors.append("ZIP 文件中沒有找到有效的 PDF 文件")
            return result

        # 2. 按款式分組
        groups = self.group_files_by_style(files)
        result.styles_found = len(groups)

        # 3. 處理每個款式
        for style_number, group in groups.items():
            style_result = self.process_style_group(group)
            result.style_results[style_number] = style_result

            if style_result['status'] == 'created':
                if style_result.get('style_created'):
                    result.styles_created += 1
                result.documents_created += len(style_result['documents'])
            elif style_result['status'] == 'error':
                result.errors.append(f"款式 {style_number}: {style_result['error']}")

        return result


class BatchProcessingService:
    """批量 AI 處理服務"""

    def __init__(self):
        pass

    def process_documents(
        self,
        document_ids: List[str],
        progress_callback=None
    ) -> Dict[str, dict]:
        """
        批量處理文檔（分類 + 提取）

        Args:
            document_ids: 要處理的文檔 ID 列表
            progress_callback: 進度回調函數 (current, total, message)

        Returns:
            處理結果字典 {doc_id: result}
        """
        from apps.parsing.services.file_classifier import FileClassifier
        from apps.parsing.services.vision_extract import VisionExtractor
        from apps.parsing.services.bom_extractor import BOMExtractor
        from apps.parsing.services.measurement_extractor import MeasurementExtractor

        results = {}
        total = len(document_ids)

        for i, doc_id in enumerate(document_ids):
            try:
                doc = UploadedDocument.objects.get(id=doc_id)

                if progress_callback:
                    progress_callback(i + 1, total, f"處理 {doc.filename}")

                # 根據文件類型選擇處理流程
                # Check extraction_errors for batch upload info
                batch_info = next(
                    (e for e in doc.extraction_errors if e.get('type') == 'batch_upload_info'),
                    None
                )
                detected_type = batch_info.get('detected_file_type', 'combined') if batch_info else 'combined'

                if detected_type in ('combined', 'techpack'):
                    # Tech Pack 流程：分類 → 提取
                    result = self._process_techpack(doc)
                elif detected_type == 'bom':
                    # BOM 流程：直接提取
                    result = self._process_bom(doc)
                elif detected_type == 'spec':
                    # Spec 流程：直接提取
                    result = self._process_spec(doc)
                else:
                    result = {'status': 'skipped', 'reason': f'未知文件類型: {detected_type}'}

                results[doc_id] = result

            except UploadedDocument.DoesNotExist:
                results[doc_id] = {'status': 'error', 'error': '文檔不存在'}
            except Exception as e:
                logger.exception(f"處理文檔 {doc_id} 失敗")
                results[doc_id] = {'status': 'error', 'error': str(e)}

        return results

    def _process_techpack(self, doc: UploadedDocument) -> dict:
        """處理 Tech Pack 文檔"""
        from apps.parsing.services.file_classifier import FileClassifier
        from apps.parsing.services.vision_extract import VisionExtractor

        # Step 1: 分類
        classifier = FileClassifier()
        classify_result = classifier.classify_document(doc)

        doc.status = 'classified'
        doc.metadata['classification'] = classify_result
        doc.save()

        # Step 2: 提取
        extractor = VisionExtractor()
        extract_result = extractor.extract_document(doc)

        doc.status = 'extracted'
        doc.metadata['extraction'] = {'blocks_count': extract_result.get('blocks_count', 0)}
        doc.save()

        return {
            'status': 'completed',
            'classification': classify_result,
            'blocks_count': extract_result.get('blocks_count', 0),
            'revision_id': str(extract_result.get('tech_pack_revision_id')) if extract_result.get('tech_pack_revision_id') else None
        }

    def _process_bom(self, doc: UploadedDocument) -> dict:
        """處理 BOM 文檔"""
        from apps.parsing.services.bom_extractor import BOMExtractor

        extractor = BOMExtractor()
        result = extractor.extract_from_document(doc)

        doc.status = 'extracted'
        doc.metadata['extraction'] = {'bom_items_count': result.get('items_count', 0)}
        doc.save()

        return {
            'status': 'completed',
            'bom_items_count': result.get('items_count', 0)
        }

    def _process_spec(self, doc: UploadedDocument) -> dict:
        """處理 Spec/Measurement 文檔"""
        from apps.parsing.services.measurement_extractor import MeasurementExtractor

        extractor = MeasurementExtractor()
        result = extractor.extract_from_document(doc)

        doc.status = 'extracted'
        doc.metadata['extraction'] = {'measurements_count': result.get('items_count', 0)}
        doc.save()

        return {
            'status': 'completed',
            'measurements_count': result.get('items_count', 0)
        }
