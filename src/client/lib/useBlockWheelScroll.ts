import { useEffect, type RefObject } from 'react';

export function useBlockWheelScroll(
  containerRef: RefObject<HTMLElement | null>
) {
  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const blockWheel = (event: WheelEvent) => {
      event.preventDefault();
    };

    container.addEventListener('wheel', blockWheel, { passive: false });
    return () => container.removeEventListener('wheel', blockWheel);
  }, [containerRef]);
}
