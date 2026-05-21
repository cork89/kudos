import { createFileRoute, Link } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Preview } from '../components/Preview';
import { saveSettings } from '../lib/api';
import { patchPreviewSettingsCache, useEditQuery } from '../lib/queries';
import { CommentPosition, PostSettings, Theme } from '../../shared/types/api';

export const Route = createFileRoute('/edit')({
  component: EditPage,
});

const defaultSettings: PostSettings = {
  position: 'center',
  theme: 'dark',
  toolbarCollapsed: false,
};

function mergeSettings(saved?: PostSettings): PostSettings {
  return { ...defaultSettings, ...saved };
}

function EditPage() {
  const queryClient = useQueryClient();
  const { data } = useEditQuery();
  const [draft, setDraft] = useState<PostSettings | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const settings = useMemo(() => {
    if (data?.status !== 'ok') return defaultSettings;
    return draft ?? mergeSettings(data.data.settings);
  }, [data, draft]);

  const mutation = useMutation({
    mutationFn: saveSettings,
    onSuccess: (_response, savedSettings) => {
      patchPreviewSettingsCache(queryClient, ['edit'], savedSettings);
      patchPreviewSettingsCache(queryClient, ['home'], savedSettings);
      setDraft(null);
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

  const patchSettings = (patch: Partial<PostSettings>) => {
    setDraft((prev) => ({
      ...(prev ??
        (data?.status === 'ok'
          ? mergeSettings(data.data.settings)
          : defaultSettings)),
      ...patch,
    }));
  };

  const updateTheme = (theme: Theme) => {
    patchSettings({ theme });
  };

  const updatePosition = (position: CommentPosition) => {
    patchSettings({ position });
  };

  const reset = () => {
    setDraft(defaultSettings);
  };

  const save = () => {
    mutation.mutate(settings);
  };

  const toggleCollapsed = () => {
    patchSettings({ toolbarCollapsed: !settings.toolbarCollapsed });
  };

  return (
    <div className="edit-container">
      <Preview data={previewData} fallbackText="No preview available." />

      <div
        className={`toolbar ${settings.toolbarCollapsed ? 'collapsed' : ''}`}
      >
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
        </div>

        <div className="toolbar-actions">
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
      </div>

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
