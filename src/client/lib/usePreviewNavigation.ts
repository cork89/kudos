import { useQueryClient } from '@tanstack/react-query';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import type { ApiPreviewResponse, PreviewData } from '../../shared/types/api';
import type { SlideDirection } from './preview';
import { fetchPreview, fetchPreviewByCommentId } from './api';
import { findCommentSearchIndex } from './commentSearch';
import { getPreviewCursor, getPreviewList } from './preview';
import { prefetchSettings } from './queries';
import {
  consumePreviewNavigationRestore,
  savePreviewNavigationSnapshot,
} from './previewNavigationState';

type NavigationSnapshot = {
  items: PreviewData[];
  selectedIndex: number;
  cursor: number | null;
  hasMoreOlder: boolean | null;
};

function getSnapshotFromResponse(
  previewResponse: ApiPreviewResponse | undefined
): NavigationSnapshot {
  if (previewResponse?.status !== 'ok') {
    return {
      items: [],
      selectedIndex: 0,
      cursor: null,
      hasMoreOlder: null,
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

function getInitialSnapshot(
  previewResponse: ApiPreviewResponse | undefined
): NavigationSnapshot {
  const restored = consumePreviewNavigationRestore();
  if (restored) {
    const selectedIndex = restored.items.findIndex(
      (item) => item.commentId === restored.selectedCommentId
    );
    if (selectedIndex >= 0) {
      return {
        items: restored.items,
        selectedIndex,
        cursor: restored.cursor,
        hasMoreOlder: restored.hasMoreOlder,
      };
    }
  }

  return getSnapshotFromResponse(previewResponse);
}

function prefetchSettingsForItems(
  queryClient: ReturnType<typeof useQueryClient>,
  items: PreviewData[]
) {
  for (const item of items) {
    void prefetchSettings(queryClient, item.commentId);
  }
}

export function usePreviewNavigation(
  previewResponse: ApiPreviewResponse | undefined
) {
  const queryClient = useQueryClient();
  const initialSnapshotRef = useRef<NavigationSnapshot | null>(null);
  if (initialSnapshotRef.current === null) {
    initialSnapshotRef.current = getInitialSnapshot(previewResponse);
  }
  const initialSnapshot = initialSnapshotRef.current;
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
  const navigationRef = useRef({
    items: initialSnapshot.items,
    selectedIndex: initialSnapshot.selectedIndex,
    cursor: initialSnapshot.cursor,
    hasMoreOlder: initialSnapshot.hasMoreOlder,
  });

  navigationRef.current = { items, selectedIndex, cursor, hasMoreOlder };

  useEffect(() => {
    console.log(
      'comment ids',
      items.map((item) => item.commentId)
    );
  }, [items]);

  useEffect(() => {
    return () => {
      const {
        items: currentItems,
        selectedIndex: currentIndex,
        cursor: currentCursor,
        hasMoreOlder: currentHasMoreOlder,
      } = navigationRef.current;
      const selectedCommentId = currentItems[currentIndex]?.commentId;
      if (!selectedCommentId) {
        return;
      }

      savePreviewNavigationSnapshot({
        items: currentItems,
        selectedCommentId,
        cursor: currentCursor,
        hasMoreOlder: currentHasMoreOlder,
      });
    };
  }, []);

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
      prefetchSettingsForItems(queryClient, nextItems);
      setCursor(nextCursor);
      const hasMore = nextCursor !== null;
      setHasMoreOlder(hasMore);
      return { added: nextItems.length, hasMore };
    } finally {
      setIsLoadingMore(false);
    }
  }, [cursor, isLoadingMore, queryClient]);

  const prefetchAdjacentSettings = useCallback(() => {
    const neighborIds = [
      items[selectedIndex - 1]?.commentId,
      items[selectedIndex + 1]?.commentId,
    ].filter(Boolean) as string[];

    for (const commentId of neighborIds) {
      void prefetchSettings(queryClient, commentId);
    }
  }, [items, queryClient, selectedIndex]);

  useLayoutEffect(() => {
    prefetchAdjacentSettings();
  }, [prefetchAdjacentSettings]);

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

  const goToCommentId = useCallback(
    async (
      query: string
    ): Promise<{ ok: true } | { ok: false; error: string }> => {
      const trimmed = query.trim();
      if (!trimmed) {
        return { ok: false, error: 'Enter a comment ID' };
      }

      const navigateToIndex = (index: number) => {
        setSlideDirection(
          index > selectedIndex ? 'down' : index < selectedIndex ? 'up' : null
        );
        setSelectedIndex(index);
      };

      const matchIndex = findCommentSearchIndex(items, trimmed);
      if (matchIndex >= 0) {
        navigateToIndex(matchIndex);
        return { ok: true };
      }

      const response = await fetchPreviewByCommentId(trimmed);
      if (response.status !== 'ok') {
        return {
          ok: false,
          error: response.message ?? 'Comment not found',
        };
      }

      let targetIndex = -1;
      setItems((current) => {
        const duplicateIndex = current.findIndex(
          (item) => item.commentId === trimmed
        );
        if (duplicateIndex >= 0) {
          targetIndex = duplicateIndex;
          return current;
        }

        targetIndex = current.length;
        return [...current, response.data];
      });

      if (targetIndex < 0) {
        return { ok: false, error: 'Comment not found' };
      }

      navigateToIndex(targetIndex);
      return { ok: true };
    },
    [items, selectedIndex]
  );

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
    goToCommentId,
  };
}
