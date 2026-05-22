import { useCallback, useEffect, useState } from 'react';
import type { ApiPreviewResponse, PreviewData } from '../../shared/types/api';
import type { SlideDirection } from './preview';
import { fetchPreview } from './api';
import { getPreviewCursor, getPreviewList } from './preview';

export function usePreviewNavigation(
  previewResponse: ApiPreviewResponse | undefined
) {
  const [items, setItems] = useState<PreviewData[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [cursor, setCursor] = useState<number | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [slideDirection, setSlideDirection] = useState<SlideDirection | null>(
    null
  );

  useEffect(() => {
    if (previewResponse?.status !== 'ok') {
      setItems([]);
      setSelectedIndex(0);
      setCursor(null);
      return;
    }

    setItems(getPreviewList(previewResponse));
    setSelectedIndex(0);
    setCursor(getPreviewCursor(previewResponse));
  }, [previewResponse]);

  const loadMore = useCallback(async () => {
    if (cursor === null || isLoadingMore) {
      return false;
    }

    setIsLoadingMore(true);
    try {
      const response = await fetchPreview({ before: cursor });
      if (response.status !== 'ok') {
        setCursor(null);
        return false;
      }

      const nextItems = getPreviewList(response);
      if (nextItems.length === 0) {
        setCursor(null);
        return false;
      }

      setItems((current) => [...current, ...nextItems]);
      setCursor(getPreviewCursor(response));
      return true;
    } finally {
      setIsLoadingMore(false);
    }
  }, [cursor, isLoadingMore]);

  const clearSlide = useCallback(() => {
    setSlideDirection(null);
  }, []);

  const goUp = useCallback(() => {
    if (selectedIndex <= 0) {
      return;
    }

    setSlideDirection('up');
    setSelectedIndex((current) => Math.max(0, current - 1));
  }, [selectedIndex]);

  const goDown = useCallback(async () => {
    if (selectedIndex < items.length - 1) {
      setSlideDirection('down');
      setSelectedIndex((current) => current + 1);
      return;
    }

    if (cursor === null || isLoadingMore) {
      return;
    }

    setSlideDirection('down');

    const loaded = await loadMore();
    if (loaded) {
      setSelectedIndex((current) => current + 1);
      return;
    }

    clearSlide();
  }, [
    clearSlide,
    cursor,
    isLoadingMore,
    items.length,
    loadMore,
    selectedIndex,
  ]);

  const preview = items[selectedIndex];
  const canGoUp = selectedIndex > 0;
  const canGoDown =
    selectedIndex < items.length - 1 || (cursor !== null && !isLoadingMore);
  const showNavigation = items.length > 1 || cursor !== null;

  return {
    preview,
    canGoUp,
    canGoDown,
    goUp,
    goDown,
    showNavigation,
    isLoadingMore,
    slideDirection,
    clearSlide,
  };
}
