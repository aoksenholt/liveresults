import { useEffect, useRef, useState } from 'react';

const listeners = new Set<() => void>();
let offset = 0;

/** How far down the top bar reaches into the window, so fixed table headers can sit below it. */
export const barOffset = () => offset;

export function onBarOffset(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// A few pixels of slack, so that small wobbles of touch scrolling do not flip the bar.
const SLACK = 4;

/**
 * Keeps the top bar at the top of the window like the liveresultat beta: it slides away while
 * the user scrolls down and comes back as soon as they scroll up.
 */
export function useTopBar(enabled: boolean) {
  const bar = useRef<HTMLDivElement>(null);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    let last = window.scrollY;
    let isHidden = false;
    const update = () => {
      const y = window.scrollY;
      const height = bar.current?.offsetHeight ?? 0;
      if (y <= height) isHidden = false;
      else if (y > last + SLACK) isHidden = true;
      else if (y < last - SLACK) isHidden = false;
      if (Math.abs(y - last) > SLACK) last = y;
      setHidden(isHidden);
      const next = isHidden ? 0 : height;
      if (next != offset) {
        offset = next;
        listeners.forEach((l) => l());
      }
    };
    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
      offset = 0;
      listeners.forEach((l) => l());
    };
  }, [enabled]);

  return [bar, enabled && hidden ? 'bar bar-hidden' : 'bar'] as const;
}
