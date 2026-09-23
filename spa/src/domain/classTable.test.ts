import type { Entry } from '../api/types';
import { cases, damagedSplits, earlierSplits, midRace, momentsOnCourse } from '../test/fixtures';
import { createLegacyViewer, type LegacyViewer } from '../test/legacy';
import {
  cellHtml,
  classTable,
  highlights,
  predictedCells,
  runnerClub,
  runnerName,
  type TableOptions,
} from './classTable';
import type { TimeLabels } from './format';
import type { ClassInfo, ResultRow } from './model';
import { buildClassView } from './pipeline';
import { eventClock, updatePredictedTimes } from './predicted';

// Legacy derives the event clock from the browser's local time and assumes CET/CEST.
process.env.TZ = 'Europe/Oslo';

const labels: TimeLabels = {
  status: { 0: 'OK', 1: 'DNS', 2: 'DNF', 3: 'MP', 4: 'DSQ', 5: 'OT', 9: '', 10: '', 13: 'Fullf.' },
  freeStart: 'fristart',
  notShown: 'OK',
};
const titles = { name: 'Navn', club: 'Klubb', start: 'Start', finish: 'Mål' };

interface LegacyColumn {
  title: string;
  visible?: boolean;
  className?: string;
  data: string;
  render?: (data: unknown, type: string, row: ResultRow) => unknown;
}

type Nodes = Map<string, Set<string>>;

function installJQuery(nodes: Nodes, capture: (o: { columns: LegacyColumn[] }) => void) {
  const jq: object = new Proxy(() => {}, {
    get: (_t, prop) =>
      prop == 'DataTable'
        ? (o: { columns: LegacyColumn[] }) => (capture(o), jq)
        : prop == 'hasClass'
          ? () => false
          : () => jq,
  });
  const classes = (key: string) => {
    if (!nodes.has(key)) nodes.set(key, new Set());
    const set = nodes.get(key)!;
    const api = {
      hasClass: (c: string) => set.has(c),
      addClass: (c: string) => (set.add(c), api),
      removeClass: (c: string) => (set.delete(c), api),
    };
    return api;
  };
  const $ = (x: unknown) =>
    x && typeof x == 'object' && 'node' in x ? classes((x as { node: string }).node) : jq;
  Object.assign(globalThis, {
    $: Object.assign($, {
      each: (arr: unknown[], fn: (i: number, v: unknown) => unknown) => {
        for (const [i, v] of arr.entries()) if (fn(i, v) === false) break;
      },
      extend: (_deep: boolean, _target: unknown, src: unknown) => structuredClone(src),
    }),
    DataTable: { Buttons: function () {} },
  });
}

afterEach(() => {
  delete (globalThis as Record<string, unknown>).$;
  delete (globalThis as Record<string, unknown>).DataTable;
  vi.useRealTimers();
});

function legacyTable(cls: ClassInfo, entries: Entry[]) {
  let columns: LegacyColumn[] = [];
  let rows: ResultRow[] = [];
  const nodes: Nodes = new Map();
  installJQuery(nodes, (o) => {
    columns = o.columns;
    rows = (o as unknown as { data: ResultRow[] }).data;
  });
  const viewer: LegacyViewer = createLegacyViewer({
    Time4oServer: true,
    EmmaServer: false,
    curClassName: cls.className,
    activeClasses: [cls],
    relayClasses: cls.isRelay ? [cls.className] : [],
    resources: {
      _NAME: titles.name,
      _CLUB: titles.club,
      _START: titles.start,
      _CONTROLFINISH: titles.finish,
      _FREESTART: labels.freeStart,
      _STATUSNOTSHOWN: labels.notShown,
    },
    runnerStatus: labels.status,
    compDate: '2000-01-01',
    isMultiDayEvent: false,
    fixedTable: false,
    showTimesInSprint: false,
    showTenthOfSecond: false,
    qualLimits: null,
    rankedStartlist: false,
    highTime: 60,
    calculateScrollY: () => 0,
    updateScrollY: () => {},
  });
  viewer.updateClassResults({ status: 'OK', type: 'results', data: entries }, false);
  return { viewer, columns, rows, nodes };
}

const tableOptions = (cls: ClassInfo): TableOptions => ({
  labels,
  language: 'no',
  titles,
  isRelayClass: cls.isRelay,
  isSprintHeat: false,
});

const ourTable = (cls: ClassInfo, entries: Entry[]) =>
  classTable(buildClassView(cls, entries), tableOptions(cls));

const text = (html: string) => html.replace(/<br>/g, '|').replace(/<[^>]+>/g, '');

function runnerText(layout: string, row: ResultRow) {
  const name = runnerName(row, 30);
  const club = runnerClub(row, 20);
  return { name, club, nameClub: `${name}|${club}`, clubName: `${club}|${name}` }[layout]!;
}

const field = (row: ResultRow, path: string) =>
  path.startsWith('splits.') ? row.splits[path.slice(7)] : row[path as keyof ResultRow];

describe.each(cases)('legacy parity: %s', (_name, cls, entries) => {
  const variants = [
    ['finished', entries],
    ['mid race', midRace(entries)],
    ['damaged splits', midRace(damagedSplits(entries))],
  ] as const;

  it.each(variants)('has the legacy columns and cells (%s)', (_v, live) => {
    const legacy = legacyTable(cls, live);
    const table = ourTable(cls, live);
    expect(table.columns.map((c) => ({ title: c.title, visible: c.visible }))).toEqual(
      legacy.columns.map((c) => ({
        title: c.className == 'noVis' ? '' : c.title.replace('&#8470', '№'),
        visible: c.visible ?? true,
      })),
    );

    const rows = table.view.results;
    expect(rows.map((r) => r.dbid)).toEqual(legacy.rows.map((r) => r.dbid));
    rows.forEach((row, i) => {
      const legacyRow = legacy.rows[i]!;
      table.columns.forEach((col, c) => {
        if (col.kind == 'hidden') return;
        const lc = legacy.columns[c]!;
        const expected = String(lc.render!(field(legacyRow, lc.data), 'display', legacyRow));
        if (col.kind == 'runner') expect(runnerText(col.layout!, row)).toBe(text(expected));
        else expect(cellHtml(table, col, row)).toBe(expected);
      });
    });
  });

  it.each([...variants.slice(1), ['long sprint', midRace(earlierSplits(entries))]] as const)(
    'shows running times and highlights like the legacy viewer (%s)',
    (_v, live) => {
      for (const now of momentsOnCourse(cls, live)) {
        const legacy = legacyTable(cls, live);
        const cells = new Map<string, string>();
        Object.assign(legacy.viewer, {
          isCompToday: () => true,
          updateAutomatically: true,
          serverTimeDiff: 0,
          eventTimeZoneDiff: 0,
          currentTable: {
            data: () => ({ toArray: () => legacy.rows }),
            row: (i: number) => ({ node: () => ({ node: `row:${i}` }) }),
            cell: (i: number, c: number) => ({
              node: () => ({ node: `${i}:${c}` }),
              data: (v: string) => cells.set(`${i}:${c}`, v),
            }),
            rows: () => ({ invalidate: () => {} }),
            table: () => ({ container: () => ({}) }),
            columns: { adjust: () => ({ draw: () => {} }) },
          },
        });
        vi.useFakeTimers({ now, toFake: ['Date'] });
        legacy.viewer.updatePredictedTimes(true);
        vi.useRealTimers();

        const table = ourTable(cls, live);
        const view = table.view;
        const pred = updatePredictedTimes(
          view,
          structuredClone(view.results),
          eventClock(now),
          false,
        );
        const ours = new Map<string, string>();
        predictedCells(table, pred).forEach((row, i) =>
          row?.forEach((html, c) => ours.set(`${i}:${c}`, html)),
        );
        expect(Object.fromEntries(ours)).toEqual(Object.fromEntries(cells));

        const marked = new Map<string, string>();
        view.results.forEach((row, i) => {
          const h = highlights(table, row, false, now / 1000);
          if (h.row) marked.set(`row:${i}`, h.row);
          h.cells.forEach((cls, c) => marked.set(`${i}:${c}`, cls));
        });
        const legacyMarked = [...legacy.nodes].filter(([, s]) => s.size > 0);
        expect(Object.fromEntries(marked)).toEqual(
          Object.fromEntries(legacyMarked.map(([k, s]) => [k, [...s].join(' ')])),
        );
      }
    },
  );
});

describe('highlights', () => {
  it('marks results changed within the last minute', () => {
    const [, cls, entries] = cases.find(([name]) => name.startsWith('interval'))!;
    const table = ourTable(cls, entries);
    const changes = table.view.results
      .flatMap((r) => [
        r.changed,
        ...table.view.splitcontrols.map((s) => Number(r.splits[s.code + '_changed'])),
      ])
      .filter((t) => t > 0);
    const now = Math.max(...changes) + 30;
    const count = (t: number) =>
      table.view.results.reduce((n, r) => n + highlights(table, r, false, t).cells.size, 0);
    expect(count(now)).toBeGreaterThan(0);
    expect(count(now + 60)).toBe(0);
  });
});
