import { createFileRoute, Link } from '@tanstack/react-router';
import { useEffect, useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Preview } from '../components/Preview';
import { saveSettings } from '../lib/api';
import { useEditQuery } from '../lib/queries';
import { CommentPosition, PostSettings, Theme } from '../../shared/types/api';

export const Route = createFileRoute('/edit')({
  component: EditPage,
});

const defaultSettings: PostSettings = {
  position: 'center',
  theme: 'dark',
  toolbarCollapsed: false,
};

function EditPage() {
  const { data } = useEditQuery();
  const [settings, setSettings] = useState<PostSettings>(defaultSettings);
  const [toast, setToast] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (data?.status === 'ok' && data.data.settings) {
      setSettings({
        ...defaultSettings,
        ...data.data.settings,
      });
      setCollapsed(data.data.settings.toolbarCollapsed);
    }
  }, [data]);

  const mutation = useMutation({
    mutationFn: saveSettings,
    onSuccess: () => {
      setToast('Settings saved!');
      setTimeout(() => setToast(null), 2000);
    },
    onError: () => {
      setToast('Failed to save.');
      setTimeout(() => setToast(null), 2000);
    },
  });

  const previewData = useMemo(() => {
    if (data?.status !== 'ok') return undefined;
    return {
      ...data.data,
      settings,
    };
  }, [data, settings]);

  const updateTheme = (theme: Theme) => {
    setSettings((prev) => ({ ...prev, theme }));
  };

  const updatePosition = (position: CommentPosition) => {
    setSettings((prev) => ({ ...prev, position }));
  };

  const reset = () => {
    setSettings(defaultSettings);
    setCollapsed(false);
  };

  const save = () => {
    mutation.mutate(settings);
  };

  const toggleCollapsed = () => {
    setCollapsed((prev) => !prev);
    setSettings((prev) => ({
      ...prev,
      toolbarCollapsed: !prev.toolbarCollapsed,
    }));
  };

  return (
    <div className="edit-container">
      <Preview data={previewData} fallbackText="No preview available." />

      <div className="top-bar">
        <Link className="icon-btn" to="/" title="Back">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M10 19l-7-7m0 0l7-7m-7 7h18"
            />
          </svg>
        </Link>
        <span className="top-bar-title">Edit</span>
        <button className="icon-btn save" type="button" onClick={save}>
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M5 13l4 4L19 7"
            />
          </svg>
        </button>
      </div>

      <div className={`toolbar ${collapsed ? 'collapsed' : ''}`}>
        <button
          className="toolbar-toggle"
          type="button"
          title="Toggle toolbar"
          onClick={toggleCollapsed}
        >
          <svg
            className="icon-chevron"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </button>

        <div className="toolbar-content">
          <div className="toolbar-section">
            <span className="toolbar-label">Theme</span>
            <div className="toggle-pills">
              <button
                className={`pill ${settings.theme === 'dark' ? 'active' : ''}`}
                data-theme="dark"
                type="button"
                title="Dark mode"
                onClick={() => updateTheme('dark')}
              >
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
                  />
                </svg>
              </button>
              <button
                className={`pill ${settings.theme === 'light' ? 'active' : ''}`}
                data-theme="light"
                type="button"
                title="Light mode"
                onClick={() => updateTheme('light')}
              >
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
                  />
                </svg>
              </button>
            </div>
          </div>

          <div className="toolbar-divider"></div>

          <div className="toolbar-section">
            <span className="toolbar-label">Position</span>
            <div className="position-grid">
              {(
                [
                  'top-left',
                  'top-center',
                  'top-right',
                  'center-left',
                  'center',
                  'center-right',
                  'bottom-left',
                  'bottom-center',
                  'bottom-right',
                ] as CommentPosition[]
              ).map((pos) => (
                <button
                  key={pos}
                  className={`pos-btn ${settings.position === pos ? 'active' : ''}`}
                  data-position={pos}
                  type="button"
                  onClick={() => updatePosition(pos)}
                />
              ))}
            </div>
          </div>

          <div className="toolbar-divider"></div>

          <button className="reset-btn" type="button" onClick={reset}>
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            Reset
          </button>
        </div>
      </div>

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
