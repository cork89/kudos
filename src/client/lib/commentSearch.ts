import type { PreviewData } from '../../shared/types/api';

function getCommentSearchValues(item: PreviewData): string[] {
  return [item.commentId, item.comment.id];
}

export function findCommentSearchIndex(
  items: PreviewData[],
  query: string
): number {
  const trimmed = query.trim();
  if (!trimmed) {
    return -1;
  }

  const needle = trimmed.toLowerCase();

  const exactIndex = items.findIndex((item) =>
    getCommentSearchValues(item).some((value) => value.toLowerCase() === needle)
  );
  if (exactIndex >= 0) {
    return exactIndex;
  }

  return items.findIndex((item) =>
    getCommentSearchValues(item).some((value) =>
      value.toLowerCase().includes(needle)
    )
  );
}
