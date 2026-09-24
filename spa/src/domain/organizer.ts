import type { Entry } from '../api/types';
import { runnerClub, runnerName } from './classTable';
import { formatTime, type DisplayFormat } from './format';
import { ecards, startBib } from './lists';
import { FREE_START, Status, type ClassInfo, type ResultRow } from './model';
import { normalizeEntry, type NormalizeOptions } from './time4o';

/** Every runner in the race, like the legacy `Time4oEntryListToLiveres`. */
export function entryRows(
  entries: Entry[],
  classes: ClassInfo[],
  opts?: NormalizeOptions,
): ResultRow[] {
  return entries
    .map((e) =>
      normalizeEntry(
        e,
        classes.find((c) => c.id === e?.raceClassId),
        opts,
      ),
    )
    .filter((r): r is ResultRow => r != null);
}

export function sortLeftInForest(a: ResultRow, b: ResultRow): number {
  const clubDiff = (a.club || '').toString().localeCompare((b.club || '').toString());
  if (clubDiff != 0) return clubDiff;
  const startDiff = (a.start || 0) - (b.start || 0);
  if (startDiff != 0) return startDiff;
  return (a.name || '').toString().localeCompare((b.name || '').toString());
}

/** Runners on course or not yet started, as in the legacy radio view with code -2. */
export function leftInForest(rows: ResultRow[]): ResultRow[] {
  return rows
    .filter((r) => r.status == Status.OnCourse || r.status == Status.NotStarted)
    .sort(sortLeftInForest);
}

/** Latest start first; runners with unknown ecards (negative dbid) on top. */
export function startSorter(a: ResultRow, b: ResultRow): number {
  const diffStart = b.start - a.start;
  if (a.dbid < 0 && b.dbid > 0) return -1;
  if (a.dbid > 0 && b.dbid < 0) return 1;
  if (diffStart != 0) return diffStart;
  if (a.start == FREE_START) return a.bib - b.bib;
  return b.bib - a.bib;
}

export const startRegistration = (rows: ResultRow[]) => rows.slice().sort(startSorter);

export interface StartWindow {
  /** Minutes shown in grey before the call time. */
  preTime: number;
  /** Minutes before the start when runners are called, shown in yellow. */
  callTime: number;
  /** Minutes the runners stay in the list after their start. */
  postTime: number;
  minBib?: number | null;
  maxBib?: number | null;
  openStart: boolean;
}

export interface StartMark {
  show: boolean;
  /** Row classes of the legacy table. */
  classes: string[];
  /** Hundredths since the start time, negative before it. */
  timeToStart: number;
}

/** 0: none, 1: short beep before the start, 2: long beep at the start. */
export type StartBeep = 0 | 1 | 2;

const SHOWN_STATUS: number[] = [Status.DNS, Status.OnCourse, Status.NotStarted];
const BEEP_SECONDS = 4;

/**
 * Which runners the start view shows and how they are highlighted at `time`
 * (seconds since midnight in the event time zone), ported from the legacy
 * `filterStartRegistration` for rows sorted by `startSorter`.
 */
export function startMarks(
  rows: ResultRow[],
  time: number,
  w: StartWindow,
): { marks: StartMark[]; beep: StartBeep } {
  const [preTime, callTime, postTime] = [w.preTime * 60, w.callTime * 60, w.postTime * 60];
  let firstUnknown = true;
  let firstOpen = true;
  let firstInCallTime = true;
  let firstInPostTime = true;
  let lastStartTime = -1000;
  let beep: StartBeep = 0;

  const marks = rows.map((row): StartMark => {
    const mark: StartMark = { show: false, classes: [], timeToStart: 0 };
    const add = (...c: string[]) => mark.classes.push(...c);
    if (
      (w.minBib != null && row.bib < w.minBib) ||
      (w.maxBib != null && row.bib > w.maxBib) ||
      !SHOWN_STATUS.includes(row.status)
    )
      return mark;

    if (row.dbid < 0) {
      mark.show = true;
      if (firstUnknown) {
        add('firstnonqualifier');
        firstUnknown = false;
      }
      add('red_row');
      return mark;
    }

    if (w.openStart) {
      if (row.start == FREE_START) {
        mark.show = true;
        if (firstOpen) {
          add('firstnonqualifier');
          firstOpen = false;
        }
      }
    } else {
      const startTimeSeconds = row.start / 100;
      const timeToStart = startTimeSeconds - time;
      mark.timeToStart = -timeToStart * 100;

      if (timeToStart == 0) beep = 2;
      else if (beep == 0 && timeToStart > 0 && timeToStart <= BEEP_SECONDS) beep = 1;

      if (timeToStart <= -postTime) return mark;
      if (timeToStart <= 0) {
        mark.show = true;
        add('pre_post_start');
        if (firstInPostTime) {
          add('firststarter');
          firstInPostTime = false;
        }
      } else if (timeToStart <= callTime) {
        mark.show = true;
        if (firstInCallTime) {
          add('firststarter', 'yellow_row');
          firstInCallTime = false;
        } else if (lastStartTime - startTimeSeconds > 29) add('yellow_row_new');
        else add('yellow_row');
      } else if (timeToStart <= callTime + preTime) {
        mark.show = true;
        add('pre_post_start');
      }
      lastStartTime = startTimeSeconds;
    }
    if (row.status == Status.DNS) add('dns');
    return mark;
  });
  return { marks, beep };
}

export interface OrganizerRow {
  dbid: number;
  bib: string;
  name: string;
  club: string;
  className: string;
  start: string;
  ecards: string;
  checked: boolean;
  /** What the legacy DataTables filter searched in. */
  searchText: string;
}

/** The columns shared by the legacy left-in-forest and start registration tables. */
export function organizerRow(row: ResultRow, f: DisplayFormat): OrganizerRow {
  const start = formatTime(row.start, 0, f.labels, f.language, {
    showHours: true,
    padZeros: false,
    clockTime: true,
  });
  return {
    dbid: row.dbid,
    bib: startBib(row.bib),
    name: runnerName(row, f.maxNameLength),
    club: runnerClub(row, f.maxClubLength),
    className: row.class,
    start,
    ecards: ecards(row),
    checked: row.status == Status.OnCourse,
    searchText: [Math.abs(row.bib), row.name, row.club, row.class, ecards(row), start]
      .join('  ')
      .toLowerCase(),
  };
}

/** DataTables smart search: every word, or quoted phrase, must occur somewhere in the row. */
export function matchesSearch(searchText: string, query: string): boolean {
  const words = query.toLowerCase().match(/"[^"]+"|[^ ]+/g) ?? [];
  return words.every((w) => searchText.includes(w.replace(/^"(.*)"$/, '$1')));
}

/** The legacy diff column: time since the start, "-" before it. */
export function timeToStartText(timeToStart: number, f: DisplayFormat): string {
  const time = formatTime(Math.abs(timeToStart), 0, f.labels, f.language);
  return (timeToStart < 0 ? '-' : '+') + time;
}
