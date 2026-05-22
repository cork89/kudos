import type {
  ApiPreviewResponse,
  PreviewData,
  PreviewListData,
} from '../../shared/types/api';

export type SlideDirection = 'up' | 'down';

function isPreviewListData(
  data: PreviewListData | PreviewData
): data is PreviewListData {
  return 'items' in data && Array.isArray(data.items);
}

export function getPreviewList(
  response: ApiPreviewResponse | undefined
): PreviewData[] {
  if (response?.status !== 'ok') {
    return [];
  }

  if (isPreviewListData(response.data)) {
    return response.data.items;
  }

  return [response.data];
}

export function getFirstPreview(
  response: ApiPreviewResponse | undefined
): PreviewData | undefined {
  return getPreviewList(response)[0];
}

export function getPreviewCursor(
  response: ApiPreviewResponse | undefined
): number | null {
  if (response?.status !== 'ok' || !isPreviewListData(response.data)) {
    return null;
  }

  return response.data.cursor;
}
