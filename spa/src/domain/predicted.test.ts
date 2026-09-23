import type { Entry } from '../api/types';
import {
  cases,
  damagedSplits,
  earlierSplits,
  midRace,
  momentsOnCourse,
  runLegacyClass,
} from '../test/fixtures';
import type { ClassInfo, ResultRow } from './model';
import { buildClassView } from './pipeline';
import { eventClock, serverTimeDiff, updatePredictedTimes } from './predicted';

// Legacy derives the event clock from the browser's local time and assumes CET/CEST.
process.env.TZ = 'Europe/Oslo';

const jq: object = new Proxy(() => {}, {
  get: (_t, prop) => (prop == 'hasClass' ? () => false : () => jq),
});

beforeAll(() => {
  Object.assign(globalThis, {
    $: Object.assign(() => jq, {
      extend: (_deep: boolean, _target: unknown, src: unknown) => structuredClone(src),
    }),
  });
});
afterAll(() => {
  delete (globalThis as Record<string, unknown>).$;
});
afterEach(() => vi.useRealTimers());

const parseTime = (s: string) =>
  s.split(':').reduce((acc, part) => acc * 60 + Number(part), 0) * 100;

function runLegacyPredicted(cls: ClassInfo, entries: Entry[], nowMs: number) {
  const { legacy, data } = runLegacyClass(cls, entries);
  const cells = new Map<number, string[]>();
  Object.assign(legacy, {
    predData: structuredClone(data.results),
    curClassName: cls.className,
    curClassNumberOfRunners: data.results.length,
    updateAutomatically: true,
    isCompToday: () => true,
    startPredictedTimeTimer: () => {},
    animateTable: () => {},
    serverTimeDiff: 0,
    eventTimeZoneDiff: 0,
    highTime: 60,
    rankedStartlist: true,
    EmmaServer: false,
    isMultiDayEvent: false,
    compactView: !(legacy.curClassIsRelay || legacy.curClassLapTimes),
    curClassHasBibs: data.results[0]?.bib != 0,
    qualLim: -1,
    currentTable: {
      data: () => ({ toArray: () => data.results }),
      row: () => ({ node: () => ({}) }),
      cell: (i: number) => ({
        node: () => ({}),
        data: (v: string) => cells.set(i, [...(cells.get(i) ?? []), v]),
      }),
      rows: () => ({ invalidate: () => {} }),
      table: () => ({ container: () => ({}) }),
      columns: { adjust: () => ({ draw: () => {} }) },
    },
  });
  vi.useFakeTimers({ now: nowMs, toFake: ['Date'] });
  legacy.updatePredictedTimes();
  vi.useRealTimers();

  return (data.results as ResultRow[]).map((r, i) => {
    const html = (cells.get(i) ?? []).join('');
    if (!html.includes('pulsing')) return { vp: r.virtual_position, running: null };
    const rank = /&#10072;(\d+)&#10072;/.exec(html);
    const diff = /<i>([+-])([\d:]+)<\/i>/.exec(html);
    const elapsed = /<i>(\d[\d:]*)<\/i>/.exec(html);
    return {
      vp: r.virtual_position,
      running: {
        elapsed: parseTime(elapsed![1]!),
        rank: rank ? Number(rank[1]) : null,
        timeDiff: diff ? (diff[1] == '-' ? -1 : 1) * parseTime(diff[2]!) : null,
      },
    };
  });
}

function runPredicted(cls: ClassInfo, entries: Entry[], nowMs: number) {
  const view = buildClassView(cls, entries);
  const pred = updatePredictedTimes(view, structuredClone(view.results), eventClock(nowMs));
  const floorSec = (t: number) => Math.floor(Math.abs(t) / 100) * 100 * Math.sign(t);
  return view.results.map((r, i) => {
    const run = pred.running[i];
    return {
      vp: pred.virtualPositions?.[i] ?? r.virtual_position,
      running: run && {
        elapsed: floorSec(run.elapsed),
        rank: run.rank,
        timeDiff: run.timeDiff == null ? null : floorSec(run.timeDiff) || 0,
      },
    };
  });
}

describe.each(cases)('legacy parity: %s', (_name, cls, entries) => {
  it.each([
    ['mid race', midRace(entries)],
    ['damaged splits', midRace(damagedSplits(entries))],
    ['long sprint', midRace(earlierSplits(entries))],
  ])('predicts running times and order like the legacy viewer (%s)', (_v, live) => {
    for (const now of momentsOnCourse(cls, live)) {
      const expected = runLegacyPredicted(cls, live, now);
      expect(runPredicted(cls, live, now)).toEqual(expected);
    }
  });
});

describe('predicted times', () => {
  it('reports running times in the fixtures', () => {
    const [, cls, entries] = cases.find(([name]) => name.startsWith('interval'))!;
    const live = midRace(earlierSplits(entries));
    const view = buildClassView(cls, live);
    expect(view.shortSprint).toBe(false);
    const now = momentsOnCourse(cls, live).at(-1)!;
    const pred = updatePredictedTimes(view, structuredClone(view.results), eventClock(now));
    expect(pred.active).toBe(true);
    expect(pred.running.filter(Boolean).length).toBeGreaterThan(0);
    expect(pred.running.some((r) => r?.rank != null)).toBe(true);
    expect(pred.virtualPositions).not.toEqual(view.results.map((r) => r.virtual_position));
  });
});

describe('serverTimeDiff', () => {
  it.each([
    ['keeps a small change', 0, 10_000, 9_000, 9_400, 0],
    ['keeps a change within a slow request', 3000, 10_000, 12_000, 13_800, 3000],
    ['takes a clock that runs ahead', 0, 10_000, 14_000, 14_200, 3700],
    ['takes a clock that falls behind', 5000, 10_000, 10_000, 10_200, -300],
  ])('%s', (_name, current, server, pre, post, expected) => {
    expect(serverTimeDiff(current, server, pre, post)).toBe(expected);
  });
});
