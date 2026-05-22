import { QueryClient, useQuery } from '@tanstack/react-query';
import { fetchPreview, fetchSettings } from './api';
import type { ApiSettingsResponse, PostSettings } from '../../shared/types/api';

export function patchSettingsCache(
  queryClient: QueryClient,
  commentId: string,
  settings: PostSettings
) {
  queryClient.setQueryData<ApiSettingsResponse>(['settings', commentId], {
    status: 'ok',
    data: settings,
  });
}

export function usePreviewQuery() {
  return useQuery({
    queryKey: ['preview', 'list'],
    queryFn: () => fetchPreview(),
  });
}

export function useSettingsQuery(commentId: string | undefined) {
  return useQuery({
    queryKey: ['settings', commentId],
    queryFn: () => fetchSettings(commentId!),
    enabled: Boolean(commentId),
  });
}
