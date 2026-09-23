import type { ResultRow, SplitControl, SplitEntry } from './model';
import { updateResultVirtualPosition, updateSplitPlaces } from './ranking';

export interface RadioFlags {
  isRelay: boolean;
  lapTimes: boolean;
  isUnranked: boolean;
  isMassStart: boolean;
  numSplits: number;
}

export interface RadioCheck {
  /** Per displayed split: 0 = bad (hidden), otherwise the fraction of runners with a valid time. */
  splitsStatus: number[];
  /** The average time from the last split to finish is under 90 seconds. */
  shortSprint: boolean;
}

interface SplitParams {
  median: number;
  medianDev: number;
  numFractions: number;
  a: number;
  b: number | null;
  max: number;
  min: number;
}

type SplitRefFlags = Pick<RadioFlags, 'isRelay' | 'lapTimes'>;

export function splitRef(sp: number, flags: SplitRefFlags): number {
  if (flags.isRelay) return sp * 2 + 2;
  if (flags.lapTimes) return sp * 2 + 1;
  return sp;
}

export function refSplit(spRef: number, flags: SplitRefFlags): number {
  if (flags.isRelay) return Math.floor((spRef - 1) / 2);
  if (flags.lapTimes) return Math.floor(spRef / 2);
  return spRef;
}

/** Average of the middle `fraction` of the values; `fraction = 0` gives the median. Sorts `arr`. */
export function medianFrac(arr: number[], fraction = 0): number | null {
  const length = arr.length;
  if (length == 0 || fraction < 0 || fraction > 1) return null;
  if (length == 1) return arr[0]!;
  const nums = arr.sort((a, b) => a - b);
  const nValues = Math.max(1, fraction * length);
  const min = length / 2 - nValues / 2;
  const max = length / 2 + nValues / 2;
  const indMin = Math.floor(min);
  const indMax = Math.floor(max);
  let sumVal = 0;
  for (let i = indMin; i <= indMax; i++) {
    if (i == indMin) sumVal += (indMin + 1 - min) * nums[i]!;
    else if (i == indMax) sumVal += (max - indMax) * nums[i]!;
    else sumVal += nums[i]!;
  }
  return sumVal / nValues;
}

const int = (v: unknown) => parseInt(String(v));

const isFinished = (r: ResultRow) =>
  (r.place != undefined && Number(r.place) > 0) || r.place == '=';

const isRankable = (status: number) => status == 0 || status == 9 || status == 10;

const isFraction = (f: number | null): f is number => f != null && f > 0 && f < 1;

const estimateFrac = (par: SplitParams, j: number) =>
  Math.max(par.min, Math.min(par.max, par.a * j + (par.b ?? 0)));

/**
 * Quality check of radio controls and estimation of missing passing times,
 * ported from the legacy `checkRadioControls`. Mutates and re-sorts `results`.
 */
export function checkRadioControls(
  results: ResultRow[],
  classSplits: SplitControl[],
  flags: RadioFlags,
): RadioCheck {
  const numSplits = flags.numSplits;
  const initial: RadioCheck = { splitsStatus: new Array(numSplits).fill(1), shortSprint: false };
  // Legacy tests `curClassIsLapTimes`, which is never assigned, so lap-time classes are checked too.
  if (flags.isUnranked || classSplits.length == 0) return initial;

  const validateLim = 0.333;
  const minNum = 3;
  const sprintTimeLim = 90;
  const ref = (sp: number) => splitRef(sp, flags);
  const codeAt = (spRef: number) => classSplits[spRef]!.code;

  updateResultVirtualPosition(results, { isMassStart: flags.isMassStart, splits: classSplits });
  const numRunners = results.length;
  const runnerOK = new Array<boolean>(numRunners).fill(true);
  const laterSplitOKj = new Array<boolean>(numRunners).fill(false);
  const shiftedSplits = new Array<boolean>(numRunners).fill(false);
  let raceOK = true;

  const classSplitsStatus = new Array<number>(numSplits).fill(1);
  for (let sp = numSplits - 1; sp >= 0; sp--) {
    let OKSum = 0;
    let statusN = 0;
    for (let j = 0; j < numRunners; j++) {
      const r = results[j]!;
      if (!isRankable(r.status)) continue;

      const finishOK = isFinished(r);
      if (sp == numSplits - 1 && finishOK) laterSplitOKj[j] = true;

      const code = codeAt(ref(sp));
      const split = int(r.splits[code]);
      const finishTime = finishOK ? int(r.result) : 360000000;
      if (isNaN(split) && laterSplitOKj[j]) {
        statusN++;
        runnerOK[j] = false;
        raceOK = false;
      } else if (split < 0 || split > finishTime) {
        statusN++;
        r.splits[code] = '';
        r.splits[code + '_changed'] = '';
        runnerOK[j] = false;
        raceOK = false;
      } else if (!isNaN(split)) {
        statusN++;
        OKSum++;
        laterSplitOKj[j] = true;
      }
    }
    const statusAvg = statusN >= minNum ? OKSum / statusN : 1;
    classSplitsStatus[sp] = statusAvg > validateLim ? statusAvg : 0;
  }

  const splitFracRunner = Array.from({ length: numSplits }, () =>
    new Array<number | null>(numRunners).fill(null),
  );
  let sprintTimeSum = 0;
  let sprintTimeNum = 0;

  for (let j = 0; j < numRunners; j++) {
    const r = results[j]!;
    if (!isRankable(r.status)) continue;
    let nextSplit: number | null = null;
    const startTime = flags.isRelay ? int(r.splits[0]) : 0;
    if (isFinished(r)) nextSplit = int(r.result);
    for (let sp = numSplits - 1; sp >= 0; sp--) {
      if (classSplitsStatus[sp] == 0) continue;
      const split = int(r.splits[codeAt(ref(sp))]);
      if (!isNaN(split)) {
        if (sp == numSplits - 1 && nextSplit != null && nextSplit > split) {
          sprintTimeSum += nextSplit - split;
          sprintTimeNum++;
        }
        let spPrev = sp - 1;
        while (classSplitsStatus[spPrev] == 0 && spPrev >= 0) spPrev--;
        const spPrevRef = ref(spPrev);
        const prevSplit = spPrevRef >= 0 ? int(r.splits[codeAt(spPrevRef)]) : startTime;
        if ((nextSplit != null && nextSplit <= split) || split <= prevSplit)
          splitFracRunner[sp]![j] = -1;
        else
          splitFracRunner[sp]![j] =
            nextSplit != null ? (split - prevSplit) / (nextSplit - prevSplit) : null;
        nextSplit = split;
      } else {
        nextSplit = null;
        splitFracRunner[sp]![j] = null;
      }
    }
  }

  let shortSprint = false;
  if (sprintTimeNum > 0) {
    const sprintTimeAvg = sprintTimeSum / sprintTimeNum;
    shortSprint = sprintTimeAvg > 0 && sprintTimeAvg < sprintTimeLim * 100;
  }
  const check: RadioCheck = { splitsStatus: classSplitsStatus, shortSprint };

  const splitsPar: (SplitParams | null)[] = [];
  const classSplitsUpdated = new Array<boolean>(classSplits.length).fill(false);

  for (let sp = 0; sp < numSplits; sp++) {
    if (classSplitsStatus[sp] == 0) {
      splitsPar.push(null);
      continue;
    }
    const fracs = splitFracRunner[sp]!;
    const fractions = fracs.filter(isFraction);
    if (fractions.length == 0) {
      splitsPar.push(null);
      continue;
    }
    const numFractions = fractions.length;
    const median = medianFrac(fractions, 0.25)!;
    const absdev = fracs.filter(isFraction).map((f) => Math.abs(f - median));
    const medianDev = medianFrac(absdev, 0.1)!;

    let count = 0;
    let wSum = 0;
    let xSum = 0;
    let ySum = 0;
    let xySum = 0;
    let xxSum = 0;
    let maxFrac = 0;
    let minFrac = 1;
    const stdDev = 1.48 * medianDev;

    for (let j = 0; j < numRunners; j++) {
      const frac = fracs[j]!;
      if (!isFraction(frac) || Math.abs(frac - median) > 2 * stdDev) continue;
      if (frac > maxFrac) maxFrac = frac;
      if (frac < minFrac) minFrac = frac;
      const weight = (numRunners - j) / numRunners;
      count++;
      wSum += weight;
      xSum += j * weight;
      ySum += frac * weight;
      xxSum += j * j * weight;
      xySum += j * frac * weight;
    }

    let a = 0;
    let b: number | null = null;
    if (count >= 1) {
      a = count >= 2 ? (wSum * xySum - xSum * ySum) / (wSum * xxSum - xSum * xSum) : 0;
      b = (ySum - a * xSum) / wSum;
    }
    splitsPar.push({ median, medianDev, numFractions, a, b, max: maxFrac, min: minFrac });
  }

  let multiPass = false;
  if (!flags.isRelay) {
    for (let sp1 = 0; sp1 < numSplits - 1; sp1++) {
      const code1 = classSplits[sp1]!.code;
      for (let sp2 = sp1 + 1; sp2 < numSplits; sp2++) {
        if ((classSplits[sp2]!.code - code1) % 1000 == 0) {
          multiPass = true;
          break;
        }
      }
    }
  }

  if (multiPass && !raceOK) {
    const splitFracNom = new Array<number>(numSplits).fill(1);
    let lastFrac = 1;
    for (let sp = numSplits - 1; sp >= 0; sp--) {
      const par = splitsPar[sp];
      if (classSplitsStatus[sp] == 0 || par == null) continue;
      let X = par.median;
      for (let spi = sp - 1; spi >= 0; spi--) {
        // Legacy throws here on a valid split without parameters; skip it instead.
        const parI = splitsPar[spi];
        if (classSplitsStatus[spi] == 0 || parI == null) continue;
        X = parI.median / (1 - X * (1 - parI.median));
      }
      splitFracNom[sp] = X * lastFrac;
      lastFrac = splitFracNom[sp]!;
    }

    // Function scoped `var`s in legacy: these keep their values across splits and runners.
    let splitCodei: number | undefined;
    let bestFitSpi: number | undefined;
    let spj: number | undefined;
    for (let j = 0; j < numRunners; j++) {
      if (runnerOK[j]) continue;
      const r = results[j]!;
      const finishTime = int(r.result);
      if (!isFinished(r) || finishTime <= 0) continue;
      for (let sp = numSplits - 1; sp >= 0; sp--) {
        if (!isNaN(int(r.splits[codeAt(ref(sp))]))) continue;
        const splitCode = codeAt(ref(sp));
        let spliti = NaN;
        let spi = sp - 1;
        while (spi >= 0) {
          splitCodei = codeAt(ref(spi));
          if ((splitCode - splitCodei) % 1000 == 0) {
            spliti = int(r.splits[splitCodei]);
            if (!isNaN(spliti)) break;
          }
          spi--;
        }
        if (spi >= 0) {
          let bestFitDev = Math.abs(spliti / finishTime - splitFracNom[spi]!);
          bestFitSpi = spi;
          for (spj = spi + 1; spj <= sp; spj++) {
            const splitCodej = codeAt(ref(spj));
            const splitDevSpj = Math.abs(spliti / finishTime - splitFracNom[spj]!);
            if (splitDevSpj < bestFitDev && (splitCode - splitCodej) % 1000 == 0) {
              bestFitSpi = spj;
              bestFitDev = splitDevSpj;
            }
          }
        }
        if (bestFitSpi == sp) {
          r.splits[splitCode] = r.splits[String(splitCodei)];
          r.splits[splitCode + '_changed'] = 0;
          r.splits[splitCode + '_status'] = 0;
          r.splits[String(splitCodei)] = undefined;
          classSplitsUpdated[sp] = true;
          if (spj != undefined) classSplitsUpdated[spj] = true;
          shiftedSplits[j] = true;
        }
      }
    }
  }

  const placeLimit = 3;
  const minNumFrac = 5;
  const minDev = 0.15;
  const stdFactor = 1.48;
  for (let j = 0; j < numRunners; j++) {
    const r = results[j]!;
    if (shiftedSplits[j] || !isRankable(r.status)) continue;
    for (let sp = numSplits - 1; sp >= 0; sp--) {
      const par = splitsPar[sp];
      const frac = splitFracRunner[sp]![j];
      if (
        par == null ||
        par.numFractions < minNumFrac ||
        classSplitsStatus[sp] == 0 ||
        frac == null
      )
        continue;
      const spRef = ref(sp);
      const splitCode = codeAt(spRef);
      if (Number(r.splits[splitCode + '_place']) > placeLimit) continue;
      // Student t at 99.9 % confidence, approximated as a function of the sample size.
      const devLimit = Math.max(
        minDev,
        stdFactor * par.medianDev * Math.exp(1.19 + 1.5 * Math.exp(-0.14 * (par.numFractions - 1))),
      );
      if (estimateFrac(par, j) - frac > devLimit) {
        r.splits[splitCode] = '';
        r.splits[splitCode + '_changed'] = '';
        classSplitsUpdated[spRef] = true;
        runnerOK[j] = false;
        raceOK = false;
      }
    }
  }

  if (raceOK) return check;

  for (let j = 0; j < numRunners; j++) {
    if (runnerOK[j]) continue;
    const r = results[j]!;
    let nextSplit: number | null = null;
    const startTime = flags.isRelay ? int(r.splits[0]) : 0;
    if (isFinished(r)) nextSplit = int(r.result);

    for (let sp = numSplits - 1; sp >= 0; sp--) {
      if (classSplitsStatus[sp] == 0) continue;
      let prevSplit = NaN;
      const spRef = ref(sp);
      const code = codeAt(spRef);
      const split = int(r.splits[code]);
      if (!isNaN(split)) nextSplit = split;
      else if (splitsPar[sp] == null) nextSplit = 0;
      else {
        const x: number[] = [];
        let spPrev = sp;
        while (isNaN(prevSplit) && spPrev >= 0) {
          const par = splitsPar[spPrev];
          // Legacy throws here on a valid split without parameters; skip it instead.
          if (classSplitsStatus[spPrev]! > 0 && par != null) x.push(estimateFrac(par, j));
          spPrev--;
          const spPrevRef = ref(spPrev);
          prevSplit = spPrevRef >= 0 ? int(r.splits[codeAt(spPrevRef)]) : startTime;
        }
        let X = x[x.length - 1];
        for (let i = x.length - 2; i >= 0; i--) X = x[i]! / (1 - X! * (1 - x[i]!));

        if (nextSplit != null && nextSplit > 0 && !isNaN(prevSplit) && X != undefined && X > 0) {
          classSplitsUpdated[spRef] = true;
          const estimate = Math.round((X * nextSplit + (1 - X) * prevSplit) / 100) * 100;
          nextSplit = estimate;
          markEstimate(r.splits, code, estimate);
          if (flags.isRelay) {
            classSplitsUpdated[spRef - 1] = true;
            markEstimate(r.splits, code + 100000, estimate - startTime);
          }
        }
      }
    }
  }
  updateSplitPlaces(results, classSplits, classSplitsUpdated);
  return check;
}

function markEstimate(splits: ResultRow['splits'], code: number, time: number) {
  splits[code] = time;
  splits[code + '_estimate'] = true;
  splits[code + '_changed'] = 0;
  splits[code + '_status'] = 0;
}

const relayPassTime = (r: ResultRow, split: SplitEntry) =>
  r.start + (r.start < 6 * 3600 * 100 ? 24 * 3600 * 100 : 0) + (split as number);

const looseNotEmpty = (v: SplitEntry) =>
  typeof v === 'number' ? v !== 0 : v !== '' && v !== false;

/**
 * Sorted times per displayed split (last row = finish), ported from the legacy
 * `updateClassSplitsBest`. For relays the times are pass time stamps, with
 * 24 h added to starts before 06:00.
 */
export function updateClassSplitsBest(
  results: ResultRow[],
  classSplits: SplitControl[],
  flags: Pick<RadioFlags, 'isRelay' | 'lapTimes' | 'numSplits'>,
): number[][] {
  const numSplits = flags.numSplits;
  const best = Array.from({ length: numSplits + 1 }, () => [0]);

  let j = 0;
  for (const r of results) {
    if (!isFinished(r)) continue;
    best[numSplits]![j++] = flags.isRelay
      ? relayPassTime(r, r.splits[classSplits[classSplits.length - 1]!.code])
      : int(r.result);
  }
  best[numSplits]!.sort((a, b) => a - b);

  for (let sp = 0; sp < numSplits; sp++) {
    j = 0;
    const spRef = splitRef(sp, flags);
    const code = classSplits[spRef]!.code;
    for (const r of results) {
      const place = r.splits[code + '_place'];
      if (place == undefined || !(Number(place) > 0) || !looseNotEmpty(r.splits[code])) continue;
      best[sp]![j++] = flags.isRelay
        ? relayPassTime(r, r.splits[classSplits[spRef - 1]!.code])
        : (r.splits[code] as number);
    }
    best[sp]!.sort((a, b) => a - b);
  }
  return best;
}
