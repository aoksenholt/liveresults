import type { Entry } from '../api/types';
import type { ClassInfo, ClassResults, SplitControl } from './model';
import { checkRadioControls, updateClassSplitsBest } from './radio';
import { checkForMassStart, updateResultVirtualPosition, updateSplitPlaces } from './ranking';
import { classResults, type NormalizeOptions } from './time4o';

export interface ClassFlags {
  /** Relay legs and chase starts: the class starts with an exchange control (code 0). */
  isRelay: boolean;
  lapTimes: boolean;
  isUnranked: boolean;
  hasBibs: boolean;
  isMassStart: boolean;
  numSplits: number;
}

export interface ClassView extends ClassResults, ClassFlags {
  /** Per displayed split: 0 = bad (hidden), otherwise the fraction of runners with a valid time. */
  splitsStatus: number[];
  /** Sorted times per displayed split, the last entry is the finish. */
  splitsBest: number[][];
  shortSprint: boolean;
}

export function classFlags(splits: SplitControl[], results: ClassResults['results']): ClassFlags {
  const isRelay = splits[0]?.code === 0;
  const lapTimes = !isRelay && splits.length > 1 && splits.at(-1)?.code === 999;
  const numSplits = isRelay
    ? splits.length / 2 - 1
    : lapTimes
      ? (splits.length - 1) / 2
      : splits.length;
  return {
    isRelay,
    lapTimes,
    isUnranked: splits.some((s) => s.code === -999) || results.some((r) => r.status === 13),
    hasBibs: results[0]?.bib != undefined && results[0].bib != 0,
    isMassStart: checkForMassStart(results) || isRelay,
    numSplits,
  };
}

export function buildClassView(
  cls: ClassInfo,
  entries: Entry[],
  opts?: NormalizeOptions,
): ClassView {
  const data = classResults(entries, cls, opts);
  if (data.updatedSplits.some(Boolean))
    updateSplitPlaces(data.results, data.splitcontrols, data.updatedSplits);
  const flags = classFlags(data.splitcontrols, data.results);
  const { splitsStatus, shortSprint } = checkRadioControls(data.results, data.splitcontrols, flags);
  const splitsBest = updateClassSplitsBest(data.results, data.splitcontrols, flags);
  updateResultVirtualPosition(data.results, {
    isMassStart: flags.isMassStart,
    splits: data.splitcontrols,
  });
  return { ...data, ...flags, splitsStatus, splitsBest, shortSprint };
}
