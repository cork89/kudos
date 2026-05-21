import type { PreviewData } from "../../shared/types/api";

type PreviewProps = {
  data?: PreviewData;
  fallbackText?: string;
};

function getInitials(name?: string) {
  if (!name) return "??";
  const parts = name.trim().split(/\s+/);
  const initials = parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
  return initials || "??";
}

export function Preview({ data, fallbackText }: PreviewProps) {
  if (!data) {
    return (
      <div className="image-container" id="image-container">
        <div className="comment-overlay">
          <div className="comment-header">
            <div className="comment-avatar">??</div>
            <span className="comment-author">No data</span>
          </div>
          <p className="comment-text">
            {fallbackText ?? "Save a comment to preview it here."}
          </p>
        </div>
      </div>
    );
  }

  const themeClass = data.settings?.theme === "light" ? "light-theme" : "";
  const positionClass = data.settings?.position
    ? `pos-${data.settings.position}`
    : "pos-center";

  return (
    <div className="image-container" id="image-container">
      <img
        src={data.post.imageUrl ?? "/default-loading.webp"}
        alt={data.post.title ?? "preview"}
      />
      <div
        className={`comment-overlay ${positionClass} ${themeClass}`.trim()}
        id="comment-overlay"
      >
        <div className="comment-header">
          <div className="comment-avatar">
            {data.comment.snoovatarUrl ? (
              <img src={data.comment.snoovatarUrl} alt="snoovatar" />
            ) : (
              <span>{getInitials(data.comment.authorName)}</span>
            )}
          </div>
          <span className="comment-author">{data.comment.authorName}</span>
        </div>
        <p className="comment-text">{data.comment.body}</p>
      </div>
    </div>
  );
}
