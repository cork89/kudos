import type {
  PreviewComment,
  PreviewData,
  PostSettings,
} from '../../shared/types/api';

type PreviewProps = {
  preview?: PreviewData | undefined;
  settings?: PostSettings | undefined;
  fallbackText?: string | undefined;
};

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

export function Preview({ preview, settings, fallbackText }: PreviewProps) {
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

  const themeClass = settings?.theme === 'light' ? 'light-theme' : '';
  const positionClass = settings?.position
    ? `pos-${settings.position}`
    : 'pos-center';
  const hasParent = Boolean(preview.parentComment);

  return (
    <div className="image-container" id="image-container">
      <img
        src={preview.post.imageUrl ?? '/default-loading.webp'}
        alt={preview.post.title ?? 'preview'}
      />
      <div
        className={`comment-stack ${hasParent ? 'comment-stack-threaded' : 'comment-stack-solo'} ${positionClass} ${themeClass}`.trim()}
        id="comment-overlay"
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
