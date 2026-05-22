import type {
  ApiEditResponse,
  ApiPreviewResponse,
  ApiSettingsResponse,
  PostSettings,
} from '../../shared/types/api';

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }
  return (await response.json()) as T;
}

export function fetchPreview(): Promise<ApiPreviewResponse> {
  return fetchJson<ApiPreviewResponse>('/api/preview');
}

export function fetchSettings(): Promise<ApiSettingsResponse> {
  return fetchJson<ApiSettingsResponse>('/api/settings');
}

export function saveSettings(settings: PostSettings): Promise<ApiEditResponse> {
  return fetchJson<ApiEditResponse>('/api/edit', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(settings),
  });
}
