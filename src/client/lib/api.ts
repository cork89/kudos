import type { ApiEditResponse, ApiPreviewResponse, PostSettings } from "../../shared/types/api";

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }
  return (await response.json()) as T;
}

export function fetchHome(): Promise<ApiPreviewResponse> {
  return fetchJson<ApiPreviewResponse>("/api/home");
}

export function fetchView(): Promise<ApiPreviewResponse> {
  return fetchJson<ApiPreviewResponse>("/api/view");
}

export function fetchEdit(): Promise<ApiPreviewResponse> {
  return fetchJson<ApiPreviewResponse>("/api/edit");
}

export function saveSettings(settings: PostSettings): Promise<ApiEditResponse> {
  return fetchJson<ApiEditResponse>("/api/edit", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(settings),
  });
}
