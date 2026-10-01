import type { DisplayFormat } from './format';
import { clubRows, type ClubRow } from './lists';
import { Status, type ClassInfo, type ResultRow } from './model';
import { FINISH, lastPassings, UNORDERED_TIME, type Passing } from './passings';

/** The favourite runners of a race, by `dbid` (the Time4o person id). */
export function parseFavourites(text: string): number[] | null {
  try {
    const list: unknown = JSON.parse(text);
    return Array.isArray(list)
      ? list.filter((n): n is number => Number.isInteger(n) && n > 0)
      : null;
  } catch {
    return null;
  }
}

export const formatFavourites = (favourites: number[]) => JSON.stringify(favourites);

export const canBeFavourite = (row: { dbid: number }) => row.dbid > 0;

export const toggleFavourite = (favourites: number[], dbid: number) =>
  favourites.includes(dbid) ? favourites.filter((d) => d != dbid) : [...favourites, dbid];

export interface FavouriteRow extends ClubRow {
  /** The newest split time of a runner still on course. */
  latest: Passing | null;
}

export interface FavouriteList {
  rows: FavouriteRow[];
  /** Split and finish times of the favourites, newest first. */
  passings: Passing[];
}

const onCourse = (r: ResultRow) =>
  r.result <= 0 && ([Status.OK, Status.OnCourse, Status.NotStarted] as number[]).includes(r.status);

/**
 * The favourites in every class they run, in the order of the classes and by name, with the
 * columns of the club table.
 */
export function favouriteList(
  rows: ResultRow[],
  classes: ClassInfo[],
  favourites: Set<number>,
  f: DisplayFormat,
): FavouriteList {
  const order = new Map(classes.map((c, i) => [c.className, i]));
  const at = (r: ResultRow) => order.get(r.class) ?? classes.length;
  const chosen = rows
    .filter((r) => favourites.has(r.dbid))
    .sort((a, b) => at(a) - at(b) || a.name.localeCompare(b.name, 'no'));
  const passings = lastPassings(chosen, classes, Infinity);
  const latest = (r: ResultRow) =>
    (onCourse(r) &&
      passings.find(
        (p) =>
          p.dbid == r.dbid &&
          p.className == r.class &&
          p.control != FINISH &&
          p.control != UNORDERED_TIME,
      )) ||
    null;
  return {
    rows: clubRows(chosen, f).map((row) => ({ ...row, latest: latest(row.row) })),
    passings,
  };
}
