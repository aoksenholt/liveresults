import { useSyncExternalStore } from 'react';

const names = new Map<string, string>();
const listeners = new Set<() => void>();
let version = 0;

/** Names pages outside the class menu, such as clubs, for their tabs. */
export function namePage(hash: string, name: string) {
  if (!name || names.get(hash) == name) return;
  names.set(hash, name);
  version++;
  listeners.forEach((l) => l());
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export function usePageName(): (hash: string) => string | undefined {
  useSyncExternalStore(subscribe, () => version);
  return (hash) => names.get(hash);
}
