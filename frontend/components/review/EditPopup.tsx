'use client';

/**
 * EditPopup - 翻譯編輯彈窗
 *
 * Features:
 * - 顯示原文
 * - 可Edit Translation（支持換行）
 * - 刪除/隱藏翻譯框
 */

import { useState, useEffect, useRef } from 'react';

interface EditPopupProps {
  isOpen: boolean;
  sourceText: string;
  translatedText: string;
  position: { x: number; y: number };
  onSave: (text: string) => void;
  onDelete: () => void;
  onClose: () => void;
}

export function EditPopup({
  isOpen,
  sourceText,
  translatedText,
  position,
  onSave,
  onDelete,
  onClose,
}: EditPopupProps) {
  const [value, setValue] = useState(translatedText);
  const [isSaving, setIsSaving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setValue(translatedText);
  }, [translatedText, isOpen]);

  useEffect(() => {
    if (isOpen && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.select();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(value);
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = () => {
    onDelete();
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'Enter' && e.ctrlKey) {
      handleSave();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30" />

      {/* Popup */}
      <div
        className="relative bg-white rounded-lg shadow-2xl w-[400px] max-w-[90vw] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b">
          <h3 className="font-semibold text-gray-900">Edit Translation</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Source Text */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Source (English)</label>
            <div className="text-sm text-gray-900 bg-gray-50 rounded p-3 whitespace-pre-wrap max-h-24 overflow-auto">
              {sourceText}
            </div>
          </div>

          {/* Translation */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Translation (Chinese)
              <span className="text-gray-400 ml-2">Ctrl+Enter to save</span>
            </label>
            <textarea
              ref={textareaRef}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="w-full text-sm border border-gray-300 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              rows={4}
              placeholder="Enter translation..."
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-t">
          <button
            onClick={handleDelete}
            className="px-3 py-1.5 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
          >
            Delete
          </button>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-1.5 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {isSaving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
