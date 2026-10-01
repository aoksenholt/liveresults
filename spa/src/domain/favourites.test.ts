import { FIXTURES, midRace } from '../test/fixtures';
import {
  canBeFavourite,
  favouriteList,
  formatFavourites,
  parseFavourites,
  toggleFavourite,
} from './favourites';
import type { DisplayFormat } from './format';
import { clubRows } from './lists';
import { entryRows } from './organizer';
import { FINISH, lastPassings } from './passings';
import { normalizeClasses } from './time4o';

const format: DisplayFormat = {
  labels: { status: { 0: 'OK', 2: 'DNF', 13: 'Fullf.' }, freeStart: '', notShown: '' },
  language: 'no',
  maxNameLength: 22,
  maxClubLength: 15,
};
const all = Object.values(FIXTURES);
const classes = normalizeClasses(all.map((f) => f.raceClass));

describe('favourites', () => {
  it('reads what was stored and ignores the rest', () => {
    expect(parseFavourites(formatFavourites([12, 7]))).toEqual([12, 7]);
    expect(parseFavourites('[1, "2", 0, -3, 1.5]')).toEqual([1]);
    expect(parseFavourites('{}')).toBeNull();
    expect(parseFavourites('[')).toBeNull();
  });

  it('adds and removes a runner', () => {
    expect(toggleFavourite([1], 2)).toEqual([1, 2]);
    expect(toggleFavourite([1, 2], 1)).toEqual([2]);
  });

  it('only marks runners with a person id', () => {
    expect(canBeFavourite({ dbid: 5 })).toBe(true);
    expect(canBeFavourite({ dbid: 0 })).toBe(false);
  });
});

describe('favouriteList', () => {
  const entries = all.flatMap((f) => midRace(f.entries));
  const rows = entryRows(entries, classes);

  it('lists the favourites in the order of the classes, with the club table columns', () => {
    const picked = [rows.at(-1)!, rows[1]!, rows[0]!];
    const list = favouriteList(rows, classes, new Set(picked.map((r) => r.dbid)), format);
    const index = (className: string) => classes.findIndex((c) => c.className == className);
    const order = list.rows.map((r) => index(r.row.class));
    expect(order).toEqual(order.toSorted((a, b) => a - b));
    expect(list.rows.map((r) => r.row.dbid).toSorted()).toEqual(
      rows
        .filter((r) => picked.some((p) => p.dbid == r.dbid))
        .map((r) => r.dbid)
        .toSorted(),
    );
    expect(list.rows[0]).toEqual({
      ...clubRows([list.rows[0]!.row], format)[0],
      latest: list.rows[0]!.latest,
    });
  });

  it('gives every split and finish time of the favourites, newest first', () => {
    const favourites = new Set(rows.slice(0, 20).map((r) => r.dbid));
    const { passings } = favouriteList(rows, classes, favourites, format);
    const theirs = rows.filter((r) => favourites.has(r.dbid));
    expect(passings).toEqual(lastPassings(theirs, classes, Infinity));
    expect(passings.length).toBeGreaterThan(0);
  });

  it('shows the newest split time of runners still on course', () => {
    const favourites = new Set(rows.map((r) => r.dbid));
    const list = favouriteList(rows, classes, favourites, format);
    const onCourse = list.rows.filter((r) => r.latest);
    expect(onCourse.length).toBeGreaterThan(0);
    for (const r of onCourse) {
      expect(r.row.result).toBeLessThanOrEqual(0);
      expect(r.latest!.control).not.toBe(FINISH);
      const newer = list.passings.filter(
        (p) => p.dbid == r.row.dbid && p.className == r.row.class && p.changed > r.latest!.changed,
      );
      expect(newer.every((p) => p.control == FINISH)).toBe(true);
    }
    expect(list.rows.filter((r) => r.row.result > 0).every((r) => r.latest == null)).toBe(true);
  });

  it('is empty without favourites', () => {
    expect(favouriteList(rows, classes, new Set(), format)).toEqual({ rows: [], passings: [] });
  });
});
