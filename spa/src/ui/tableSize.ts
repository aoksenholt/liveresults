import { useLayoutEffect } from 'react';
import { storedNumber } from './stored';

export const MIN_TABLE_SIZE = 70;
export const MAX_TABLE_SIZE = 150;
export const DEFAULT_TABLE_SIZE = 100;
const STEP = 10;

/** The next size in percent, one step up or down, kept within the limits and on the steps. */
export function stepTableSize(size: number, direction: 1 | -1): number {
  const next = Math.round(size / STEP) * STEP + direction * STEP;
  return Math.min(MAX_TABLE_SIZE, Math.max(MIN_TABLE_SIZE, next));
}

/** A stored size edited by hand or from an older version falls back to the default. */
export function validTableSize(size: number): number {
  return size >= MIN_TABLE_SIZE && size <= MAX_TABLE_SIZE ? size : DEFAULT_TABLE_SIZE;
}

const useStoredSize = storedNumber('liveres-table-size', () => DEFAULT_TABLE_SIZE);

/** The text size of the result tables in percent, as the user chose with the size buttons. */
export function useTableSize(): [number, (size: number) => void] {
  const [size, save] = useStoredSize();
  return [validTableSize(size), save];
}

/** Scales the result tables of the page while the component is shown. */
export function useTableScale() {
  const [size] = useTableSize();
  useLayoutEffect(() => {
    const style = document.documentElement.style;
    style.setProperty('--table-scale', String(size / 100));
    return () => {
      style.removeProperty('--table-scale');
    };
  }, [size]);
}
