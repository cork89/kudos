import { QueryClient, useQuery } from '@tanstack/react-query';
import { fetchPreview, fetchSettings } from './api';
import type { ApiSettingsResponse, PostSettings } from '../../shared/types/api';

export function patchSettingsCache(
  queryClient: QueryClient,
  settings: PostSettings
) {
  queryClient.setQueryData<ApiSettingsResponse>(['settings'], {
    status: 'ok',
    data: settings,
  });
}

export function usePreviewQuery() {
  return useQuery({
    queryKey: ['preview'],
    queryFn: fetchPreview,
  });
}

export function useSettingsQuery() {
  return useQuery({
    queryKey: ['settings'],
    queryFn: fetchSettings,
  });
}
