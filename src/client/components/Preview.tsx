import {
  useEffect,
  useEffectEvent,
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

type SlideAnimState = {
  layers: SlideLayers | null;
  isBlurFading: boolean;
};

const defaultSettings: PostSettings = {
  position: 'center',
  theme: 'dark',
  toolbarCollapsed: false,
};

const BLUR_FADE_MS = 800;
const initialAnimState: SlideAnimState = { layers: null, isBlurFading: false };

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
  const [animState, setAnimState] = useState<SlideAnimState>(initialAnimState);
  const previewRef = useRef<PreviewData | undefined>(preview);
  const settingsRef = useRef<PostSettings | undefined>(
    settings ?? defaultSettings
  );
  const prevPreviewRef = useRef(preview);
  const prevSlideDirectionRef = useRef(slideDirection);

  settingsRef.current = settings ?? defaultSettings;

  if (
    preview !== prevPreviewRef.current ||
    slideDirection !== prevSlideDirectionRef.current
  ) {
    prevPreviewRef.current = preview;
    prevSlideDirectionRef.current = slideDirection;

    if (!preview) {
      previewRef.current = undefined;
      setAnimState(initialAnimState);
    } else {
      const previous = previewRef.current;
      if (
        previous &&
        previous.commentId !== preview.commentId &&
        slideDirection
      ) {
        setAnimState({
          isBlurFading: false,
          layers: {
            outgoing: previous,
            incoming: preview,
            direction: slideDirection,
            outgoingSettings: settingsRef.current ?? defaultSettings,
          },
        });
      }
      previewRef.current = preview;
    }
  }

  const finishSlide = useEffectEvent(() => {
    setAnimState(initialAnimState);
    settingsRef.current = settings ?? defaultSettings;
  });

  useEffect(() => {
    if (!animState.isBlurFading) {
      return;
    }

    const timer = window.setTimeout(() => {
      finishSlide();
    }, BLUR_FADE_MS);

    return () => window.clearTimeout(timer);
  }, [animState.isBlurFading]);

  useEffect(() => {
    if (!animState.layers) {
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
  }, [animState.layers]);

  const handleSlideEnd = (event: AnimationEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget || animState.isBlurFading) {
      return;
    }

    setAnimState((current) => ({ ...current, isBlurFading: true }));
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

  if (animState.layers) {
    return (
      <div className="image-container" id="image-container">
        <div
          className={`preview-slide-stage ${animState.isBlurFading ? 'is-blur-fading' : ''}`.trim()}
          data-direction={animState.layers.direction}
        >
          {!animState.isBlurFading ? (
            <PreviewFrame
              preview={animState.layers.outgoing}
              settings={animState.layers.outgoingSettings}
              className={`preview-slide-exit preview-slide-exit-${animState.layers.direction}`}
            />
          ) : null}
          <PreviewFrame
            preview={animState.layers.incoming}
            settings={settings}
            className={
              animState.isBlurFading
                ? `preview-slide-settled preview-slide-enter-${animState.layers.direction}`
                : `preview-slide-enter preview-slide-enter-${animState.layers.direction}`
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
