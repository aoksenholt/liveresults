import { useSyncExternalStore } from 'react';

/**
 * An on/off choice remembered in `localStorage`, shared by every component that uses it.
 * `initial` gives the value until the user has chosen.
 */
export function storedFlag(key: string, initial: () => boolean): () => [boolean, () => void] {
  const listeners = new Set<() => void>();
  let fallback: boolean | null = null;

  // Even reading `localStorage` throws when the browser blocks it, e.g. in third-party iframes.
  const read = (): boolean => {
    try {
      const stored = window.localStorage.getItem(key);
      return stored == null ? initial() : stored == '1';
    } catch {
      return fallback ?? initial();
    }
  };

  const save = (value: boolean) => {
    fallback = value;
    try {
      window.localStorage.setItem(key, value ? '1' : '0');
    } catch {
      // The choice then only lasts for this page.
    }
    listeners.forEach((l) => l());
  };

  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  };

  return () => {
    const value = useSyncExternalStore(subscribe, read);
    return [value, () => save(!value)];
  };
}
