import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import type { ApiPreviewResponse, PreviewData } from '../../shared/types/api';
import type { SlideDirection } from './preview';
import { fetchPreview } from './api';
import { getPreviewCursor, getPreviewList } from './preview';

function getSnapshotFromResponse(
  previewResponse: ApiPreviewResponse | undefined
) {
  if (previewResponse?.status !== 'ok') {
    return {
      items: [] as PreviewData[],
      selectedIndex: 0,
      cursor: null as number | null,
      hasMoreOlder: null as boolean | null,
    };
  }

  const initialCursor = getPreviewCursor(previewResponse);
  return {
    items: getPreviewList(previewResponse),
    selectedIndex: 0,
    cursor: initialCursor,
    hasMoreOlder: initialCursor !== null ? null : false,
  };
}

export function usePreviewNavigation(
  previewResponse: ApiPreviewResponse | undefined
) {
  const initialSnapshot = getSnapshotFromResponse(previewResponse);
  const [items, setItems] = useState(initialSnapshot.items);
  const [selectedIndex, setSelectedIndex] = useState(
    initialSnapshot.selectedIndex
  );
  const [cursor, setCursor] = useState<number | null>(initialSnapshot.cursor);
  const [hasMoreOlder, setHasMoreOlder] = useState<boolean | null>(
    initialSnapshot.hasMoreOlder
  );
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [slideDirection, setSlideDirection] = useState<SlideDirection | null>(
    null
  );
  const [prevPreviewResponse, setPrevPreviewResponse] =
    useState(previewResponse);
  const prefetchKeyRef = useRef<string | null>(null);

  if (previewResponse !== prevPreviewResponse) {
    setPrevPreviewResponse(previewResponse);
    const snapshot = getSnapshotFromResponse(previewResponse);
    setItems(snapshot.items);
    setSelectedIndex(snapshot.selectedIndex);
    setCursor(snapshot.cursor);
    setHasMoreOlder(snapshot.hasMoreOlder);
    prefetchKeyRef.current = null;
  }

  const effectiveHasMoreOlder = cursor === null ? false : hasMoreOlder;

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

  const schedulePrefetch = useCallback(() => {
    if (cursor === null || effectiveHasMoreOlder === false || isLoadingMore) {
      return;
    }

    if (items.length === 0 || selectedIndex !== items.length - 1) {
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
    effectiveHasMoreOlder,
    fetchOlder,
    isLoadingMore,
    items.length,
    selectedIndex,
  ]);

  useLayoutEffect(() => {
    schedulePrefetch();
  }, [schedulePrefetch]);

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
      setSelectedIndex((current) => {
        const nextIndex = current + 1;
        if (nextIndex === items.length - 1) {
          queueMicrotask(() => schedulePrefetch());
        }
        return nextIndex;
      });
      return;
    }

    if (effectiveHasMoreOlder !== true || isLoadingMore) {
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
    effectiveHasMoreOlder,
    fetchOlder,
    isLoadingMore,
    items.length,
    schedulePrefetch,
    selectedIndex,
  ]);

  const preview = items[selectedIndex];
  const canGoUp = selectedIndex > 0;
  const canGoDown =
    selectedIndex < items.length - 1 ||
    (effectiveHasMoreOlder === true && !isLoadingMore);
  const showNavigation =
    canGoUp || canGoDown || effectiveHasMoreOlder === null || isLoadingMore;

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
