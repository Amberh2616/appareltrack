/**
 * Approve Revision API
 */

import { API_BASE_URL } from './client';

const API_BASE = API_BASE_URL;

export async function approveRevision(revisionId: string) {
  const res = await fetch(`${API_BASE}/revisions/${revisionId}/approve/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Approve failed (${res.status}): ${text || res.statusText}`);
  }

  return res.json();
}
