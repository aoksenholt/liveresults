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

const PHONE = '(max-width: 600px)';

let slot: HTMLElement | null = null;

/**
 * On phones the class toolbar inside this element takes the place of the top bar: it comes back
 * when the user scrolls up, so another class is one tap away, and the race name, which already
 * shows at the top of the page, no longer covers the toolbar on the way up.
 */
export function toolbarSlot(element: HTMLElement | null) {
  slot = element;
}

function dock(toolbar: HTMLElement, docked: boolean, shown: boolean) {
  const was = toolbar.classList.contains('docked');
  if (docked && !was) {
    slot!.style.minHeight = `${slot!.offsetHeight}px`;
    toolbar.classList.add('docked');
    // The toolbar must not slide past the eyes when it is first moved out of sight.
    requestAnimationFrame(() => toolbar.classList.add('dock-slide'));
  } else if (!docked && was) {
    toolbar.classList.remove('docked', 'dock-slide', 'dock-shown');
    slot!.style.minHeight = '';
  }
  toolbar.classList.toggle('dock-shown', docked && shown);
}

/**
 * Keeps the top bar at the top of the window like the liveresultat beta: it slides away while
 * the user scrolls down and comes back as soon as they scroll up.
 */
export function useTopBar(enabled: boolean) {
  const bar = useRef<HTMLElement>(null);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    let last = window.scrollY;
    let isHidden = false;
    const update = () => {
      const y = window.scrollY;
      const phone = window.matchMedia?.(PHONE).matches ?? false;
      const height = phone ? 0 : (bar.current?.offsetHeight ?? 0);
      if (y <= height) isHidden = false;
      else if (y > last + SLACK) isHidden = true;
      else if (y < last - SLACK) isHidden = false;
      if (Math.abs(y - last) > SLACK) last = y;
      setHidden(isHidden && !phone);
      const toolbar = slot?.firstElementChild as HTMLElement | null;
      let next = isHidden ? 0 : height;
      if (toolbar) {
        const place = slot!.getBoundingClientRect();
        const wasDocked = toolbar.classList.contains('docked');
        const docked = phone && (wasDocked ? place.top < 0 : place.bottom < 0);
        dock(toolbar, docked, !isHidden);
        if (docked && !isHidden) next = toolbar.offsetHeight;
      }
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
