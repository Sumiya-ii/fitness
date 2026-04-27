import { api } from './client';

export interface VoiceDraftStatus {
  id: string;
  status: 'waiting' | 'active' | 'completed' | 'failed';
  transcription?: string;
  mealType?: string | null;
  items?: Array<{
    name: string;
    quantity: number;
    unit: string;
    grams: number;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    fiber?: number;
    sugar?: number;
    sodium?: number;
    saturatedFat?: number;
    confidence: number;
  }>;
  totalCalories?: number;
  totalProtein?: number;
  totalCarbs?: number;
  totalFat?: number;
  clarification?: {
    question: string;
    options: Array<{ label: string; patch: Record<string, unknown> | null }>;
    itemIndex: number | null;
    reason: string;
  };
  errorMessage?: string;
}

export const voiceApi = {
  upload: async (
    uri: string,
    locale: string,
    signal?: AbortSignal,
  ): Promise<{ data: { draftId: string } }> => {
    const formData = new FormData();
    formData.append('audio', {
      uri,
      type: 'audio/m4a',
      name: 'recording.m4a',
    } as unknown as Blob);
    formData.append('locale', locale);

    const token = await api.getToken();
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.trim().replace(/\/$/, '') ?? '';
    const url = `${baseUrl}/voice/upload`;

    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: formData,
      signal,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`API error ${res.status}: ${text}`);
    }

    return res.json() as Promise<{ data: { draftId: string } }>;
  },

  getDraft: async (id: string): Promise<{ data: VoiceDraftStatus }> =>
    api.get<{ data: VoiceDraftStatus }>(`/voice/drafts/${id}`),
};
