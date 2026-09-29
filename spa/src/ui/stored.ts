import { useState, useSyncExternalStore } from 'react';

/**
 * A choice remembered in `localStorage`, shared by every component that uses it.
 * `initial` gives the value until the user has chosen, or when the stored text does not parse.
 */
function storedValue<T>(
  key: string,
  initial: () => T,
  parse: (stored: string) => T | null,
  format: (value: T) => string,
): () => [T, (value: T) => void] {
  const listeners = new Set<() => void>();
  let fallback: T | null = null;

  // Even reading `localStorage` throws when the browser blocks it, e.g. in third-party iframes.
  const read = (): T => {
    try {
      const stored = window.localStorage.getItem(key);
      return (stored == null ? null : parse(stored)) ?? initial();
    } catch {
      return fallback ?? initial();
    }
  };

  const save = (value: T) => {
    fallback = value;
    try {
      window.localStorage.setItem(key, format(value));
    } catch {
      // The choice then only lasts for this page.
    }
    listeners.forEach((l) => l());
  };

  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  };

  return () => [useSyncExternalStore(subscribe, read), save];
}

/** An on/off choice remembered in `localStorage`; the setter flips it. */
export function storedFlag(key: string, initial: () => boolean): () => [boolean, () => void] {
  const use = storedValue(
    key,
    initial,
    (s) => s == '1',
    (v) => (v ? '1' : '0'),
  );
  return () => {
    const [value, save] = use();
    return [value, () => save(!value)];
  };
}

/** A whole number remembered in `localStorage`. */
export function storedNumber(
  key: string,
  initial: () => number,
): () => [number, (n: number) => void] {
  return storedValue(key, initial, (s) => (/^-?\d+$/.test(s) ? Number(s) : null), String);
}

/** One of a few named choices remembered in `localStorage`. */
export function storedChoice<T extends string>(
  key: string,
  choices: readonly T[],
  initial: () => T,
): () => [T, (value: T) => void] {
  return storedValue(
    key,
    initial,
    (s) => choices.find((c) => c == s) ?? null,
    (v) => v,
  );
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
