import type { Entry, IntermediateTime } from '../api/types';
import { FIXTURES, midRace } from '../test/fixtures';
import type { DisplayFormat } from './format';
import { entryRows } from './organizer';
import {
  FINISH,
  lastPassings,
  passingText,
  radioControls,
  radioPassing,
  type Passing,
  type PassingStrings,
} from './passings';
import { normalizeClasses } from './time4o';

const format: DisplayFormat = {
  labels: { status: { 0: 'OK', 2: 'DNF', 13: 'Fullf.' }, freeStart: '', notShown: '' },
  language: 'no',
  maxNameLength: 22,
  maxClubLength: 15,
};
const strings: PassingStrings = {
  finished: 'kom i mål',
  passed: 'passerte',
  withTime: 'med tiden',
  withStatus: 'med status',
  newStatus: 'fikk ny status:',
};
const all = Object.values(FIXTURES);
const classes = normalizeClasses(all.map((f) => f.raceClass));
const rows = (entries: Entry[]) => entryRows(entries, classes);
const seconds = (iso?: string | null) => (iso ? Date.parse(iso) / 1000 : 0);

describe('lastPassings', () => {
  const interval = FIXTURES.interval!.entries;

  it('lists every split and finish time, newest first', () => {
    const splits = interval.flatMap((e) =>
      Object.values((e.intermediateTimes ?? {}) as Record<string, IntermediateTime>).filter(
        (t) => t.time != null && t.behind != null && t.position != null,
      ),
    );
    const updated = (e: Entry) => e.time?.updated ?? e.status?.updated;
    const finished = interval.filter((e) => e.status?.status != 'Active' && updated(e));
    const passings = lastPassings(rows(interval), classes, Infinity);

    expect(passings).toHaveLength(splits.length + finished.length);
    const changed = passings.map((p) => p.changed);
    expect(changed).toEqual(changed.toSorted((a, b) => b - a));
    const newest = Math.max(
      ...splits.map((t) => seconds(t.updated)),
      ...finished.map((e) => seconds(updated(e))),
    );
    expect(changed[0]).toBe(newest);
  });

  it('keeps the three latest by default', () => {
    expect(lastPassings(rows(interval), classes)).toEqual(
      lastPassings(rows(interval), classes, Infinity).slice(0, 3),
    );
  });

  it('shows splits but not the finish of runners on course', () => {
    const passings = lastPassings(rows(midRace(interval)), classes, Infinity);
    const onCourse = new Set(
      rows(midRace(interval))
        .filter((r) => r.status == 9 || r.status == 10)
        .map((r) => r.dbid),
    );
    const theirs = passings.filter((p) => onCourse.has(p.dbid));
    expect(theirs.length).toBeGreaterThan(0);
    expect(theirs.every((p) => p.control != FINISH)).toBe(true);
  });

  it('leaves out exchange and lap-time columns', () => {
    const entries = all.flatMap((f) => f.entries);
    const passings = lastPassings(rows(entries), classes, Infinity);
    expect(passings.some((p) => p.className.match(/-\d+$/))).toBe(true);
    expect(passings.every((p) => p.control < 100000)).toBe(true);
    expect(passings.every((p) => p.control == FINISH || p.controlName)).toBe(true);
  });
});

describe('lastPassings of one control', () => {
  const interval = FIXTURES.interval!.entries;
  const every = lastPassings(rows(interval), classes, Infinity);

  it('keeps only the finish or only one split control', () => {
    const finish = lastPassings(rows(interval), classes, Infinity, FINISH);
    expect(finish).toEqual(every.filter((p) => p.control == FINISH));
    const split = every.find((p) => p.control != FINISH)!.control % 1000;
    const atSplit = lastPassings(rows(interval), classes, Infinity, split);
    expect(atSplit.length).toBeGreaterThan(0);
    expect(atSplit).toEqual(every.filter((p) => p.control != FINISH && p.control % 1000 == split));
  });

  it('carries bib, club and the time behind the best', () => {
    const row = rows(interval).find((r) => r.status == 0 && r.result > 0 && r.place == '1')!;
    const own = every.find((p) => p.dbid == row.dbid && p.control == FINISH)!;
    expect(own).toMatchObject({ bib: row.bib, club: row.club, behind: 0, place: 1 });
    const second = every.find((p) => p.control == FINISH && p.place == 2)!;
    expect(second.behind).toBeGreaterThan(0);
  });
});

describe('radioControls', () => {
  const info = (name: string, codes: number[]) =>
    ({
      className: name,
      splitcontrols: codes.map((code) => ({ code, order: 0, name: '', updated: true })),
    }) as unknown as (typeof classes)[number];

  it('counts the classes passing each control number', () => {
    expect(
      radioControls([
        info('H21', [1070, 2070, 1031, 100000 + 1031, 999]),
        info('D21', [-1070, 0]),
        info('H16', [1133]),
      ]),
    ).toEqual([
      { number: 31, classes: 1 },
      { number: 70, classes: 2 },
      { number: 133, classes: 1 },
    ]);
  });
});

describe('passingText', () => {
  const base: Passing = {
    dbid: 1,
    bib: 101,
    name: 'Ola Nordmann',
    club: 'Nordmarka OK',
    className: 'H21',
    control: FINISH,
    controlName: '',
    time: 193000,
    status: 0,
    place: 3,
    behind: 8300,
    changed: seconds('2026-09-19T11:34:32+00:00'),
  };
  const text = (p: Partial<Passing>) =>
    passingText({ ...base, ...p }, format, strings, 'Europe/Oslo');

  it('writes finish times with place in the event time zone', () => {
    expect(text({})).toEqual({
      passtime: '13:34:32',
      name: 'Ola Nordmann',
      className: 'H21',
      text: 'kom i mål med tiden 32:10 (3)',
    });
  });

  it('writes splits, new statuses and unordered classes', () => {
    expect(text({ control: 1031, controlName: '2.4 km', time: 60000, place: 1 }).text).toBe(
      'passerte 2.4 km med tiden 10:00 (1)',
    );
    expect(text({ status: 2 }).text).toBe('fikk ny status: DNF');
    expect(text({ status: 13, place: 0 }).text).toBe('kom i mål med status Fullf.');
    expect(text({ control: -1031, controlName: '2.4 km', place: 1 }).text).toBe(
      'passerte 2.4 km med tiden 32:10',
    );
  });
});

describe('radioPassing', () => {
  const base = {
    dbid: 1,
    bib: 101,
    name: 'Ola Nordmann',
    club: 'Nordmarka OK',
    className: 'H21',
    control: FINISH,
    controlName: '',
    time: 193000,
    status: 0,
    place: 1,
    behind: 0,
    changed: seconds('2026-09-19T11:34:32+00:00'),
  };
  const row = (p: Partial<Passing>) =>
    radioPassing({ ...base, ...p }, format, 'Europe/Oslo', 'Mål');

  it('gives the columns of the legacy radio.php', () => {
    expect(row({})).toEqual({
      passtime: '13:34:32',
      controlName: 'Mål',
      bib: '101',
      name: 'Ola Nordmann',
      club: 'Nordmarka OK',
      className: 'H21',
      place: '1',
      time: '32:10',
      diff: '+0:00',
      highlight: 'green_row',
    });
  });

  it('marks others red and statuses yellow, without place or diff', () => {
    expect(row({ place: 3, behind: 8300 })).toMatchObject({
      place: '3',
      diff: '+1:23',
      highlight: 'red_row',
    });
    expect(row({ status: 2, place: 0, behind: null })).toMatchObject({
      place: '',
      time: 'DNF',
      diff: '',
      highlight: 'yellow_row',
    });
    expect(row({ control: 1031, controlName: '2.4 km', bib: -1203 })).toMatchObject({
      controlName: '2.4 km',
      bib: '12-3',
    });
  });
});
