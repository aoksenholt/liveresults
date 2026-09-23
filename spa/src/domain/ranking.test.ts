import type { Entry, RaceClass } from '../api/types';
import chase from '../api/__fixtures__/chase.json';
import interval from '../api/__fixtures__/interval.json';
import lapTimes from '../api/__fixtures__/lap-times.json';
import massStart from '../api/__fixtures__/mass-start.json';
import relay from '../api/__fixtures__/relay.json';
import unorderedNoTimes from '../api/__fixtures__/unordered-no-times.json';
import unordered from '../api/__fixtures__/unordered.json';
import { createLegacyViewer } from '../test/legacy';
import type { ClassInfo, ResultRow } from './model';
import {
  checkForMassStart,
  sortByDist,
  updateResultVirtualPosition,
  updateSplitPlaces,
} from './ranking';
import { classResults, normalizeClasses } from './time4o';

const FIXTURES = {
  interval,
  massStart,
  chase,
  unordered,
  unorderedNoTimes,
  lapTimes,
  relay,
} as unknown as Record<string, { raceClass: RaceClass; entries: Entry[] }>;

const cases = Object.entries(FIXTURES).flatMap(([name, f]) =>
  normalizeClasses([f.raceClass]).map((cls) => {
    const entries = f.entries.filter((e) => !cls.isRelay || e.raceClassId === cls.id);
    return [`${name} ${cls.className}`, cls, entries] as const;
  }),
);

function runPipeline(cls: ClassInfo, entries: Entry[]): ResultRow[] {
  const data = classResults(entries, cls);
  if (data.updatedSplits.some(Boolean))
    updateSplitPlaces(data.results, data.splitcontrols, data.updatedSplits);
  const isMassStart = checkForMassStart(data.results) || cls.isRelay;
  updateResultVirtualPosition(data.results, { isMassStart, splits: data.splitcontrols });
  return data.results;
}

function runLegacyPipeline(cls: ClassInfo, entries: Entry[]): ResultRow[] {
  const legacy = createLegacyViewer();
  const data = legacy.Time4oResultsToLiveres({ type: 'results', data: entries }, cls);
  if (data.updatedSplits.some(Boolean)) legacy.updateSplitPlaces(data, data.updatedSplits);
  legacy.curClassSplits = data.splitcontrols;
  legacy.curClassIsMassStart = legacy.checkForMassStart(data) || cls.isRelay;
  legacy.updateResultVirtualPosition(data.results);
  return data.results;
}

// Fixtures are recorded after the races finished; strip results to get runners still on course.
function midRace(entries: Entry[]): Entry[] {
  return entries.map((e, i) => {
    if (i % 3 === 0) return e;
    const splits = Array.isArray(e.intermediateTimes) ? {} : { ...e.intermediateTimes };
    const keep = i % 4;
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

describe.each(cases)('legacy parity: %s', (_name, cls, entries) => {
  it('ranks results and split places like the legacy viewer', () => {
    expect(runPipeline(cls, entries)).toEqual(runLegacyPipeline(cls, entries));
  });

  it('ranks runners on course like the legacy viewer', () => {
    const live = midRace(entries);
    expect(runPipeline(cls, live)).toEqual(runLegacyPipeline(cls, live));
  });
});

const row = (overrides: Partial<ResultRow>): ResultRow => ({
  place: '',
  dbid: 0,
  bib: 0,
  ecard1: '',
  ecard2: '',
  name: '',
  club: '',
  organisation: '',
  clubId: 0,
  class: '',
  leg: 0,
  pace: -1,
  status: 9,
  splits: {},
  start: 0,
  result: -3,
  timeplus: '',
  changed: 0,
  progress: 0,
  ...overrides,
});

describe('checkForMassStart', () => {
  it('is true when all starts are within one second', () => {
    expect(checkForMassStart([row({ start: 3600000 }), row({ start: 3600050 })])).toBe(true);
    expect(checkForMassStart([row({ start: 3600000 }), row({ start: 3606000 })])).toBe(false);
  });

  it('is false without known start times', () => {
    expect(checkForMassStart([row({ start: -999 })])).toBe(false);
    expect(checkForMassStart(null)).toBe(false);
  });
});

describe('updateResultVirtualPosition', () => {
  it('slots a runner on course in by the latest split time', () => {
    const splits = [{ code: 1031, order: 1, name: 'R1', updated: false }];
    const data = [
      row({
        dbid: 1,
        place: '1',
        status: 0,
        result: 100000,
        progress: 100,
        splits: { 1031: 40000 },
      }),
      row({
        dbid: 2,
        place: '2',
        status: 0,
        result: 120000,
        progress: 100,
        splits: { 1031: 60000 },
      }),
      row({ dbid: 3, progress: 50, splits: { 1031: 50000 } }),
    ];
    updateResultVirtualPosition(data, { isMassStart: false, splits });
    expect(data.map((r) => r.dbid)).toEqual([1, 3, 2]);
    expect(data.map((r) => r.virtual_position)).toEqual([0, 1, 2]);
  });

  it('keeps idx when asked not to update it', () => {
    const data = [row({ dbid: 1, idx: 7 })];
    updateResultVirtualPosition(data, { isMassStart: false, splits: [] }, false);
    expect(data[0]!.idx).toBe(7);
    expect(data[0]!.virtual_position).toBe(0);
  });
});

describe('sortByDist', () => {
  it('puts the runner with most progress first and free start last among not started', () => {
    expect(sortByDist(row({ progress: 50 }), row({ progress: 20 }))).toBeLessThan(0);
    expect(sortByDist(row({ start: -999 }), row({ start: 3600000 }))).toBeGreaterThan(0);
  });
});

describe('updateSplitPlaces', () => {
  it('computes places and time behind for client-side splits', () => {
    const splits = [{ code: 101031, order: 1, name: 'R1PassTime', updated: true }];
    const data = [
      row({ dbid: 1, status: 0, splits: { 101031: 5000 } }),
      row({ dbid: 2, status: 0, splits: { 101031: 4000 } }),
      row({ dbid: 3, status: 3, splits: { 101031: 3000 } }),
      row({ dbid: 4, status: 0, splits: {} }),
    ];
    updateSplitPlaces(data, splits, [true]);
    const byId = Object.fromEntries(data.map((r) => [r.dbid, r.splits]));
    expect(byId[2]).toMatchObject({ '101031_place': 1, '101031_timeplus': -1000 });
    expect(byId[1]).toMatchObject({ '101031_place': 2, '101031_timeplus': 1000 });
    expect(byId[3]).toMatchObject({ '101031_place': '-', '101031_status': 3 });
    expect(byId[4]).toMatchObject({ '101031_timeplus': -2 });
  });
});
