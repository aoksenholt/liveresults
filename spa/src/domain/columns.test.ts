import { describe, expect, it } from 'vitest';
import type { Column } from './classTable';
import {
  columnChoices,
  hiddenIn,
  NO_HIDDEN_COLUMNS,
  parseHiddenColumns,
  showAllColumns,
  toggleColumn,
  withoutHidden,
} from './columns';

const col = (c: Partial<Column> & Pick<Column, 'kind'>): Column => ({
  title: c.kind,
  visible: true,
  ...c,
});

// An individual class with splits: name and club in one column, as legacy builds it.
const withSplits: Column[] = [
  col({ kind: 'place', title: '#' }),
  col({ kind: 'runner', title: 'Navn / Klubb', layout: 'nameClub' }),
  col({ kind: 'bib', title: '№' }),
  col({ kind: 'start', title: 'Start' }),
  col({ kind: 'split', title: '1.9 km', code: 1031 }),
  col({ kind: 'hidden', visible: false }),
  col({ kind: 'split', title: 'Bad', code: 1032, visible: false }),
  col({ kind: 'hidden', visible: false }),
  col({ kind: 'finish', title: 'Mål' }),
  col({ kind: 'hidden', visible: false }),
  col({ kind: 'diff', title: 'Diff' }),
];

// A class without splits: separate name and club columns.
const noSplits: Column[] = [
  col({ kind: 'place', title: '#' }),
  col({ kind: 'runner', title: 'Navn', layout: 'name' }),
  col({ kind: 'runner', title: 'Klubb', layout: 'club' }),
  col({ kind: 'start', title: 'Start' }),
  col({ kind: 'finish', title: 'Mål' }),
];

// A relay leg: the team comes first and always shows.
const relay: Column[] = [
  col({ kind: 'place', title: '#' }),
  col({ kind: 'runner', title: 'Klubb', layout: 'club' }),
  col({ kind: 'runner', title: 'Navn', layout: 'name' }),
  col({ kind: 'start', title: 'Start' }),
  col({ kind: 'finish', title: 'Mål' }),
];

describe('columnChoices', () => {
  it('lists every shown column but place and name, in table order', () => {
    expect(columnChoices(withSplits, false, 'Klubb')).toEqual([
      { key: 'club', title: 'Klubb' },
      { key: 'bib', title: '№' },
      { key: 'start', title: 'Start' },
      { key: 'split:1031', title: '1.9 km' },
      { key: 'finish', title: 'Mål' },
      { key: 'diff', title: 'Diff' },
    ]);
  });

  it('offers the club of a class without splits', () => {
    expect(columnChoices(noSplits, false, 'Klubb').map((c) => c.key)).toEqual([
      'club',
      'start',
      'finish',
    ]);
  });

  it('keeps the team of a relay', () => {
    expect(columnChoices(relay, true, 'Klubb').map((c) => c.key)).toEqual(['start', 'finish']);
  });
});

describe('withoutHidden', () => {
  it('leaves out the hidden columns and keeps the indices of the others', () => {
    const shown = withoutHidden(withSplits, false, new Set(['start', 'split:1031']));
    expect(shown.map(([c, i]) => [c.kind, i])).toEqual([
      ['place', 0],
      ['runner', 1],
      ['bib', 2],
      ['finish', 8],
      ['diff', 10],
    ]);
  });

  it('drops the club out of the combined column', () => {
    const [runner] = withoutHidden(withSplits, false, new Set(['club']))[1]!;
    expect(runner.layout).toBe('name');
    expect(withSplits[1]!.layout).toBe('nameClub');
  });

  it('drops the club column of a class without splits', () => {
    const shown = withoutHidden(noSplits, false, new Set(['club']));
    expect(shown.map(([c]) => c.layout ?? c.kind)).toEqual(['place', 'name', 'start', 'finish']);
  });

  it('keeps the team of a relay', () => {
    expect(withoutHidden(relay, true, new Set(['club']))).toHaveLength(5);
  });
});

describe('toggleColumn', () => {
  it('hides the common columns in every class of the race', () => {
    const hidden = toggleColumn(NO_HIDDEN_COLUMNS, 'H17-', 'start');
    expect(hiddenIn(hidden, 'D17-')).toEqual(new Set(['start']));
  });

  it('hides a split only in its class', () => {
    const hidden = toggleColumn(NO_HIDDEN_COLUMNS, 'H17-', 'split:1031');
    expect(hiddenIn(hidden, 'H17-')).toEqual(new Set(['split:1031']));
    expect(hiddenIn(hidden, 'D17-')).toEqual(new Set());
  });

  it('shows a hidden column again', () => {
    const once = toggleColumn(NO_HIDDEN_COLUMNS, 'H17-', 'split:1031');
    expect(toggleColumn(once, 'H17-', 'split:1031')).toEqual(NO_HIDDEN_COLUMNS);
  });
});

describe('showAllColumns', () => {
  it('shows the common columns and the splits of the class, but not those of other classes', () => {
    let hidden = toggleColumn(NO_HIDDEN_COLUMNS, 'H17-', 'start');
    hidden = toggleColumn(hidden, 'H17-', 'split:1031');
    hidden = toggleColumn(hidden, 'D17-', 'split:1031');
    expect(showAllColumns(hidden, 'H17-')).toEqual({
      common: [],
      classes: { 'D17-': ['split:1031'] },
    });
  });
});

describe('parseHiddenColumns', () => {
  it('reads what was stored', () => {
    const hidden = { common: ['start'], classes: { 'H17-': ['split:1031'] } };
    expect(parseHiddenColumns(JSON.stringify(hidden))).toEqual(hidden);
  });

  it('falls back to nothing hidden', () => {
    expect(parseHiddenColumns(null)).toEqual(NO_HIDDEN_COLUMNS);
    expect(parseHiddenColumns('not json')).toEqual(NO_HIDDEN_COLUMNS);
    expect(parseHiddenColumns('[1]')).toEqual({ common: [], classes: {} });
  });

  it('leaves out what is not a string', () => {
    expect(parseHiddenColumns('{"common":["start",3],"classes":{"H17-":[null]}}')).toEqual({
      common: ['start'],
      classes: { 'H17-': [] },
    });
  });
});
