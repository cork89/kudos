import { createFileRoute, Link } from '@tanstack/react-router';
import { Preview } from '../components/Preview';
import { useHomeQuery } from '../lib/queries';

export const Route = createFileRoute('/')({
  component: HomePage,
});

function HomePage() {
  const { data, isLoading, error } = useHomeQuery();

  const previewData = data?.status === 'ok' ? data.data : undefined;
  const fallback =
    data?.status === 'empty'
      ? data.message
      : 'Save a comment to preview it here.';

  return (
    <div className="container">
      <header>
        <div className="logo">
          <h1>Commenteer</h1>
        </div>
      </header>

      <main>
        <div className="canvas-area">
          <div className="canvas-header">
            <span className="canvas-title">Canvas Preview</span>
            <div className="canvas-meta">
              <span>{isLoading ? 'Loading' : '1 Comment'}</span>
              <span>{error ? 'Offline' : 'Updated'}</span>
            </div>
          </div>
          <div className="canvas-content">
            <Preview data={previewData} fallbackText={fallback} />

            <aside className="sidebar">
              <div className="action-group">
                <span className="action-group-title">Actions</span>
                <Link className="btn" to="/edit">
                  <span className="btn-icon">
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                      />
                    </svg>
                  </span>
                  <span className="btn-content">
                    <span className="btn-label">Edit</span>
                    <span className="btn-hint">Modify comments & markup</span>
                  </span>
                </Link>
                <div className="divider"></div>
                <Link className="btn" to="/view">
                  <span className="btn-icon">
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
                  <span className="btn-content">
                    <span className="btn-label">View</span>
                    <span className="btn-hint">Preview in full screen</span>
                  </span>
                </Link>
                <div className="divider"></div>
                <button className="btn" type="button" disabled>
                  <span className="btn-icon">
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                    </svg>
                  </span>
                  <span className="btn-content">
                    <span className="btn-label">Settings</span>
                    <span className="btn-hint">Preferences & config</span>
                  </span>
                </button>
              </div>
            </aside>
          </div>
        </div>
      </main>
    </div>
  );
}
