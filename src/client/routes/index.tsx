import { createFileRoute, Link } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import { Preview } from '../components/Preview';
import { usePreviewQuery, useSettingsQuery } from '../lib/queries';
import type { PostSettings } from '../../shared/types/api';

export const Route = createFileRoute('/')({
  component: HomePage,
});

const defaultSettings: PostSettings = {
  position: 'center',
  theme: 'dark',
  toolbarCollapsed: false,
};

function HomePage() {
  const { data: previewResponse } = usePreviewQuery();
  const preview =
    previewResponse?.status === 'ok' ? previewResponse.data : undefined;
  const { data: settingsResponse } = useSettingsQuery(preview?.commentId);
  const [viewMode, setViewMode] = useState(false);

  const settings = useMemo(() => {
    if (settingsResponse?.status === 'ok') {
      return settingsResponse.data;
    }
    return defaultSettings;
  }, [settingsResponse]);
  const fallback =
    previewResponse?.status === 'empty'
      ? previewResponse.message
      : 'Save a comment to preview it here.';

  return (
    <div className={`home-page ${viewMode ? 'view-mode' : ''}`}>
      <Preview preview={preview} settings={settings} fallbackText={fallback} />

      {viewMode ? (
        <button
          className="home-show-toggle"
          type="button"
          aria-label="Show controls"
          onClick={() => setViewMode(false)}
        >
          <span className="home-show-toggle-icon">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
              />
            </svg>
          </span>
        </button>
      ) : (
        <nav className="home-actions" aria-label="Page actions">
          {preview?.canEdit ? (
            <Link className="home-action-btn" to="/edit">
              <span className="home-action-btn-icon">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                  />
                </svg>
              </span>
              Edit
            </Link>
          ) : null}
          <button
            className="home-action-btn"
            type="button"
            onClick={() => setViewMode(true)}
          >
            <span className="home-action-btn-icon">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88"
                />
              </svg>
            </span>
            Hide
          </button>
        </nav>
      )}
    </div>
  );
}
