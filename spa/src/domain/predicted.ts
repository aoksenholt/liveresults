import { findRank } from './format';
import type { ResultRow } from './model';
import type { ClassView } from './pipeline';
import { splitRef } from './radio';
import { updateResultVirtualPosition } from './ranking';
import { DEFAULT_TIME_ZONE, toHundredthsSinceMidnight } from './time4o';

export interface RunningTime {
  /** Hundredths since the runner's start. */
  elapsed: number;
  /** Displayed split the runner is heading for; `numSplits` is the finish. */
  nextSplit: number;
  /** Provisional rank at `nextSplit`, null when unknown. */
  rank: number | null;
  /** Hundredths behind the best time at `nextSplit`, null when there is no best time. */
  timeDiff: number | null;
}

export interface Predictions {
  /** Per row of `view.results`, null when the runner is not on course. */
  running: (RunningTime | null)[];
  /** Predicted virtual position per row of `view.results`, null when predicted ranking is off. */
  virtualPositions: number[] | null;
  /** Some runner has not finished; legacy stops polling otherwise. */
  active: boolean;
}

const predOffset = 1500;
const rankedStartListMinTimeDiff = -120 * 100;
const predRankStatusMin = 0.9;

/** The event's wall clock in hundredths since midnight, in whole seconds, corrected by the server time offset. */
export function eventClock(
  nowMs: number,
  serverTimeDiffMs = 0,
  timeZone = DEFAULT_TIME_ZONE,
): number {
  const wholeSeconds = new Date(Math.floor(nowMs / 1000) * 1000).toISOString();
  const local = toHundredthsSinceMidnight(wholeSeconds, timeZone);
  return 100 * Math.round(local / 100 - serverTimeDiffMs / 1000);
}

/**
 * Running times, provisional ranks and predicted order for runners on course,
 * ported from the legacy `updatePredictedTimes` without the table rendering.
 * `predData` is a deep copy of `view.results` taken when the data arrived; like
 * legacy it accumulates predictions between calls.
 */
export function updatePredictedTimes(
  view: ClassView,
  predData: ResultRow[],
  time: number,
  rankedStartlist = true,
): Predictions {
  const data = view.results;
  const splits = view.splitcontrols;
  const numSplits = view.numSplits;
  const status = view.splitsStatus;
  const best = view.splitsBest;
  const predict = !view.isRelay && !view.lapTimes;

  let firstOKSplit = numSplits;
  for (let sp = 0; sp < numSplits; sp++) {
    if (status[sp]! > 0) {
      firstOKSplit = sp;
      break;
    }
  }

  const running: (RunningTime | null)[] = data.map(() => null);
  let active = false;

  for (let i = 0; i < data.length; i++) {
    const r = data[i]!;
    if (r.status != 10 && r.status != 9) continue;
    active = true;
    if (!(r.start > 0)) continue;
    let elapsedTime = time - r.start;
    if (elapsedTime < -18 * 3600 * 100) elapsedTime += 24 * 3600 * 100;
    if (elapsedTime < 0) continue;
    const pred = predData[i]!;

    if (splits.length == 0) {
      if (view.isUnranked) {
        running[i] = { elapsed: elapsedTime, nextSplit: 0, rank: null, timeDiff: null };
        continue;
      }
      let rank: number | null = null;
      let timeDiff: number | null = null;
      let rankTimeDiff = rankedStartListMinTimeDiff - 1;
      if (best[0]![0]! > 0) {
        const found = findRank(best[0]!, elapsedTime);
        rank = found > 1 ? found : null;
        timeDiff = rankTimeDiff = elapsedTime - best[0]![0]!;
      }
      running[i] = { elapsed: elapsedTime, nextSplit: 0, rank, timeDiff };
      if (
        rankedStartlist &&
        rankTimeDiff > rankedStartListMinTimeDiff &&
        predict &&
        r.progress == 0
      )
        markPredictedFinish(pred, elapsedTime);
      continue;
    }

    let lastOKSplit = numSplits;
    let nextSplit = firstOKSplit;
    for (let sp = numSplits - 1; sp >= 0; sp--) {
      if (!isNaN(parseInt(String(r.splits[splits[splitRef(sp, view)]!.code])))) {
        nextSplit = lastOKSplit;
        break;
      }
      if (status[sp]! > 0) lastOKSplit = sp;
    }

    if (view.isUnranked) {
      running[i] = { elapsed: elapsedTime, nextSplit, rank: null, timeDiff: null };
      continue;
    }

    let rank: number | null = null;
    let timeDiff: number | null = null;
    let rankTimeDiff = rankedStartListMinTimeDiff - 1;
    const bestAt = best[nextSplit]!;
    if (bestAt[0] != 0) {
      if (view.isRelay) {
        const timeRelay = time + (time < 6 * 3600 * 100 ? 24 * 3600 * 100 : 0);
        timeDiff = timeRelay - bestAt[0]!;
        rank = findRank(bestAt, timeRelay);
      } else {
        timeDiff = elapsedTime - bestAt[0]!;
        rank = findRank(bestAt, elapsedTime);
      }
      rankTimeDiff = timeDiff;
    }
    running[i] = { elapsed: elapsedTime, nextSplit, rank, timeDiff };

    if (!predict) continue;
    if (
      nextSplit == 0 &&
      status[0]! > predRankStatusMin &&
      rankedStartlist &&
      rankTimeDiff > rankedStartListMinTimeDiff
    ) {
      pred.splits[splits[0]!.code] = Math.max(
        elapsedTime / (predOffset + 1),
        elapsedTime - predOffset,
      );
      pred.progress = (100.0 * 1) / (numSplits + 1);
      pred.place = '';
      continue;
    }
    for (let j = i + 1; j < data.length; j++) {
      const other = data[j]!;
      if (other.status != 0 && other.status != 9 && other.status != 10) break;
      if (
        !view.shortSprint &&
        nextSplit == numSplits &&
        other.status == 0 &&
        elapsedTime - predOffset > parseInt(String(other.result))
      ) {
        markPredictedFinish(pred, elapsedTime);
        break;
      }
      if (nextSplit < numSplits && status[nextSplit]! > predRankStatusMin) {
        const code = splits[nextSplit]!.code;
        const otherSplit = parseInt(String(other.splits[code]));
        if (otherSplit > 0) {
          if (elapsedTime - predOffset > otherSplit) {
            pred.splits[code] = elapsedTime - predOffset;
            pred.progress = (100.0 * (nextSplit + 1)) / (numSplits + 1);
            pred.place = '';
          }
          break;
        }
      }
    }
  }

  let virtualPositions: number[] | null = null;
  if (!view.isMassStart && !view.isRelay && !view.isUnranked && !view.lapTimes) {
    const tmpPredData = predData.slice(0, data.length);
    updateResultVirtualPosition(tmpPredData, { isMassStart: false, splits }, false);
    virtualPositions = data.map((r) => r.virtual_position!);
    for (const p of tmpPredData) virtualPositions[p.idx!] = p.virtual_position!;
  }

  return { running, virtualPositions, active };
}

function markPredictedFinish(pred: ResultRow, elapsedTime: number) {
  pred.result = Math.max(elapsedTime / (predOffset + 1), elapsedTime - predOffset);
  pred.progress = 100;
  pred.place = 'p';
  pred.status = 0;
}

/**
 * Legacy clock offset to the Time4o server (local minus server, ms), updated
 * from a response's Date header only when it moved more than the request's uncertainty.
 */
export function serverTimeDiff(
  current: number,
  serverDateMs: number,
  requestStartMs: number,
  responseMs: number,
): number {
  const uncertainty = Math.max(1000, responseMs - requestStartMs);
  const diff = responseMs - (serverDateMs + 500);
  return Math.abs(diff - current) > 1.5 * uncertainty ? diff : current;
}
