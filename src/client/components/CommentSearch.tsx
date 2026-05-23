import { useEffect, useId, useRef, useState } from 'react';

type CommentSearchProps = {
  onSearch: (
    commentId: string
  ) => Promise<{ ok: true } | { ok: false; error: string }>;
};

function SearchIcon() {
  return (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
      />
    </svg>
  );
}

export function CommentSearch({ onSearch }: CommentSearchProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();
  const errorId = useId();

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const frame = requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node) || !rootRef.current?.contains(target)) {
        setIsOpen(false);
        setError(null);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
        setError(null);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const submit = async () => {
    setIsSearching(true);
    setError(null);
    try {
      const result = await onSearch(value);
      if (!result.ok) {
        setError(result.error);
        return;
      }

      setIsOpen(false);
      setValue('');
      setError(null);
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="home-comment-search" ref={rootRef}>
      {isOpen ? (
        <form
          className="home-comment-search-form"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <label className="home-comment-search-label" htmlFor={inputId}>
            Search code
          </label>
          <div className="home-comment-search-row">
            <input
              ref={inputRef}
              id={inputId}
              className="home-comment-search-input"
              type="text"
              value={value}
              placeholder="comment42"
              autoComplete="off"
              spellCheck={false}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? errorId : undefined}
              disabled={isSearching}
              onChange={(event) => {
                setValue(event.target.value);
                if (error) {
                  setError(null);
                }
              }}
            />
            <button
              className="home-comment-search-submit"
              type="submit"
              disabled={isSearching || !value.trim()}
            >
              {isSearching ? '…' : 'Go'}
            </button>
          </div>
          {error ? (
            <p className="home-comment-search-error" id={errorId} role="alert">
              {error}
            </p>
          ) : null}
        </form>
      ) : null}
      <button
        className="home-action-btn"
        type="button"
        aria-label="Find kudos"
        aria-expanded={isOpen}
        aria-controls={isOpen ? inputId : undefined}
        onClick={() => {
          setIsOpen((current) => !current);
          setError(null);
        }}
      >
        <span className="home-action-btn-icon">
          <SearchIcon />
        </span>
      </button>
    </div>
  );
}
