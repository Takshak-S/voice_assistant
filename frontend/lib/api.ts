import type { Conversation, ConversationListItem } from '@/types/conversation';

const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Request failed' }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }

  return response.json();
}

export const api = {
  async getHealth() {
    return fetchJson<{ status: string; openai_configured: boolean; weather_configured: boolean }>(
      `${API_BASE}/health`
    );
  },

  async createConversation(title?: string): Promise<Conversation> {
    return fetchJson(`${API_BASE}/api/conversation/new`, {
      method: 'POST',
      body: JSON.stringify({ title }),
    });
  },

  async getConversation(id: number): Promise<Conversation> {
    return fetchJson(`${API_BASE}/api/conversation/${id}`);
  },

  async listConversations(limit = 20, offset = 0): Promise<ConversationListItem[]> {
    return fetchJson(`${API_BASE}/api/conversation?limit=${limit}&offset=${offset}`);
  },

  async transcribeAudio(audioBlob: Blob): Promise<string> {
    const formData = new FormData();
    formData.append('file', audioBlob, 'audio.webm');

    const response = await fetch(`${API_BASE}/api/transcribe`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Transcription failed' }));
      throw new Error(error.detail || 'Transcription failed');
    }

    return response.text();
  },

  async generateSpeech(text: string): Promise<Blob> {
    const response = await fetch(`${API_BASE}/api/speech`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Speech generation failed' }));
      throw new Error(error.detail || 'Speech generation failed');
    }

    return response.blob();
  },

  async summarizeConversation(conversationId: number): Promise<{ title: string; summary: string; message_count: number }> {
    return fetchJson(`${API_BASE}/api/conversation/${conversationId}/summarize`, {
      method: 'POST',
    });
  },

  async generateTitle(conversationId: number): Promise<{ id: number; title: string }> {
    return fetchJson(`${API_BASE}/api/conversation/${conversationId}/title`, {
      method: 'POST',
    });
  },
};

export function getWebSocketUrl(conversationId: number): string {
  const wsBase = API_BASE.replace('http', 'ws');
  return `${wsBase}/ws/conversation/${conversationId}`;
}