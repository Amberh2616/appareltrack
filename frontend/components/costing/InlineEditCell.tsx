/**
 * InlineEditCell Component - Phase 2-3 Costing
 *
 * Reusable inline-editable cell with:
 * - Save on blur or Enter key (no auto-save during typing)
 * - Optimistic updates
 * - Visual feedback (loading/saved/error)
 * - Disabled state for submitted versions
 */

'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Loader2, Check, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface InlineEditCellProps {
  value: string | number;
  onSave: (newValue: string) => Promise<void>;
  disabled?: boolean;
  format?: 'number' | 'currency' | 'text';
  placeholder?: string;
  className?: string;
}

export function InlineEditCell({
  value,
  onSave,
  disabled = false,
  format = 'number',
  placeholder,
  className,
}: InlineEditCellProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [localValue, setLocalValue] = useState(String(value));
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  // Sync with prop changes ONLY when not editing
  // This prevents overwriting user input during editing
  useEffect(() => {
    if (!isEditing && !isSaving) {
      setLocalValue(String(value));
    }
  }, [value, isEditing, isSaving]);

  // Format display value
  const formatValue = (val: string | number): string => {
    const numVal = parseFloat(String(val));
    if (isNaN(numVal)) return String(val);

    if (format === 'currency') {
      return '$' + numVal.toFixed(2);
    }
    if (format === 'number') {
      return numVal.toFixed(4);
    }
    return String(val);
  };

  // Handle edit mode activation
  const handleClick = () => {
    if (disabled) return;
    setIsEditing(true);
    setSaveStatus('idle');
    setError(null);
    // Focus input after render
    setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 0);
  };

  // Handle value change (NO auto-save, just update local state)
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalValue(e.target.value);
  };

  // Handle save
  const handleSave = async () => {
    const trimmedValue = localValue.trim();

    // Skip if value unchanged or empty
    if (trimmedValue === String(value) || trimmedValue === '') {
      setLocalValue(String(value)); // Restore original if empty
      setIsEditing(false);
      return;
    }

    // Validate number format
    if (format === 'number' || format === 'currency') {
      const numVal = parseFloat(trimmedValue);
      if (isNaN(numVal) || numVal < 0) {
        setError('Please enter a valid positive number');
        setSaveStatus('error');
        return;
      }
    }

    setIsSaving(true);
    setSaveStatus('idle');
    setError(null);

    try {
      await onSave(trimmedValue);
      setSaveStatus('saved');
      setIsEditing(false);

      // Clear "saved" status after 2s
      setTimeout(() => {
        setSaveStatus('idle');
      }, 2000);
    } catch (err) {
      setSaveStatus('error');
      setError(err instanceof Error ? err.message : 'Save failed');
      // Keep editing mode open so user can fix
    } finally {
      setIsSaving(false);
    }
  };

  // Handle blur (save and exit)
  const handleBlur = () => {
    if (!isSaving) {
      handleSave();
    }
  };

  // Handle keyboard
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      // Revert and exit
      setLocalValue(String(value));
      setIsEditing(false);
      setSaveStatus('idle');
      setError(null);
    }
  };

  // Render status icon
  const renderStatusIcon = () => {
    if (isSaving) {
      return <Loader2 className="h-3 w-3 animate-spin text-blue-500" />;
    }
    if (saveStatus === 'saved') {
      return <Check className="h-3 w-3 text-green-500" />;
    }
    if (saveStatus === 'error') {
      return <AlertCircle className="h-3 w-3 text-red-500" />;
    }
    return null;
  };

  return (
    <div className="relative group">
      {!isEditing ? (
        <div
          onClick={handleClick}
          className={cn(
            'px-2 py-1.5 rounded transition-colors cursor-pointer min-h-[32px] flex items-center justify-between gap-2',
            disabled
              ? 'text-gray-500 cursor-not-allowed'
              : 'hover:bg-blue-50 hover:border hover:border-blue-300 hover:border-dashed',
            saveStatus === 'saved' && 'bg-green-50',
            saveStatus === 'error' && 'bg-red-50',
            className
          )}
          title={disabled ? 'Cannot edit submitted version' : 'Click to edit'}
        >
          <span className={cn(disabled && 'opacity-60')}>
            {formatValue(value)}
          </span>
          {renderStatusIcon()}
        </div>
      ) : (
        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            value={localValue}
            onChange={handleChange}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className={cn(
              'w-full px-2 py-1.5 border rounded focus:outline-none focus:ring-2',
              isSaving
                ? 'border-blue-300 bg-blue-50 focus:ring-blue-500'
                : saveStatus === 'error'
                ? 'border-red-500 focus:ring-red-500'
                : 'border-blue-500 focus:ring-blue-500'
            )}
            disabled={isSaving}
          />
          {isSaving && (
            <div className="absolute right-2 top-1/2 -translate-y-1/2">
              <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
            </div>
          )}
        </div>
      )}

      {/* Error tooltip */}
      {error && (
        <div className="absolute left-0 top-full mt-1 z-10 bg-red-50 border border-red-200 rounded px-2 py-1 text-xs text-red-700 shadow-md max-w-xs">
          {error}
        </div>
      )}
    </div>
  );
}
