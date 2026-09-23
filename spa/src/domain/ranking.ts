import type { ResultRow, SplitControl, SplitValue } from './model';
import { isMissing, resultSorter, splitSort } from './sorting';

export interface RankingContext {
  isMassStart: boolean;
  splits: SplitControl[] | null;
}

const isRankable = (status: number) => status == 0 || status == 9 || status == 10;

export function checkForMassStart(results: ResultRow[] | null | undefined): boolean {
  if (!results) return false;
  const starts = results.map((r) => r.start).filter((s) => s != undefined && s > 0);
  if (starts.length == 0) return false;
  return Math.max(...starts) - Math.min(...starts) < 100;
}

export function sortByDist(a: ResultRow, b: ResultRow): number {
  if (a.progress == 0 && b.progress == 0) return compareNotStarted(a, b);
  return b.progress - a.progress;
}

function compareNotStarted(a: ResultRow, b: ResultRow): number {
  if (a.start && !b.start) return -1;
  if (!a.start && b.start) return 1;
  if (a.start == b.start) {
    if (a.bib != undefined && b.bib != undefined) return Math.abs(a.bib) - Math.abs(b.bib);
    return 0;
  }
  if (a.start == -999 || b.start == -999) return b.start - a.start;
  return a.start - b.start;
}

export function sortByDistAndSplitPlace(
  a: ResultRow,
  b: ResultRow,
  splits: SplitControl[] | null,
): number {
  const sortStatusA = a.status == 9 || a.status == 10 || a.status == 13 ? 0 : a.status;
  const sortStatusB = b.status == 9 || b.status == 10 || b.status == 13 ? 0 : b.status;
  if (sortStatusA != sortStatusB) {
    if (sortStatusA == 0) return -1;
    if (sortStatusB == 0) return 1;
    return sortStatusB - sortStatusA;
  }
  if (a.progress == 100 && b.progress == 100) {
    if (a.result != b.result) return a.result - b.result;
    if (a.place == '=' && b.place != '=') return 1;
    if (b.place == '=' && a.place != '=') return -1;
    if (a.place != b.place) return Number(a.place) - Number(b.place);
    if (a.bib != undefined && b.bib != undefined) return Math.abs(a.bib) - Math.abs(b.bib);
    if (a.dbid != undefined && b.dbid != undefined) return a.dbid - b.dbid;
    return 0;
  }
  if (a.progress == 0 && b.progress == 0) return compareNotStarted(a, b);
  if (a.progress == b.progress && a.progress > 0 && a.progress < 100 && splits != null) {
    for (let s = splits.length - 1; s >= 0; s--) {
      const key = splits[s]!.code + '_place';
      if (a.splits[key]) {
        const diff = Number(a.splits[key]) - Number(b.splits[key]);
        if (diff == 0 && a.bib != undefined && b.bib != undefined)
          return Math.abs(a.bib) - Math.abs(b.bib);
        return diff;
      }
    }
  }
  return b.progress - a.progress;
}

const isNumberAbove = (v: SplitValue | undefined, than: SplitValue) =>
  typeof v === 'number' && v > (than as number);

/**
 * Inserts a runner who has not finished at its virtual position. The runner is
 * assumed to have the same or less progress than everyone already in `data`.
 */
export function insertIntoResults(
  result: ResultRow,
  data: ResultRow[],
  splits: SplitControl[] | null,
): void {
  if (splits != null) {
    for (let s = splits.length - 1; s >= 0; s--) {
      const code = String(splits[s]!.code);
      const splitTime = result.splits[code];
      if (!splitTime) continue;
      let othersAtSplit = false;
      for (let i = 0; i < data.length; i++) {
        const splitTimeOther = data[i]!.splits[code];
        if (splitTimeOther) othersAtSplit = true;
        if (data[i]!.place == '-' || isNumberAbove(splitTimeOther, splitTime)) {
          data.splice(i, 0, result);
          return;
        }
      }
      if (othersAtSplit) {
        data.push(result);
        return;
      }
    }
  }
  // Legacy compares numbers with "" loosely, so a start time of 0 counts as no start time.
  if (result.start != 0) {
    const startTime = result.start == -999 ? 8640000 : result.start;
    for (let i = 0; i < data.length; i++) {
      const other = data[i]!;
      if (result.place == '' && other.place != '-' && other.place != '') continue;
      if (
        other.place == '-' ||
        (other.start != 0 && other.start > startTime && result.progress == 0 && other.progress == 0)
      ) {
        data.splice(i, 0, result);
        return;
      }
    }
  }
  data.push(result);
}

export function updateResultVirtualPosition(
  data: ResultRow[],
  ctx: RankingContext,
  updateIdx = true,
): void {
  if (ctx.isMassStart) {
    data.sort((a, b) => sortByDistAndSplitPlace(a, b, ctx.splits));
  } else {
    data.sort(resultSorter);
    let firstFinishedIdx = data.findIndex((item) => item.place != '');
    if (firstFinishedIdx == -1) firstFinishedIdx = data.length;
    const notFinished = data.splice(0, firstFinishedIdx);
    notFinished.sort(sortByDist);
    for (const r of notFinished) insertIntoResults(r, data, ctx.splits);
  }
  data.forEach((r, i) => {
    r.virtual_position = i;
    if (updateIdx) r.idx = i;
  });
}

// Time4o does not deliver place and time behind for pass, leg and lap times.
export function updateSplitPlaces(
  results: ResultRow[],
  classSplits: SplitControl[],
  updateSplits: boolean[],
): void {
  for (let sp = 0; sp < classSplits.length; sp++) {
    if (!updateSplits[sp]) continue;
    const code = classSplits[sp]!.code;
    results.sort(splitSort(sp, classSplits));

    let splitPlace = 1;
    let curSplitPlace = 1;
    let curSplitTime: SplitValue = '';
    let bestSplitTime: SplitValue = -1;
    let bestSplitKey = -1;
    let secondBest = false;

    for (let j = 0; j < results.length; j++) {
      const row = results[j]!;
      let spTime: SplitValue = '';
      const status =
        row.splits['999_status'] != undefined && code > 100000
          ? Number(row.splits['999_status'])
          : row.status;

      const spVal = row.splits[code];
      if (!isMissing(spVal)) {
        spTime = spVal;
        if ((bestSplitTime as number) < 0 && isRankable(status)) {
          bestSplitTime = spTime;
          bestSplitKey = j;
        }
      }

      if (spTime !== '') {
        row.splits[code + '_timeplus'] = (spTime as number) - (bestSplitTime as number);
        if (!secondBest && bestSplitKey > -1 && j != bestSplitKey && isRankable(status)) {
          results[bestSplitKey]!.splits[code + '_timeplus'] =
            (bestSplitTime as number) - (spTime as number);
          secondBest = true;
        }
      } else {
        row.splits[code + '_timeplus'] = -2;
      }

      if (curSplitTime !== spTime) curSplitPlace = splitPlace;

      if (isRankable(status)) {
        if (spTime !== '') {
          curSplitTime = spTime;
          row.splits[code + '_place'] = curSplitPlace;
          splitPlace++;
        }
      } else if (status == 13) {
        if (spTime !== '') row.splits[code + '_place'] = 'F';
      } else {
        row.splits[code + '_place'] = '-';
        row.splits[code + '_status'] = status;
      }
    }
  }
}
