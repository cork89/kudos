import { QueryClient, useQuery } from '@tanstack/react-query';
import { fetchEdit, fetchHome } from './api';
import type { ApiPreviewResponse, PostSettings } from '../../shared/types/api';

export function patchPreviewSettingsCache(
  queryClient: QueryClient,
  queryKey: readonly ['home'] | readonly ['edit'],
  settings: PostSettings
) {
  queryClient.setQueryData<ApiPreviewResponse>(queryKey, (old) => {
    if (old?.status !== 'ok') return old;
    return {
      ...old,
      data: {
        ...old.data,
        settings,
      },
    };
  });
}

export function useHomeQuery() {
  return useQuery({
    queryKey: ['home'],
    queryFn: fetchHome,
  });
}

export function useEditQuery() {
  return useQuery({
    queryKey: ['edit'],
    queryFn: fetchEdit,
  });
}
