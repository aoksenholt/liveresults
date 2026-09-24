import { useState, useSyncExternalStore } from 'react';

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

/** A list of strings remembered in `localStorage` for the component that uses it. */
export function useStoredList(key: string): [string[], (list: string[]) => void] {
  const [list, setList] = useState<string[]>(() => {
    try {
      const stored: unknown = JSON.parse(window.localStorage.getItem(key) ?? '[]');
      return Array.isArray(stored) ? stored.filter((s) => typeof s == 'string') : [];
    } catch {
      return [];
    }
  });
  const save = (value: string[]) => {
    setList(value);
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // The list then only lasts for this page.
    }
  };
  return [list, save];
}
