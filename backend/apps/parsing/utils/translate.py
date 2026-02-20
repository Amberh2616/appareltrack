"""
Translation Utils

MVP: 語言判斷 + stub 翻譯
Phase 2: 接 GPT / 翻譯 API
Phase 3: 詞彙庫整合（glossary-enhanced translation）
"""

import re
import json
import os
from pathlib import Path
from typing import Optional


# ============ Glossary Service ============

_glossary_cache: dict = None


def load_glossary() -> dict:
    """
    載入成衣術語詞彙庫

    Returns:
        dict: {ENGLISH_UPPER: {english, chinese, category}}
    """
    global _glossary_cache

    if _glossary_cache is not None:
        return _glossary_cache

    glossary_path = Path(__file__).parent.parent / 'data' / 'garment_glossary.json'

    if not glossary_path.exists():
        print(f"Glossary file not found: {glossary_path}")
        _glossary_cache = {}
        return _glossary_cache

    try:
        with open(glossary_path, 'r', encoding='utf-8') as f:
            _glossary_cache = json.load(f)
        print(f"Loaded glossary with {len(_glossary_cache)} terms")
    except Exception as e:
        print(f"Failed to load glossary: {e}")
        _glossary_cache = {}

    return _glossary_cache


def lookup_glossary(text: str) -> Optional[str]:
    """
    從詞彙庫查詢翻譯

    Args:
        text: 英文原文

    Returns:
        str: 中文翻譯（如果找到），否則 None
    """
    if not text or not text.strip():
        return None

    glossary = load_glossary()
    if not glossary:
        return None

    # 標準化查詢
    key = text.upper().strip()

    # 1. 精確匹配
    if key in glossary:
        return glossary[key]['chinese']

    # 2. 去掉標點後匹配
    key_clean = re.sub(r'[^\w\s]', '', key).strip()
    if key_clean and key_clean in glossary:
        return glossary[key_clean]['chinese']

    return None


def get_relevant_glossary_terms(texts: list[str], limit: int = 50) -> list[dict]:
    """
    取得與輸入文本相關的詞彙庫條目

    用於在 LLM prompt 中提供參考詞彙

    Args:
        texts: 待翻譯文本列表
        limit: 最多返回多少條目

    Returns:
        list[dict]: [{english, chinese}, ...]
    """
    glossary = load_glossary()
    if not glossary:
        return []

    # 收集所有文本中的單詞
    all_words = set()
    for text in texts:
        if text:
            words = re.findall(r'[A-Za-z]+', text.upper())
            all_words.update(words)

    # 找出匹配的詞彙條目
    relevant = []
    for key, value in glossary.items():
        # 檢查詞彙庫條目是否與任何輸入單詞相關
        key_words = set(re.findall(r'[A-Za-z]+', key))
        if key_words & all_words:  # 有交集
            relevant.append({
                'english': value['english'],
                'chinese': value['chinese']
            })
            if len(relevant) >= limit:
                break

    return relevant


def is_chinese(text: str) -> bool:
    """
    檢測文字是否包含中文字元

    Args:
        text: 待檢測文字

    Returns:
        bool: True 如果包含中文
    """
    # Unicode 範圍：CJK Unified Ideographs
    chinese_pattern = re.compile(r'[\u4e00-\u9fff]+')
    return bool(chinese_pattern.search(text))


def get_translation_client():
    """
    取得翻譯用的 OpenAI client

    支援：
    - OpenAI API（預設）
    - LM Studio（OPENAI_BASE_URL=http://localhost:1234/v1）
    - Ollama（OPENAI_BASE_URL=http://localhost:11434/v1）
    """
    from openai import OpenAI
    import os

    base_url = os.getenv('OPENAI_BASE_URL')
    api_key = os.getenv('OPENAI_API_KEY')

    # 本地模型不需要真正的 API key
    if base_url and 'localhost' in base_url:
        api_key = api_key or 'not-needed'

    if base_url:
        return OpenAI(api_key=api_key, base_url=base_url)
    else:
        # 使用 OpenAI 預設端點
        return OpenAI(api_key=api_key)


def get_translation_model() -> str:
    """取得翻譯模型名稱"""
    import os
    return os.getenv('TRANSLATION_MODEL', 'gpt-4o-mini')


def machine_translate(text: str, use_glossary: bool = True) -> str:
    """
    機器翻譯（整合詞彙庫）

    Args:
        text: 原文
        use_glossary: 是否使用詞彙庫（預設 True）

    Returns:
        str: 中文翻譯（如果原文已是中文，回傳空字串）

    Rules:
    - 如果原文已是中文 → 回傳 "" (前端不顯示翻譯欄位)
    - 如果詞彙庫有精確匹配 → 直接使用詞彙庫翻譯
    - 如果原文是英文 → 翻譯成中文（附帶相關詞彙庫參考）

    環境變數：
    - OPENAI_BASE_URL: API 端點（預設 OpenAI，可改 LM Studio/Ollama）
    - TRANSLATION_MODEL: 模型名稱（預設 gpt-4o-mini）
    """
    # Critical Issue #1 修正：中文原文判斷
    if is_chinese(text):
        return ""  # 前端會判斷空字串 → 不顯示翻譯欄位

    # Phase 3: 詞彙庫精確匹配
    if use_glossary:
        glossary_result = lookup_glossary(text)
        if glossary_result:
            return glossary_result

    # ✅ 翻譯（支援 OpenAI / LM Studio / Ollama）
    try:
        client = get_translation_client()
        model = get_translation_model()

        # 取得相關詞彙作為參考
        relevant_terms = []
        if use_glossary:
            relevant_terms = get_relevant_glossary_terms([text], limit=20)

        # 構建系統提示
        system_prompt = "You are a fashion/garment industry translator. Translate English to Traditional Chinese. Keep technical terms accurate."

        if relevant_terms:
            terms_str = "\n".join([f"- {t['english']} = {t['chinese']}" for t in relevant_terms])
            system_prompt += f"\n\nReference glossary (use these translations when applicable):\n{terms_str}"

        response = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": text}
            ],
            temperature=0.3,  # 降低隨機性，提高一致性
            max_tokens=200
        )
        return response.choices[0].message.content.strip()
    except Exception as e:
        # 翻譯失敗，回傳原文
        print(f"Translation failed: {e}")
        return text


def batch_translate(texts: list[str], use_glossary: bool = True) -> list[str]:
    """
    批量翻譯（整合詞彙庫，顯著提升速度）

    Args:
        texts: 原文列表
        use_glossary: 是否使用詞彙庫（預設 True）

    Returns:
        list[str]: 翻譯列表（與原文列表對應）

    Performance:
    - 詞彙庫精確匹配：0 API 調用（即時）
    - 單次翻譯 50 個文本：1 次 API 調用（3-5 秒）
    - vs 逐一翻譯：50 次 API 調用（50-100 秒）
    - 速度提升：10-20 倍
    """
    if not texts:
        return []

    # 過濾空文本、中文文本，並嘗試詞彙庫匹配
    results = []
    texts_to_translate = []
    indices_to_translate = []

    for i, text in enumerate(texts):
        if not text or not text.strip():
            results.append("")
        elif is_chinese(text):
            results.append("")
        else:
            # Phase 3: 嘗試詞彙庫精確匹配
            glossary_result = None
            if use_glossary:
                glossary_result = lookup_glossary(text)

            if glossary_result:
                results.append(glossary_result)
            else:
                results.append(None)  # Placeholder
                texts_to_translate.append(text)
                indices_to_translate.append(i)

    # 如果沒有需要翻譯的文本，直接返回
    if not texts_to_translate:
        return results

    # 批量翻譯
    try:
        client = get_translation_client()
        model = get_translation_model()

        # 取得相關詞彙作為參考
        relevant_terms = []
        if use_glossary:
            relevant_terms = get_relevant_glossary_terms(texts_to_translate, limit=50)

        # 構建系統提示
        system_prompt = "You are a fashion/garment industry translator. Translate English to Traditional Chinese."

        if relevant_terms:
            terms_str = "\n".join([f"- {t['english']} = {t['chinese']}" for t in relevant_terms])
            system_prompt += f"\n\nReference glossary (use these translations when applicable):\n{terms_str}"

        # 構建 JSON 格式提示
        prompt = f"""Translate the following English texts to Traditional Chinese. Return a JSON array with the same number of items.

Input:
{json.dumps(texts_to_translate, ensure_ascii=False)}

Output format: ["translation1", "translation2", ...]

Rules:
- Use the reference glossary terms when applicable
- Keep technical terms accurate
- Preserve formatting
- Return ONLY the JSON array"""

        response = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": prompt}
            ],
            temperature=0.3,
            max_tokens=4000  # 增加 token 限制以支持批量
        )

        # 解析回應
        result_text = response.choices[0].message.content.strip()

        # 清理 markdown 格式
        if "```json" in result_text:
            result_text = result_text.split("```json")[1].split("```")[0].strip()
        elif "```" in result_text:
            result_text = result_text.split("```")[1].split("```")[0].strip()

        translations = json.loads(result_text)

        # 填充結果
        for i, idx in enumerate(indices_to_translate):
            if i < len(translations):
                results[idx] = translations[i]
            else:
                results[idx] = texts[idx]  # Fallback

        return results

    except Exception as e:
        # 翻譯失敗，回傳原文
        print(f"Batch translation failed: {e}")
        for i in indices_to_translate:
            results[i] = texts[i]
        return results
