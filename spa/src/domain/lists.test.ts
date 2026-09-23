import type { Entry, RaceClass } from '../api/types';
import { FIXTURES, midRace } from '../test/fixtures';
import { createLegacyViewer } from '../test/legacy';
import type { DisplayFormat, TimeLabels } from './format';
import { clubList, resultList, sprintList, startList } from './lists';
import type { ClassInfo, ResultRow } from './model';
import { clubResults, groupedResults, normalizeClasses } from './time4o';

process.env.TZ = 'Europe/Oslo';

const labels: TimeLabels = {
  status: { 0: 'OK', 1: 'DNS', 2: 'DNF', 3: 'MP', 4: 'DSQ', 5: 'OT', 9: '', 10: '', 13: 'Fullf.' },
  freeStart: 'fristart',
  notShown: 'OK',
};
const format: DisplayFormat = { labels, language: 'no', maxNameLength: 15, maxClubLength: 12 };
const resources = {
  _NAME: 'Navn',
  _CLUB: 'Klubb',
  _START: 'Start',
  _CLASS: 'Klasse',
  _CONTROLFINISH: 'Mål',
  _FREESTART: labels.freeStart,
  _STATUSNOTSHOWN: labels.notShown,
};

const all = Object.values(FIXTURES);
const allClasses = normalizeClasses(all.map((f) => f.raceClass));
const allEntries = all.flatMap((f) => f.entries);

type Captured = {
  html: Map<string, string>;
  table?: { columnDefs: LegacyColumn[]; data: ResultRow[] };
};
interface LegacyColumn {
  data: string | null;
  visible?: boolean;
  render?: (data: unknown, type: string, row: ResultRow, meta: { col: number }) => string;
}

function installJQuery(captured: Captured) {
  const $ = (selector: unknown) => {
    const api: object = new Proxy(() => {}, {
      get: (_t, prop) => {
        if (prop == 'html')
          return (v?: string) => (v !== undefined && captured.html.set(String(selector), v), api);
        if (prop == 'DataTable') return (o: Captured['table']) => ((captured.table = o), api);
        return () => api;
      },
    });
    return api;
  };
  Object.assign(globalThis, {
    $: Object.assign($, {
      each: (arr: unknown[], fn: (i: number, v: unknown) => unknown) => {
        for (const [i, v] of arr.entries()) if (fn(i, v) === false) break;
      },
    }),
    DataTable: { Buttons: function () {} },
  });
}

afterEach(() => {
  delete (globalThis as Record<string, unknown>).$;
  delete (globalThis as Record<string, unknown>).DataTable;
});

function legacyViewer(classes: ClassInfo[], state: Record<string, unknown> = {}) {
  return createLegacyViewer({
    Time4oServer: true,
    EmmaServer: false,
    activeClasses: classes,
    resources,
    runnerStatus: labels.status,
    resultsDiv: 'divResults',
    resultsHeaderDiv: 'resultsHeader',
    showTenthOfSecond: false,
    showTimesInSprint: false,
    maxNameLength: format.maxNameLength,
    maxClubLength: format.maxClubLength,
    calculateScrollY: () => 0,
    updateScrollY: () => {},
    ...state,
  });
}

function legacyList(type: string, entries: Entry[], classes: ClassInfo[], state = {}) {
  const captured: Captured = { html: new Map() };
  installJQuery(captured);
  const viewer = legacyViewer(classes, { curClassName: type, ...state });
  viewer.updateClassResults({ status: 'OK', type, data: entries }, false);
  const table = document.createElement('table');
  table.innerHTML = captured.html.get('#divResults') ?? '';
  return table;
}

const normalize = (html: string) => {
  const div = document.createElement('div');
  div.innerHTML = html;
  return div.innerHTML;
};

// Legacy nameShort/clubShort return false for an empty name, printed as "false".
const text = (td: HTMLTableCellElement) => (td.textContent == 'false' ? '' : td.textContent);

const isData = (tr: HTMLTableRowElement) =>
  !tr.hasAttribute('style') && !tr.querySelector('td[colspan], table');

/** Section titles and data rows of a legacy list table, in document order. */
function legacyRows(table: HTMLElement, cell: (td: HTMLTableCellElement[]) => unknown) {
  const out: unknown[] = [];
  for (const tr of Array.from(table.querySelectorAll('tr'))) {
    const title = tr.querySelector(':scope > td[colspan="6"], :scope > td[colspan="5"]');
    if (title && tr.hasAttribute('style') && title.textContent!.trim())
      out.push(title.textContent!.trim());
    else if (isData(tr)) out.push(cell(Array.from(tr.cells)));
  }
  return out;
}

describe('resultList', () => {
  it.each([
    ['finished', allEntries],
    ['mid race', midRace(allEntries)],
  ])('matches the legacy all classes list (%s)', (_name, entries) => {
    const legacy = legacyRows(legacyList('plainresults', entries, allClasses), (td) => ({
      place: td[0]!.textContent,
      qualified: td[0]!.style.backgroundColor == 'lightgreen',
      name: text(td[1]!),
      club: text(td[2]!),
      time: td[3]!.innerHTML,
      diff: td[4]!.innerHTML,
    }));
    const ours = resultList(groupedResults(entries, 'plainresults', allClasses), format).flatMap(
      (s) => [
        s.title,
        ...s.rows.map((r) => ({ ...r, time: normalize(r.time), diff: normalize(r.diff!) })),
      ],
    );
    expect(ours.map(strip)).toEqual(legacy);
  });
});

const strip = (v: unknown) =>
  typeof v == 'object' && v
    ? Object.fromEntries(
        Object.entries(v).filter(([k, x]) => k != 'clubId' && k != 'className' && x !== null),
      )
    : v;

describe('startList', () => {
  it('matches the legacy start list', () => {
    const entries = midRace(allEntries).map((e, i) =>
      i % 7 == 3 ? ({ ...e, status: { status: 'DidNotStart' } } as Entry) : e,
    );
    const legacy = legacyRows(legacyList('startlist', entries, allClasses), (td) => ({
      bib: td[0]!.textContent,
      name: td[1]!.textContent,
      club: td[2]!.textContent,
      start: td[3]!.textContent,
      ecards: td[4]!.textContent!.replace(/\u00a0$/, ''),
      dns: !!td[1]!.querySelector('del'),
    }));
    const ours = startList(groupedResults(entries, 'startlist', allClasses), format).flatMap(
      (s) => [s.className, ...s.rows],
    );
    expect(ours.map(strip)).toEqual(legacy);
    expect(ours.some((r) => typeof r == 'object' && r.dns)).toBe(true);
  });
});

describe('sprintList', () => {
  const base = FIXTURES.chase!;
  const heat = (name: string, qualificationLimit?: number) =>
    ({ ...base.raceClass, id: name, name, qualificationLimit }) as RaceClass;
  const heats = [
    heat('H21 | Prolog', 6),
    heat('H21 | Kvart 1', 3),
    heat('H21 | Kvart 2', 3),
    heat('H21 | Semi 1', 2),
    heat('H21 | Finale'),
    heat('H21 NM KO Total'),
    heat('D21 | Prolog'),
  ];
  const classes = normalizeClasses(heats);
  const entries = base.entries.map(
    (e, i) => ({ ...e, raceClassId: heats[i % heats.length]!.id }) as Entry,
  );

  it.each([
    ['finished', entries, false],
    ['mid race', midRace(entries), false],
    ['finished with times', entries, true],
    ['mid race with times', midRace(entries), true],
  ])('matches the legacy sprint list (%s)', (_name, live, showTimesInSprint) => {
    const table = legacyList('plainresultsclass_H21', live, classes, { showTimesInSprint });
    const columns = Array.from(table.querySelectorAll(':scope > tbody > tr > td')).map((col) =>
      legacyRows(col as HTMLElement, (td) => ({
        place: td[0]!.textContent,
        qualified: td[0]!.style.backgroundColor == 'lightgreen',
        name: text(td[1]!),
        ...(td.length == 4 ? { club: text(td[2]!) } : {}),
        time: td.at(-1)!.innerHTML,
      })),
    );
    const ours = sprintList(groupedResults(live, 'sprint', classes), 'H21', {
      ...format,
      showTimesInSprint,
    }).map((col) =>
      col.flatMap((s) => [s.title, ...s.rows.map((r) => strip({ ...r, time: normalize(r.time) }))]),
    );
    expect(ours).toEqual(columns);
    expect(ours).toHaveLength(4);
  });
});

describe('clubList', () => {
  const clubId = 10;
  const entries = allEntries.filter((e) => e.organisation?.id == clubId);

  function legacyClub(live: Entry[]) {
    const captured: Captured = { html: new Map() };
    installJQuery(captured);
    const viewer = legacyViewer(allClasses, { curClubName: 'x', updateClassRunnerCount: () => {} });
    viewer.updateClubResults({ status: 'OK', data: live }, false);
    const { columnDefs: columns, data } = captured.table!;
    return new Map(
      data.map((row) => [
        row.dbid,
        columns.map((c, col) => {
          const v = c.data == null ? row : row[c.data as keyof ResultRow];
          return c.render ? String(c.render(v, 'display', row, { col })) : String(v);
        }),
      ]),
    );
  }

  it.each([
    ['finished', entries],
    ['mid race', midRace(entries)],
  ])('renders the columns of the legacy club table (%s)', (_name, live) => {
    const legacy = legacyClub(live);
    const { rows, hasPace } = clubList(clubResults(live, allClasses).results, format);
    expect(rows).toHaveLength(legacy.size);
    for (const r of rows) {
      const l = legacy.get(r.row.dbid)!;
      expect([l[0], l[2], l[4], l[6], l[8], l[10], hasPace ? l[11] : '']).toEqual([
        r.row.place,
        r.name,
        r.bib,
        r.start,
        r.finish,
        r.diff,
        r.pace,
      ]);
    }
  });

  it('orders by place, then start time and bib', () => {
    const row = (place: string, start: number, bib: number) =>
      ({
        place,
        start,
        bib,
        name: `${place}/${start}/${bib}`,
        result: 0,
        timeplus: 0,
      }) as ResultRow;
    const rows = [
      row('-', 100, 1),
      row('', 200, 2),
      row('', 100, 3),
      row('2', 0, 4),
      row('F', 0, 9),
      row('1', 0, 6),
      row('', -999, 7),
      row('', 100, -102),
    ];
    expect(clubList(rows, format).rows.map((r) => r.row.name)).toEqual([
      'F/0/9',
      '1/0/6',
      '2/0/4',
      '/100/3',
      '/100/-102',
      '/200/2',
      '/-999/7',
      '-/100/1',
    ]);
  });
});
