import type { PreviewData } from '../../shared/types/api';

export type PreviewNavigationSnapshot = {
  items: PreviewData[];
  selectedCommentId: string;
  cursor: number | null;
  hasMoreOlder: boolean | null;
};

let savedSnapshot: PreviewNavigationSnapshot | null = null;
let restoreOnNextHomeMount = false;

export function savePreviewNavigationSnapshot(
  snapshot: PreviewNavigationSnapshot
) {
  savedSnapshot = snapshot;
}

export function requestPreviewNavigationRestore() {
  restoreOnNextHomeMount = true;
}

export function consumePreviewNavigationRestore(): PreviewNavigationSnapshot | null {
  if (!restoreOnNextHomeMount || !savedSnapshot) {
    return null;
  }

  restoreOnNextHomeMount = false;
  const snapshot = savedSnapshot;
  savedSnapshot = null;
  return snapshot;
}
