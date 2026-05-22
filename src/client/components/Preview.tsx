import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type AnimationEvent,
} from 'react';
import type {
  PreviewComment,
  PreviewData,
  PostSettings,
} from '../../shared/types/api';
import type { SlideDirection } from '../lib/preview';

export type { SlideDirection };

type PreviewProps = {
  preview?: PreviewData | undefined;
  settings?: PostSettings | undefined;
  fallbackText?: string | undefined;
  slideDirection?: SlideDirection | null;
  onSlideMotionComplete?: () => void;
};

type SlideLayers = {
  outgoing: PreviewData;
  incoming: PreviewData;
  direction: SlideDirection;
  outgoingSettings?: PostSettings | undefined;
};

const defaultSettings: PostSettings = {
  position: 'center',
  theme: 'dark',
  toolbarCollapsed: false,
};

const BLUR_FADE_MS = 800;

function getInitials(name?: string) {
  if (!name) return '??';
  const parts = name.trim().split(/\s+/);
  const initials = parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
  return initials || '??';
}

function CommentEntry({ comment }: { comment: PreviewComment }) {
  return (
    <div className="comment-entry">
      <div className="comment-header">
        <div className="comment-avatar">
          {comment.snoovatarUrl ? (
            <img src={comment.snoovatarUrl} alt="snoovatar" />
          ) : (
            <span>{getInitials(comment.authorName)}</span>
          )}
        </div>
        <span className="comment-author">{comment.authorName}</span>
      </div>
      <p className="comment-text">{comment.body}</p>
    </div>
  );
}

function PreviewFrame({
  preview,
  settings,
  className,
  onAnimationEnd,
}: {
  preview: PreviewData;
  settings?: PostSettings | undefined;
  className?: string | undefined;
  onAnimationEnd?:
    | ((event: AnimationEvent<HTMLDivElement>) => void)
    | undefined;
}) {
  const themeClass = settings?.theme === 'light' ? 'light-theme' : '';
  const positionClass = settings?.position
    ? `pos-${settings.position}`
    : 'pos-center';
  const hasParent = Boolean(preview.parentComment);

  return (
    <div
      className={`preview-slide-frame ${className ?? ''}`.trim()}
      onAnimationEnd={onAnimationEnd}
    >
      <div className="preview-slide-image">
        <img
          src={preview.post.imageUrl ?? '/default-loading.webp'}
          alt={preview.post.title ?? 'preview'}
        />
      </div>
      <div
        className={`comment-stack ${hasParent ? 'comment-stack-threaded' : 'comment-stack-solo'} ${positionClass} ${themeClass}`.trim()}
      >
        {hasParent && preview.parentComment ? (
          <>
            <CommentEntry comment={preview.parentComment} />
            <div className="comment-thread">
              <div className="thread-line" aria-hidden="true" />
              <CommentEntry comment={preview.comment} />
            </div>
          </>
        ) : (
          <CommentEntry comment={preview.comment} />
        )}
      </div>
    </div>
  );
}

export function Preview({
  preview,
  settings,
  fallbackText,
  slideDirection = null,
  onSlideMotionComplete,
}: PreviewProps) {
  const [layers, setLayers] = useState<SlideLayers | null>(null);
  const [isBlurFading, setIsBlurFading] = useState(false);
  const previewRef = useRef<PreviewData | undefined>(preview);
  const settingsRef = useRef<PostSettings | undefined>(
    settings ?? defaultSettings
  );

  useEffect(() => {
    settingsRef.current = settings ?? defaultSettings;
  }, [settings]);

  useEffect(() => {
    if (!preview) {
      previewRef.current = undefined;
      setLayers(null);
      return;
    }

    const previous = previewRef.current;
    if (
      !previous ||
      previous.commentId === preview.commentId ||
      !slideDirection
    ) {
      previewRef.current = preview;
      return;
    }

    setIsBlurFading(false);
    setLayers({
      outgoing: previous,
      incoming: preview,
      direction: slideDirection,
      outgoingSettings: settingsRef.current ?? defaultSettings,
    });
    previewRef.current = preview;
  }, [preview, slideDirection]);

  const finishSlide = useCallback(() => {
    setIsBlurFading(false);
    setLayers(null);
    settingsRef.current = settings ?? defaultSettings;
  }, [settings]);

  useEffect(() => {
    if (!isBlurFading) {
      return;
    }

    const timer = window.setTimeout(() => {
      finishSlide();
    }, BLUR_FADE_MS);

    return () => window.clearTimeout(timer);
  }, [finishSlide, isBlurFading]);

  useEffect(() => {
    if (!layers) {
      return;
    }

    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (!media.matches) {
      return;
    }

    const frame = requestAnimationFrame(() => {
      finishSlide();
    });

    return () => cancelAnimationFrame(frame);
  }, [finishSlide, layers]);

  const handleSlideEnd = (event: AnimationEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget || isBlurFading) {
      return;
    }

    setIsBlurFading(true);
    onSlideMotionComplete?.();
  };

  if (!preview) {
    return (
      <div className="image-container" id="image-container">
        <div className="comment-stack comment-stack-solo pos-center">
          <div className="comment-entry">
            <div className="comment-header">
              <div className="comment-avatar">??</div>
              <span className="comment-author">No data</span>
            </div>
            <p className="comment-text">
              {fallbackText ?? 'Save a comment to preview it here.'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (layers) {
    return (
      <div className="image-container" id="image-container">
        <div
          className={`preview-slide-stage ${isBlurFading ? 'is-blur-fading' : ''}`.trim()}
          data-direction={layers.direction}
        >
          {!isBlurFading ? (
            <PreviewFrame
              preview={layers.outgoing}
              settings={layers.outgoingSettings}
              className={`preview-slide-exit preview-slide-exit-${layers.direction}`}
            />
          ) : null}
          <PreviewFrame
            preview={layers.incoming}
            settings={settings}
            className={
              isBlurFading
                ? `preview-slide-settled preview-slide-enter-${layers.direction}`
                : `preview-slide-enter preview-slide-enter-${layers.direction}`
            }
            onAnimationEnd={handleSlideEnd}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="image-container" id="image-container">
      <PreviewFrame preview={preview} settings={settings} />
    </div>
  );
}
