import { apiClient } from './client';

// Types
export interface ChatMessage {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  parsed_command: string;
  created_at: string;
}

export interface AssistantTask {
  id: number;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
  status: 'pending' | 'in_progress' | 'done' | 'cancelled';
  due_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface ChatResponse {
  type: string;
  message: string;
  items?: any[];
  count?: number;
  commands?: { cmd: string; desc: string }[];
  stats?: Record<string, number>;
  status_breakdown?: Record<string, number>;
  email_draft?: {
    to: string;
    subject: string;
    body: string;
  } | null;
  success?: boolean;
  suggestion?: string;
  task_id?: number;
  note_id?: number;
  po_id?: number;
}

// Chat API
export async function sendChatMessage(message: string): Promise<ChatResponse> {
  return apiClient.post<ChatResponse>('/assistant/chat/', { message });
}

export async function getChatHistory(limit = 50): Promise<ChatMessage[]> {
  return apiClient.get<ChatMessage[]>(`/assistant/chat/history/?limit=${limit}`);
}

export async function clearChatHistory(): Promise<void> {
  await apiClient.delete('/assistant/chat/history/');
}

// Tasks API
export async function getTasks(params?: {
  status?: string;
  priority?: string;
}): Promise<AssistantTask[]> {
  const queryParams = new URLSearchParams();
  if (params?.status) queryParams.append('status', params.status);
  if (params?.priority) queryParams.append('priority', params.priority);
  const queryString = queryParams.toString();
  return apiClient.get<AssistantTask[]>(`/assistant/tasks/${queryString ? `?${queryString}` : ''}`);
}

export async function createTask(data: {
  title: string;
  description?: string;
  priority?: 'low' | 'medium' | 'high';
  due_date?: string;
}): Promise<AssistantTask> {
  return apiClient.post<AssistantTask>('/assistant/tasks/', data);
}

export async function updateTask(
  id: number,
  data: Partial<AssistantTask>
): Promise<AssistantTask> {
  return apiClient.patch<AssistantTask>(`/assistant/tasks/${id}/`, data);
}

export async function deleteTask(id: number): Promise<void> {
  await apiClient.delete(`/assistant/tasks/${id}/`);
}

export async function completeTask(id: number): Promise<AssistantTask> {
  return apiClient.post<AssistantTask>(`/assistant/tasks/${id}/complete/`);
}

export async function cancelTask(id: number): Promise<AssistantTask> {
  return apiClient.post<AssistantTask>(`/assistant/tasks/${id}/cancel/`);
}

// Notifications API
export interface Notification {
  id: number;
  title: string;
  message: string;
  notification_type: 'reminder' | 'alert' | 'info' | 'warning';
  is_read: boolean;
  created_at: string;
}

export async function getNotifications(params?: {
  is_read?: boolean;
}): Promise<Notification[]> {
  const queryParams = new URLSearchParams();
  if (params?.is_read !== undefined) {
    queryParams.append('is_read', String(params.is_read));
  }
  const queryString = queryParams.toString();
  return apiClient.get<Notification[]>(`/assistant/notifications/${queryString ? `?${queryString}` : ''}`);
}

export async function markNotificationRead(id: number): Promise<Notification> {
  return apiClient.post<Notification>(`/assistant/notifications/${id}/mark_read/`);
}

export async function markAllNotificationsRead(): Promise<{ marked_count: number }> {
  return apiClient.post<{ marked_count: number }>('/assistant/notifications/mark_all_read/');
}

export async function getUnreadCount(): Promise<{ count: number }> {
  return apiClient.get<{ count: number }>('/assistant/notifications/unread_count/');
}
