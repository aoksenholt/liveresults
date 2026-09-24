import type { Entry, IntermediateTime } from '../api/types';
import { FIXTURES, midRace } from '../test/fixtures';
import type { DisplayFormat } from './format';
import { entryRows } from './organizer';
import { FINISH, lastPassings, passingText, type Passing, type PassingStrings } from './passings';
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

describe('passingText', () => {
  const base: Passing = {
    dbid: 1,
    name: 'Ola Nordmann',
    className: 'H21',
    control: FINISH,
    controlName: '',
    time: 193000,
    status: 0,
    place: 3,
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
