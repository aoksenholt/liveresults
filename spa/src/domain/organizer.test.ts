import type { Entry } from '../api/types';
import { FIXTURES, midRace } from '../test/fixtures';
import { createLegacyViewer } from '../test/legacy';
import type { DisplayFormat, TimeLabels } from './format';
import type { ResultRow } from './model';
import {
  entryRows,
  leftInForest,
  matchesSearch,
  organizerRow,
  startMarks,
  startRegistration,
  type StartBeep,
  type StartWindow,
  timeToStartText,
} from './organizer';
import { eventClock } from './predicted';
import { normalizeClasses } from './time4o';

process.env.TZ = 'Europe/Oslo';

const labels: TimeLabels = {
  status: { 0: 'OK', 1: 'DNS', 2: 'DNF', 3: 'MP', 4: 'DSQ', 5: 'OT', 9: '', 10: '', 13: 'Fullf.' },
  freeStart: 'fristart',
  notShown: 'OK',
};
const format: DisplayFormat = { labels, language: 'no', maxNameLength: 15, maxClubLength: 12 };

const all = Object.values(FIXTURES);
const classes = normalizeClasses(all.map((f) => f.raceClass));
const withDns = (entries: Entry[]) =>
  entries.map((e, i) => (i % 7 == 3 ? ({ ...e, status: { status: 'DidNotStart' } } as Entry) : e));
const freeStart = (entries: Entry[]) =>
  entries.map((e, i) =>
    i % 4 == 1
      ? ({
          ...e,
          start: { ...e.start, startTime: null },
          time: { ...e.time, startTime: null },
        } as Entry)
      : e,
  );
const live = withDns(midRace(all.flatMap((f) => f.entries)));

interface Node {
  classes: string[];
}

function legacyViewer(inputs: Record<string, string> = {}, window: Record<string, unknown> = {}) {
  const nodes: Node[] = [];
  const captured: { table?: { data: ResultRow[]; columns: LegacyColumn[] } } = {};
  const table = {
    row: (i: number) => ({ node: () => (nodes[i] ??= { classes: [] }) }),
    rows: () => ({ invalidate: () => {} }),
    column: () => ({ search: () => ({ draw: () => {} }) }),
  };
  const any: object = new Proxy(() => {}, {
    get: (_t, prop) =>
      prop == 'DataTable' ? (o: typeof captured.table) => ((captured.table = o), table) : () => any,
  });
  const $ = (selector: unknown) => {
    if (typeof selector == 'string' && selector.slice(1) in inputs)
      return [{ value: inputs[selector.slice(1)] }];
    if (selector && typeof selector == 'object' && 'classes' in selector) {
      const node = selector as Node;
      const el = {
        removeClass: () => ((node.classes = []), el),
        addClass: (c: string) => (node.classes.push(...c.split(' ')), el),
      };
      return el;
    }
    return any;
  };
  Object.assign(globalThis, {
    $: Object.assign($, {
      each: (arr: unknown[], fn: (i: number, v: unknown) => unknown) => {
        for (const [i, v] of arr.entries()) if (fn(i, v) === false) break;
      },
    }),
  });
  const viewer = createLegacyViewer(
    {
      Time4oServer: true,
      activeClasses: classes,
      runnerStatus: labels.status,
      resources: { _FREESTART: labels.freeStart, _STATUSNOTSHOWN: labels.notShown },
      eventTimeZoneDiff: 0,
      radioUpdateInterval: 15000,
      audioMute: false,
      messageBibs: [],
      maxNameLength: format.maxNameLength,
      maxClubLength: format.maxClubLength,
      isCompToday: () => false,
      animateTable: () => {},
      updateStartClock: () => {},
    },
    window,
  );
  return { viewer, nodes, captured };
}

interface LegacyColumn {
  data: string;
  title: string;
  render?: (data: unknown, type: string, row: ResultRow) => string;
}

const cell = (col: LegacyColumn | undefined, row: ResultRow) =>
  col?.render ? col.render(row[col.data as keyof ResultRow], 'display', row) : '';

afterEach(() => {
  delete (globalThis as Record<string, unknown>).$;
  vi.useRealTimers();
});

const text = (html: string) => html.replace(/<[^>]+>/g, '').trim();

function legacyCells(captured: { table?: { data: ResultRow[]; columns: LegacyColumn[] } }) {
  const { data, columns } = captured.table!;
  const col = (title: string) => columns.find((c) => c.title == title);
  return data.map((r) => ({
    dbid: r.dbid,
    bib: text(cell(col('&#8470;'), r)),
    name: cell(col('Navn'), r),
    club: cell(col('Klubb'), r),
    className: text(cell(col('Klasse'), r)),
    start: cell(col('Starttid'), r),
    ecard: text(cell(col('Brikke'), r)),
  }));
}

const ourCells = (r: ResultRow) => {
  const o = organizerRow(r, format);
  return {
    dbid: o.dbid,
    bib: o.bib,
    name: o.name,
    club: o.club,
    className: o.className,
    start: o.start,
    ecard: ((o.checked ? '&#9989; ' : '&#11036; ') + o.ecards).trim(),
  };
};

describe('leftInForest', () => {
  it.each([
    ['mid race', live],
    ['free start', freeStart(live)],
  ])('matches the legacy radio view for code -2 (%s)', (_name, entries) => {
    const { viewer, captured } = legacyViewer();
    viewer.handleUpdateRadioPassings({ status: 'OK', data: entries }, false, -2);
    const ours = leftInForest(entryRows(entries, classes)).map(ourCells);
    expect(ours).toEqual(legacyCells(captured));
    expect(ours.length).toBeGreaterThan(10);
  });
});

describe('matchesSearch', () => {
  const row = organizerRow(
    entryRows(live, classes).find((r) => r.bib > 0 && r.club)!,
    format,
  );

  it('needs every word somewhere in the row, ignoring case', () => {
    const [first] = row.searchText.split('  ');
    expect(matchesSearch(row.searchText, '')).toBe(true);
    expect(matchesSearch(row.searchText, `${first} ${row.className.toUpperCase()}`)).toBe(true);
    expect(matchesSearch(row.searchText, `${first} zzzz`)).toBe(false);
  });

  it('keeps quoted phrases together', () => {
    expect(matchesSearch('ola nordmann  ok test', '"ola nordmann"')).toBe(true);
    expect(matchesSearch('ola nordmann  ok test', '"nordmann ok"')).toBe(false);
  });
});

describe('startMarks', () => {
  const startOf = (e: Entry) => Date.parse(e.start!.startTime!);
  const reference = live.filter((e) => e.start?.startTime).sort((a, b) => startOf(a) - startOf(b));
  const middle = startOf(reference[reference.length >> 1]!);
  const waiting = entryRows(live, classes)
    .filter((r) => (r.status == 9 || r.status == 10) && r.start > 0)
    .map((r) => r.start)
    .sort((a, b) => a - b);
  const at = (hundredths: number) => Date.parse('2026-09-19T00:00:00+02:00') + hundredths * 10;
  const bibs = reference.map((e) => e.start!.bibNo!).sort((a, b) => a - b);

  function legacyMarks(entries: Entry[], w: StartWindow, nowMs: number) {
    vi.useFakeTimers({ now: nowMs });
    const inputs = {
      preTime: String(w.preTime),
      callTime: String(w.callTime),
      postTime: String(w.postTime),
      minBib: String(w.minBib ?? ''),
      maxBib: String(w.maxBib ?? ''),
    };
    let beep: StartBeep = 0;
    const window = { makeStartBeep: (long: boolean) => (beep = long ? 2 : 1) };
    const { viewer, nodes, captured } = legacyViewer(inputs, window);
    viewer.handleUpdateStartRegistration({ status: 'OK', data: entries }, false, w.openStart);
    const rows = viewer.radioData as (ResultRow & { show: boolean; timeToStart: number })[];
    const diff = captured.table!.columns.find((c) => c.title == 'Diff');
    return {
      rows: rows.map((r, i) => ({
        dbid: r.dbid,
        show: r.show,
        classes: nodes[i]?.classes ?? [],
        timeToStart: r.timeToStart,
      })),
      cells: legacyCells(captured),
      diff: diff ? rows.map((r) => text(cell(diff, r))) : null,
      beep,
    };
  }

  function ourMarks(entries: Entry[], w: StartWindow, nowMs: number) {
    const rows = startRegistration(entryRows(entries, classes));
    const { marks, beep } = startMarks(rows, eventClock(nowMs, 0, 'Europe/Oslo') / 100, w);
    return {
      rows: rows.map((r, i) => ({ dbid: r.dbid, ...marks[i]! })),
      cells: rows.map(ourCells),
      diff: w.openStart ? null : marks.map((m) => timeToStartText(m.timeToStart, format)),
      beep,
    };
  }

  const timed: StartWindow = { preTime: 1, callTime: 3, postTime: 5, openStart: false };
  it.each([
    ['before the first start', timed, at(waiting[0]!) - 3 * 60000],
    ['in the middle', timed, middle],
    ['two seconds before a start', timed, middle - 2000],
    ['half a second after a start', timed, middle + 500],
    ['with a long call time', { ...timed, callTime: 10, preTime: 5 }, middle + 30000],
    [
      'with bib limits',
      {
        ...timed,
        minBib: bibs[bibs.length >> 2],
        maxBib: bibs[(bibs.length * 3) >> 2],
        callTime: 30,
      },
      middle,
    ],
    ['after the last start', timed, at(waiting.at(-1)!) + 3 * 60000],
  ])('matches the legacy start registration (%s)', (_name, w, nowMs) => {
    const legacy = legacyMarks(live, w, nowMs);
    expect(ourMarks(live, w, nowMs)).toEqual(legacy);
    expect(legacy.rows.some((r) => r.show)).toBe(true);
  });

  it('highlights called runners and the first starter', () => {
    const classes = ourMarks(live, timed, middle).rows.flatMap((r) => r.classes);
    expect(new Set(classes)).toEqual(
      new Set(['pre_post_start', 'firststarter', 'yellow_row', 'yellow_row_new', 'dns']),
    );
  });

  it('matches the legacy start registration for free start', () => {
    const w = { ...timed, openStart: true };
    const entries = freeStart(live);
    const legacy = legacyMarks(entries, w, middle);
    expect(ourMarks(entries, w, middle)).toEqual(legacy);
    expect(legacy.rows.filter((r) => r.show).length).toBeGreaterThan(3);
  });

  it('beeps shortly before and at the start', () => {
    const row = { dbid: 1, bib: 1, status: 10, start: 36000 * 100 } as ResultRow;
    const w = { ...timed };
    expect(startMarks([row], 36000 - 3, w).beep).toBe(1);
    expect(startMarks([row], 36000, w).beep).toBe(2);
    expect(startMarks([row], 36000 - 10, w).beep).toBe(0);
  });
});
