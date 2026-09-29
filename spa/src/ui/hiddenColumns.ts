import { useMemo, useSyncExternalStore } from 'react';
import { parseHiddenColumns, type HiddenColumns } from '../domain/columns';

const listeners = new Set<() => void>();
const fallback = new Map<string, string>();

const storageKey = (raceId: string) => `liveres-columns-${raceId}`;

// Even reading `localStorage` throws when the browser blocks it, e.g. in third-party iframes.
function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return fallback.get(key) ?? null;
  }
}

function save(key: string, hidden: HiddenColumns) {
  const text = JSON.stringify(hidden);
  fallback.set(key, text);
  try {
    window.localStorage.setItem(key, text);
  } catch {
    // The choice then only lasts for this page.
  }
  listeners.forEach((l) => l());
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/** The columns hidden in a race, shared by the tables side by side. */
export function useHiddenColumns(
  raceId: string | undefined,
): [HiddenColumns, (h: HiddenColumns) => void] {
  const key = raceId === undefined ? null : storageKey(raceId);
  const stored = useSyncExternalStore(subscribe, () => (key ? read(key) : null));
  const hidden = useMemo(() => parseHiddenColumns(stored), [stored]);
  return [hidden, (h) => key && save(key, h)];
}
