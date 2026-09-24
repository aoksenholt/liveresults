import { useCallback, useEffect, useRef, type ReactNode } from 'react';
import { useNewLook } from './ThemeToggle';
import { barOffset, onBarOffset } from './topBar';

/**
 * A result table whose header row stays at the top of the window while the table is scrolled
 * past, as a fixed copy of the header like the liveresultat beta. `position: sticky` cannot do
 * it, since the table scrolls sideways in its own box, which it would then stick to, and moving
 * the header along with the page scroll lags behind it.
 */
export function ResultsTable({ head, children }: { head: ReactNode; children: ReactNode }) {
  const newLook = useNewLook();
  const scroll = useRef<HTMLDivElement>(null);
  const table = useRef<HTMLTableElement>(null);
  const float = useRef<HTMLDivElement>(null);
  const floatTable = useRef<HTMLTableElement>(null);

  const place = useCallback(() => {
    const [box, t, f, ft] = [scroll.current, table.current, float.current, floatTable.current];
    if (!box || !t || !f || !ft || !t.tHead) return;
    const rect = t.getBoundingClientRect();
    const top = barOffset();
    const show = rect.top < top && rect.bottom > top + t.tHead.getBoundingClientRect().height;
    f.style.display = show ? 'block' : 'none';
    if (!show) return;
    f.style.top = `${top}px`;
    f.style.left = `${box.getBoundingClientRect().left}px`;
    f.style.width = `${box.clientWidth}px`;
    ft.style.width = `${rect.width}px`;
    ft.style.transform = `translateX(${-box.scrollLeft}px)`;
    const cells = t.tHead.rows[0]?.cells ?? [];
    const copies = ft.tHead?.rows[0]?.cells ?? [];
    for (let i = 0; i < cells.length && i < copies.length; i++) {
      const copy = copies[i]!;
      const width = `${cells[i]!.getBoundingClientRect().width}px`;
      Object.assign(copy.style, { width, minWidth: width, maxWidth: width });
    }
    for (let i = 0; i < cells.length && i < copies.length; i++) {
      const copy = copies[i]!;
      if (!/fixed-(place|name)/.test(copy.className)) continue;
      copy.style.transform = '';
      const shift = cells[i]!.getBoundingClientRect().left - copy.getBoundingClientRect().left;
      copy.style.transform = `translateX(${shift}px)`;
    }
  }, []);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      if (!frame)
        frame = requestAnimationFrame(() => {
          frame = 0;
          place();
        });
    };
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    const stop = onBarOffset(update);
    return () => {
      stop();
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, [place]);
  useEffect(place);

  if (!newLook)
    return (
      <table className="results">
        {head}
        {children}
      </table>
    );
  return (
    <>
      <div className="table-scroll" ref={scroll} onScroll={place}>
        <table className="results" ref={table}>
          {head}
          {children}
        </table>
      </div>
      <div className="float-head" ref={float} aria-hidden="true">
        <table className="results" ref={floatTable}>
          {head}
        </table>
      </div>
    </>
  );
}
