import { useSyncExternalStore } from 'react';

const KEY = 'liveres-frozen';
const listeners = new Set<() => void>();
let fallback = false;

// Even reading `localStorage` throws when the browser blocks it, e.g. in third-party iframes.
function read(): boolean {
  try {
    return window.localStorage.getItem(KEY) == '1';
  } catch {
    return fallback;
  }
}

function save(frozen: boolean) {
  fallback = frozen;
  try {
    window.localStorage.setItem(KEY, frozen ? '1' : '0');
  } catch {
    // The choice then only lasts for this page.
  }
  listeners.forEach((l) => l());
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/** Whether place and name stay put while the splits scroll sideways, as the user chose. */
export function useFrozenColumns(): [boolean, () => void] {
  const frozen = useSyncExternalStore(subscribe, read);
  return [frozen, () => save(!frozen)];
}
