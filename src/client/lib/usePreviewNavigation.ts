import { useCallback, useEffect, useRef, useState } from 'react';
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
  const [hasMoreOlder, setHasMoreOlder] = useState<boolean | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [slideDirection, setSlideDirection] = useState<SlideDirection | null>(
    null
  );
  const prefetchKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (previewResponse?.status !== 'ok') {
      setItems([]);
      setSelectedIndex(0);
      setCursor(null);
      setHasMoreOlder(null);
      prefetchKeyRef.current = null;
      return;
    }

    const initialCursor = getPreviewCursor(previewResponse);
    setItems(getPreviewList(previewResponse));
    setSelectedIndex(0);
    setCursor(initialCursor);
    setHasMoreOlder(initialCursor !== null ? null : false);
    prefetchKeyRef.current = null;
  }, [previewResponse]);

  const fetchOlder = useCallback(async () => {
    if (cursor === null || isLoadingMore) {
      return { added: 0, hasMore: false };
    }

    setIsLoadingMore(true);
    try {
      const response = await fetchPreview({ before: cursor });
      if (response.status !== 'ok') {
        setCursor(null);
        setHasMoreOlder(false);
        return { added: 0, hasMore: false };
      }

      const nextItems = getPreviewList(response);
      const nextCursor = getPreviewCursor(response);
      if (nextItems.length === 0) {
        setCursor(null);
        setHasMoreOlder(false);
        return { added: 0, hasMore: false };
      }

      setItems((current) => [...current, ...nextItems]);
      setCursor(nextCursor);
      const hasMore = nextCursor !== null;
      setHasMoreOlder(hasMore);
      return { added: nextItems.length, hasMore };
    } finally {
      setIsLoadingMore(false);
    }
  }, [cursor, isLoadingMore]);

  useEffect(() => {
    if (items.length === 0 || selectedIndex !== items.length - 1) {
      return;
    }

    if (cursor === null) {
      if (hasMoreOlder !== false) {
        setHasMoreOlder(false);
      }
      return;
    }

    if (hasMoreOlder === false || isLoadingMore) {
      return;
    }

    const prefetchKey = `${items.length}:${cursor}:${selectedIndex}`;
    if (prefetchKeyRef.current === prefetchKey) {
      return;
    }

    prefetchKeyRef.current = prefetchKey;
    void fetchOlder();
  }, [
    cursor,
    fetchOlder,
    hasMoreOlder,
    isLoadingMore,
    items.length,
    selectedIndex,
  ]);

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

    if (hasMoreOlder !== true || isLoadingMore) {
      return;
    }

    setSlideDirection('down');

    const result = await fetchOlder();
    if (result.added > 0) {
      setSelectedIndex((current) => current + 1);
      return;
    }

    clearSlide();
  }, [
    clearSlide,
    fetchOlder,
    hasMoreOlder,
    isLoadingMore,
    items.length,
    selectedIndex,
  ]);

  const preview = items[selectedIndex];
  const canGoUp = selectedIndex > 0;
  const canGoDown =
    selectedIndex < items.length - 1 ||
    (hasMoreOlder === true && !isLoadingMore);
  const showNavigation =
    canGoUp || canGoDown || hasMoreOlder === null || isLoadingMore;

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
