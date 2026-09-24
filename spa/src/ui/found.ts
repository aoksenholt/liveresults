import { useSyncExternalStore } from 'react';
import type { ResultRow } from '../domain/model';

interface Found {
  className: string;
  dbid: number;
  bib: number;
}

let found: Found | null = null;
const listeners = new Set<() => void>();

function set(value: Found | null) {
  found = value;
  listeners.forEach((l) => l());
}

/** Marks a runner picked in the search, until its row has been highlighted. */
export const markFound = (row: ResultRow) =>
  set({ className: row.class, dbid: row.dbid, bib: row.bib });

export const clearFound = () => set(null);

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/** Tells whether a row of the class is the runner picked in the search. */
export function useFound(className: string): (row: ResultRow) => boolean {
  const f = useSyncExternalStore(subscribe, () => found);
  return (row) => f != null && f.className == className && f.dbid == row.dbid && f.bib == row.bib;
}

export const scrollToRow = (row: HTMLElement | null) =>
  row?.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
