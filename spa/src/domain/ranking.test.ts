import {
  cases,
  damagedSplits,
  FIXTURES,
  midRace,
  multiPass,
  runLegacyPipeline,
} from '../test/fixtures';
import type { Entry } from '../api/types';
import type { ClassInfo, ResultRow } from './model';
import {
  checkForMassStart,
  firstNonQualifier,
  qualificationLimit,
  sortByDist,
  updateResultVirtualPosition,
  updateSplitPlaces,
} from './ranking';
import { buildClassView } from './pipeline';
import { createLegacyViewer } from '../test/legacy';

const viewOf = (cls: ClassInfo, entries: Entry[]) => {
  const { results, splitsStatus, splitsBest, shortSprint } = buildClassView(cls, entries);
  return { results, splitsStatus, splitsBest, shortSprint };
};

describe.each(cases)('legacy parity: %s', (_name, cls, entries) => {
  it('ranks results and split places like the legacy viewer', () => {
    expect(viewOf(cls, entries)).toEqual(runLegacyPipeline(cls, entries));
  });

  it('ranks runners on course like the legacy viewer', () => {
    const live = midRace(entries);
    expect(viewOf(cls, live)).toEqual(runLegacyPipeline(cls, live));
  });

  it('estimates missing and unlikely split times like the legacy viewer', () => {
    const damaged = damagedSplits(entries);
    expect(viewOf(cls, damaged)).toEqual(runLegacyPipeline(cls, damaged));
    const live = midRace(damaged);
    expect(viewOf(cls, live)).toEqual(runLegacyPipeline(cls, live));
  });
});

describe('legacy parity: multi-pass controls', () => {
  it('moves split times to the matching pass like the legacy viewer', () => {
    const { cls, entries } = multiPass(FIXTURES.interval!);
    expect(cls.splitcontrols.map((s) => s.code)).toContain(2031);
    const damaged = damagedSplits(entries).map((e, i) => {
      const splits = e.intermediateTimes as Record<string, { time: number | null }>;
      if (i % 2 === 1 || !splits?.['31-1'] || !splits['31-2']) return e;
      // Only the second pass registered, delivered as the first.
      const { ['31-2']: second, ...rest } = splits;
      return { ...e, intermediateTimes: { ...rest, '31-1': second } } as unknown as Entry;
    });
    const view = viewOf(cls, damaged);
    expect(view).toEqual(runLegacyPipeline(cls, damaged));
    expect(
      view.results.some((r) => Object.keys(r.splits).some((k) => k.endsWith('_estimate'))),
    ).toBe(true);
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

describe.each(cases)('legacy parity: qualification limit %s', (_name, cls, entries) => {
  it.each([
    ['finished', entries],
    ['mid race', midRace(entries)],
    [
      'with DNS',
      entries.map((e, i) =>
        i % 3 == 1 ? ({ ...e, status: { status: 'DidNotStart' } } as Entry) : e,
      ),
    ],
  ])('marks the first non-qualifier like updateQualLimMarks (%s)', (_variant, live) => {
    const { results } = buildClassView(cls, live);
    for (const qualLim of [-1, 1, 3, 10, 0.5])
      for (const rankedStartlist of [false, true]) {
        const legacy = structuredClone(results) as (ResultRow & { DT_RowClass?: string })[];
        createLegacyViewer({ rankedStartlist }).updateQualLimMarks(legacy, qualLim);
        expect(firstNonQualifier(results, qualLim, rankedStartlist)).toBe(
          legacy.findIndex((r) => r.DT_RowClass == 'firstnonqualifier'),
        );
      }
  });
});

describe('firstNonQualifier', () => {
  const row = (place: string, vp: number, status = 0, progress = 100) =>
    ({ place, virtual_position: vp, status, progress }) as ResultRow;

  it.each([
    ['count', [row('1', 0), row('2', 1), row('3', 2), row('4', 3)], 2],
    ['tie at the limit', [row('1', 0), row('2', 1), row('2', 2), row('4', 3)], 2],
    ['fraction', [row('1', 0), row('2', 1), row('3', 2), row('', 3, 1, 0)], 0.5],
    ['on course', [row('1', 0), row('', 2, 9, 50), row('2', 1), row('3', 3)], 2],
    ['unranked', [row('-', 0), row('-', 1), row('-', 2)], 2],
    ['off', [row('1', 0)], -1],
  ])('matches legacy updateQualLimMarks (%s)', (_name, results, qualLim) => {
    const legacy = createLegacyViewer({ rankedStartlist: true });
    const copy = structuredClone(results);
    legacy.updateQualLimMarks(copy, qualLim);
    const expected = copy.findIndex(
      (r) => (r as { DT_RowClass?: string }).DT_RowClass == 'firstnonqualifier',
    );
    expect(firstNonQualifier(results, qualLim, true)).toBe(expected);
  });

  it('follows predicted positions', () => {
    const row = (place: string, progress: number) =>
      ({ place, progress, virtual_position: 0 }) as ResultRow;
    const results = [row('1', 100), row('2', 100), row('', 50), row('3', 100)];
    results.forEach((r, i) => (r.virtual_position = i));
    expect(firstNonQualifier(results, 2, false)).toBe(2);
    expect(firstNonQualifier(results, 2, false, [0, 2, 1, 3])).toBe(1);
  });

  it('takes the limit from the class', () => {
    expect(qualificationLimit({ qualificationLimit: 6 })).toBe(6);
    expect(qualificationLimit({ qualificationLimit: null })).toBe(-1);
    expect(qualificationLimit(null)).toBe(-1);
  });
});
