import { QueryClient, useQuery } from '@tanstack/react-query';
import { fetchPreview, fetchPreviewByCommentId, fetchSettings } from './api';
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

export function prefetchSettings(queryClient: QueryClient, commentId: string) {
  return queryClient.prefetchQuery({
    queryKey: ['settings', commentId],
    queryFn: () => fetchSettings(commentId),
  });
}

export function usePreviewQuery() {
  return useQuery({
    queryKey: ['preview', 'list'],
    queryFn: () => fetchPreview(),
  });
}

export function usePreviewItemQuery(commentId: string) {
  return useQuery({
    queryKey: ['preview', commentId],
    queryFn: () => fetchPreviewByCommentId(commentId),
  });
}

export function useSettingsQuery(commentId: string | undefined) {
  return useQuery({
    queryKey: ['settings', commentId],
    queryFn: () => fetchSettings(commentId!),
    enabled: Boolean(commentId),
  });
}
