import type { Entry, RaceClass } from '../api/types';
import chase from '../api/__fixtures__/chase.json';
import interval from '../api/__fixtures__/interval.json';
import lapTimes from '../api/__fixtures__/lap-times.json';
import massStart from '../api/__fixtures__/mass-start.json';
import relay from '../api/__fixtures__/relay.json';
import unorderedNoTimes from '../api/__fixtures__/unordered-no-times.json';
import unordered from '../api/__fixtures__/unordered.json';
import type { ClassInfo, ResultRow } from '../domain/model';
import { buildClassView } from '../domain/pipeline';
import { eventClock } from '../domain/predicted';
import { normalizeClasses } from '../domain/time4o';
import { createLegacyViewer } from './legacy';

export const FIXTURES = {
  interval,
  massStart,
  chase,
  unordered,
  unorderedNoTimes,
  lapTimes,
  relay,
} as unknown as Record<string, { raceClass: RaceClass; entries: Entry[] }>;

export const cases = Object.entries(FIXTURES).flatMap(([name, f]) =>
  normalizeClasses([f.raceClass]).map((cls) => {
    const entries = f.entries.filter((e) => !cls.isRelay || e.raceClassId === cls.id);
    return [`${name} ${cls.className}`, cls, entries] as const;
  }),
);

// Mirrors the class setup in the legacy updateClassResults (liveresults.js ~2507-2531).
export function runLegacyClass(cls: ClassInfo, entries: Entry[]) {
  const legacy = createLegacyViewer();
  const data = legacy.Time4oResultsToLiveres({ type: 'results', data: entries }, cls);
  if (data.updatedSplits.some(Boolean)) legacy.updateSplitPlaces(data, data.updatedSplits);
  const splits = data.splitcontrols;
  const haveSplits = splits.length > 0;
  legacy.curClassSplits = splits;
  legacy.curClassIsRelay = haveSplits && splits[0].code == '0';
  legacy.curClassLapTimes =
    haveSplits && splits[0].code != '0' && splits.length > 1 && splits.at(-1).code == '999';
  legacy.curClassIsUnranked =
    splits.some((s: { code: number }) => s.code == -999) ||
    data.results.some((r: ResultRow) => r.status == 13);
  legacy.curClassIsMassStart = legacy.checkForMassStart(data) || legacy.curClassIsRelay;
  legacy.curClassNumSplits = legacy.curClassIsRelay
    ? splits.length / 2 - 1
    : legacy.curClassLapTimes
      ? (splits.length - 1) / 2
      : splits.length;
  legacy.curClassSplitsStatus = new Array(legacy.curClassNumSplits).fill(1);
  legacy.shortSprint = false;
  legacy.checkRadioControls(data);
  legacy.updateClassSplitsBest(data);
  legacy.updateResultVirtualPosition(data.results);
  return { legacy, data };
}

export function runLegacyPipeline(cls: ClassInfo, entries: Entry[]) {
  const { legacy, data } = runLegacyClass(cls, entries);
  return {
    results: data.results as ResultRow[],
    splitsStatus: legacy.curClassSplitsStatus as number[],
    splitsBest: legacy.curClassSplitsBests as number[][],
    shortSprint: legacy.shortSprint as boolean,
  };
}

// Fixtures are recorded after the races finished; strip results to get runners still on course.
export function midRace(entries: Entry[]): Entry[] {
  return entries.map((e, i) => {
    if (i % 3 === 0) return e;
    const splits = Array.isArray(e.intermediateTimes) ? {} : { ...e.intermediateTimes };
    const keep = i % 5;
    Object.keys(splits)
      .slice(keep)
      .forEach((k) => delete splits[k]);
    const onCourse = { status: i % 5 === 0 ? 'Inactive' : 'Active' };
    return {
      ...e,
      status: onCourse,
      overallStatus: onCourse,
      position: null,
      time: { ...e.time, time: null, behind: null },
      overallResult: { ...e.overallResult, position: null, time: null, behind: null },
      intermediateTimes: splits,
    } as Entry;
  });
}

// Radio controls that fail to register or give far too short times, to exercise split estimation.
export function damagedSplits(entries: Entry[]): Entry[] {
  return entries.map((e, i) => {
    if (Array.isArray(e.intermediateTimes) || !e.intermediateTimes) return e;
    const splits = structuredClone(e.intermediateTimes);
    const keys = Object.keys(splits);
    if (keys.length == 0) return e;
    const key = keys[i % keys.length]!;
    const split = splits[key]!;
    if (i % 3 === 1) delete splits[key];
    else if (i % 7 === 2 && split.time != null) split.time = Math.round(split.time * 0.3);
    else if (i % 11 === 5 && split.time != null) split.time = -split.time;
    else if (i % 13 === 6 && split.time != null) split.time *= 10;
    else if (i % 5 === 3 && split.time != null) {
      split.time = Math.round(split.time * 0.9);
      split.position = 1;
    }
    return { ...e, intermediateTimes: splits } as Entry;
  });
}

// Turns control 52 into a second pass of control 31, as on a course with a butterfly loop.
export function multiPass(f: { raceClass: RaceClass; entries: Entry[] }) {
  const rename = <T extends object>(map: Record<string, T>, patch: Partial<T>) =>
    Object.fromEntries(
      Object.entries(map).map(([k, v]) => (k == '52-1' ? ['31-2', { ...v, ...patch }] : [k, v])),
    );
  const raceClass = {
    ...f.raceClass,
    intermediateControls: rename(f.raceClass.intermediateControls as Record<string, object>, {
      id: '31',
      counter: 2,
    }),
  } as unknown as RaceClass;
  const entries = f.entries.map((e) =>
    Array.isArray(e.intermediateTimes) || !e.intermediateTimes
      ? e
      : ({
          ...e,
          intermediateTimes: rename(e.intermediateTimes as Record<string, object>, {
            intermediateControl: '31',
            counter: 2,
          }),
        } as unknown as Entry),
  );
  return { cls: normalizeClasses([raceClass])[0]!, entries };
}

// Moments while runners are on course: some minutes after a selection of their start times.
export function momentsOnCourse(cls: ClassInfo, entries: Entry[]): number[] {
  const iso = /\d{4}-\d\d-\d\dT[\d:.]+(?:Z|[+-]\d\d:\d\d)/.exec(JSON.stringify(entries))![0];
  const midnight = Date.parse(iso) - eventClock(Date.parse(iso)) * 10;
  const starts = buildClassView(cls, entries)
    .results.map((r) => r.start)
    .filter((s) => s > 0)
    .sort((a, b) => a - b);
  if (starts.length == 0) return [];
  return [0, 0.3, 0.6, 1].flatMap((f) =>
    [1.5, 17, 41, 95].map(
      (minutes) => midnight + starts[Math.floor(f * (starts.length - 1))]! * 10 + minutes * 60_000,
    ),
  );
}

// Two minutes from the last control to finish, so predicted finish times are not disabled by a short sprint.
export function earlierSplits(entries: Entry[]): Entry[] {
  return entries.map((e) => {
    if (Array.isArray(e.intermediateTimes) || !e.intermediateTimes) return e;
    const splits = structuredClone(e.intermediateTimes);
    for (const split of Object.values(splits)) if (split.time != null) split.time -= 120_000;
    return { ...e, intermediateTimes: splits } as Entry;
  });
}
