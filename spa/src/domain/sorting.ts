import type { ResultRow, SplitControl, SplitEntry } from './model';

interface Sortable {
  order?: number | null;
  className?: string;
}

/**
 * Class order: explicit `order` first, then elite classes, then natural name
 * order (numbers padded), open/guest classes last, sprint heats in
 * prolog → quarter → semi → final order.
 */
export function sortClasses<T extends Sortable>(classes: T[]): T[] {
  const sortWeight = (cls: T) => {
    if (cls.order != null) return String(cls.order).padStart(10, '0');
    let key = (cls.className ?? '').toLowerCase();
    if (/(åpen|open|gjest|dir|utv)/i.test(key)) key = 'z' + key;
    if (/(-e| e|\d+e|elite|wre|nm)(\s*\d*)$/i.test(key)) key = 'a' + key;
    return key
      .replace(/\d+/g, (num) => num.padStart(3, '0'))
      .replace(/\s+/g, '')
      .replace(/[-+]/g, '')
      .replace(/prolog/gi, 'a')
      .replace(/(kvart|kv)/gi, 'b')
      .replace(/(semi|se)/gi, 'c')
      .replace(/finale/gi, 'd')
      .replace(/nmko(total|talt)?/gi, 'e');
  };
  return classes.slice().sort((a, b) => {
    const keyA = sortWeight(a);
    const keyB = sortWeight(b);
    if (keyA === keyB) return 0;
    return keyA < keyB ? -1 : 1;
  });
}

export function compareResults(a: ResultRow, b: ResultRow, unfinishedFirst: boolean): number {
  const aStatus = a.status == 13 ? 0 : a.status;
  const bStatus = b.status == 13 ? 0 : b.status;
  if (a.place != '' && b.place != '') {
    if (aStatus != bStatus) {
      if (aStatus == 0) return -1;
      if (bStatus == 0) return 1;
      return bStatus - aStatus;
    }
    if (a.result == b.result) {
      if (a.place == '=' && b.place != '=') return 1;
      if (b.place == '=' && a.place != '=') return -1;
      if (a.place != b.place) return Number(a.place) - Number(b.place);
      if (a.bib != undefined && b.bib != undefined) return a.bib - b.bib;
      if (a.dbid != undefined && b.dbid != undefined) return a.dbid - b.dbid;
      return 0;
    }
    return a.result - b.result;
  }
  if (a.place != '') return unfinishedFirst ? 1 : -1;
  if (b.place != '') return unfinishedFirst ? -1 : 1;
  return 0;
}

/** Finished runners ranked, unfinished runners first (they are re-inserted by virtual ranking). */
export const resultSorter = (a: ResultRow, b: ResultRow) => compareResults(a, b, true);

/** Finished runners first, then not finished, then disqualified. */
export const resultListSorter = (a: ResultRow, b: ResultRow) => compareResults(a, b, false);

export function startListSorter(a: ResultRow, b: ResultRow): number {
  if (a.start - b.start != 0) return a.start - b.start;
  if (a.bib - b.bib != 0) return a.bib - b.bib;
  return a.dbid - b.dbid;
}

export function isMissing(v: SplitEntry): v is undefined | '' {
  return v == undefined || v === '';
}

export function splitSort(split: number, classSplits: SplitControl[]) {
  const code = String(classSplits[split]!.code);
  return (a: ResultRow, b: ResultRow): number => {
    const aVal = a.splits[code];
    const bVal = b.splits[code];
    const aMissing = isMissing(aVal);
    const bMissing = isMissing(bVal);
    if (!aMissing && !bMissing) {
      if (aVal != bVal) return aVal < bVal ? -1 : 1;
      return 0;
    }
    if (aMissing && !bMissing) return 1;
    if (!aMissing && bMissing) return -1;
    return 0;
  };
}
