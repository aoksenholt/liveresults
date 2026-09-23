import { createLegacyViewer } from '../test/legacy';
import type { ResultRow, SplitControl } from './model';
import { compareResults, sortClasses, splitSort, startListSorter } from './sorting';

const legacy = createLegacyViewer();

const CLASS_NAMES = [
  'H 21',
  'D 21',
  'H 21E',
  'D 21-E',
  'H 9',
  'H 10',
  'H 100',
  'Åpen 1',
  'Gjest',
  'Direkte',
  'NM Elite',
  'H 16 Finale',
  'H 16 Semi',
  'H 16 Kvart',
  'H 16 Prolog',
  'D/H-16 (3 km)',
  'Nybegynner',
];

describe('sortClasses', () => {
  it('orders class names like the legacy viewer', () => {
    const classes = CLASS_NAMES.map((className) => ({ className }));
    expect(sortClasses(classes).map((c) => c.className)).toEqual(
      legacy.sortClasses(classes).map((c: { className: string }) => c.className),
    );
  });

  it('puts elite first, numbers in natural order and open classes last', () => {
    const sorted = sortClasses(
      ['Åpen', 'H 10', 'H 9', 'H 21E'].map((className) => ({ className })),
    );
    expect(sorted.map((c) => c.className)).toEqual(['H 21E', 'H 9', 'H 10', 'Åpen']);
  });

  it('prefers explicit order over name', () => {
    const sorted = sortClasses([
      { className: 'A', order: 2 },
      { className: 'B', order: 1 },
    ]);
    expect(sorted.map((c) => c.className)).toEqual(['B', 'A']);
  });

  it('orders sprint heats prolog, quarter, semi, final', () => {
    const heats = ['H 16 Finale', 'H 16 Semi', 'H 16 Prolog', 'H 16 Kvart'].map((className) => ({
      className,
    }));
    expect(sortClasses(heats).map((c) => c.className)).toEqual([
      'H 16 Prolog',
      'H 16 Kvart',
      'H 16 Semi',
      'H 16 Finale',
    ]);
  });
});

const row = (overrides: Partial<ResultRow>) => ({ splits: {}, ...overrides }) as ResultRow;

const ROWS = [
  row({ dbid: 1, place: '1', status: 0, result: 1000, bib: 3 }),
  row({ dbid: 2, place: '2', status: 0, result: 1100, bib: 2 }),
  row({ dbid: 3, place: '=', status: 0, result: 1100, bib: 1 }),
  row({ dbid: 4, place: '-', status: 3, result: -3, bib: 4 }),
  row({ dbid: 5, place: '-', status: 1, result: -3, bib: 5 }),
  row({ dbid: 6, place: '', status: 9, result: -3, bib: 6 }),
  row({ dbid: 7, place: 'F', status: 13, result: 42, bib: 7 }),
];

describe('compareResults', () => {
  it.each([true, false])(
    'compares all pairs like the legacy viewer (unfinishedFirst: %s)',
    (first) => {
      for (const a of ROWS)
        for (const b of ROWS)
          expect(Math.sign(compareResults(a, b, first))).toBe(
            Math.sign(legacy.compareResults(a, b, first)),
          );
    },
  );

  it('ranks finished before disqualified and ties after the placed runner', () => {
    const sorted = ROWS.slice().sort((a, b) => compareResults(a, b, false));
    expect(sorted.map((r) => r.dbid)).toEqual([7, 1, 2, 3, 4, 5, 6]);
  });
});

describe('startListSorter', () => {
  it('sorts by start time, then bib, then id', () => {
    const rows = [
      row({ dbid: 3, start: 200, bib: 1 }),
      row({ dbid: 2, start: 100, bib: 2 }),
      row({ dbid: 1, start: 100, bib: 2 }),
      row({ dbid: 4, start: 100, bib: 1 }),
    ];
    expect(rows.sort(startListSorter).map((r) => r.dbid)).toEqual([4, 1, 2, 3]);
  });
});

describe('splitSort', () => {
  it('sorts by split time with missing times last, like the legacy viewer', () => {
    const splits: SplitControl[] = [{ code: 1031, order: 1, name: 'R1', updated: false }];
    const rows = [
      row({ dbid: 1, splits: { 1031: 500 } }),
      row({ dbid: 2, splits: {} }),
      row({ dbid: 3, splits: { 1031: 300 } }),
      row({ dbid: 4, splits: { 1031: '' } }),
    ];
    const ours = rows.slice().sort(splitSort(0, splits));
    const theirs = rows.slice().sort(legacy.splitSort(0, splits));
    expect(ours.map((r) => r.dbid)).toEqual(theirs.map((r: ResultRow) => r.dbid));
    expect(ours.slice(0, 2).map((r) => r.dbid)).toEqual([3, 1]);
  });
});
