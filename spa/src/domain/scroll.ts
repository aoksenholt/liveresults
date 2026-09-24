import type { Entry } from '../api/types';
import type { ClassInfo } from './model';
import { buildClassView, type ClassView } from './pipeline';
import { sortClasses } from './sorting';
import type { NormalizeOptions } from './time4o';

export interface ScrollOptions {
  /** 1-based positions in the class order, both included. */
  first: number;
  last: number;
  /** 5, the legacy default, scrolls 40 pixels a second. */
  speed: number;
}

/** The URL parameters of followallscroll.php. */
export function scrollOptions(params: URLSearchParams): ScrollOptions {
  const int = (name: string, fallback: number) => {
    const n = Number.parseInt(params.get(name) ?? '');
    return Number.isNaN(n) ? fallback : n;
  };
  const speed = Number.parseFloat(params.get('speed') ?? '');
  return {
    first: int('first', 1),
    last: int('last', 999),
    speed: speed > 0 ? speed : 5,
  };
}

/** Milliseconds between each pixel the page scrolls. */
export const scrollDelay = (speed: number) => 25 * (5 / speed);

/**
 * The classes shown, in the class menu order. The legacy page has its own copy of an
 * older class sort, which does not know the Time4o class order.
 */
export function scrollClasses(classes: ClassInfo[], { first, last }: ScrollOptions): ClassInfo[] {
  return sortClasses(classes)
    .slice(Math.max(first, 1) - 1, Math.max(last, 0))
    .filter((c) => c.className);
}

/** Class views without splits, as the legacy page asks the API for `nosplits`. */
export function scrollViews(
  entries: Entry[],
  classes: ClassInfo[],
  opts?: NormalizeOptions,
): ClassView[] {
  return classes.map((cls) =>
    buildClassView(
      { ...cls, splitcontrols: [], updatedSplits: [] },
      entries.filter((e) => e.raceClassId == cls.id),
      opts,
    ),
  );
}
