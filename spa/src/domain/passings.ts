import { clubShort, formatTime, nameShort, type DisplayFormat } from './format';
import { startBib } from './lists';
import { Status, type ClassInfo, type ResultRow } from './model';

export interface Passing {
  dbid: number;
  bib: number;
  name: string;
  club: string;
  className: string;
  /** Split control code, or FINISH. */
  control: number;
  controlName: string;
  /** Hundredths; only the status is shown when it is not OK. */
  time: number;
  status: number;
  place: number;
  /** Hundredths behind the best time at the control, null when unknown. */
  behind: number | null;
  /** Unix seconds when Time4o last updated the time. */
  changed: number;
}

export const FINISH = 1000;
const HIDDEN_STATUS: number[] = [Status.NotClassified, Status.OnCourse, Status.NotStarted];
const num = (v: unknown) => (typeof v == 'number' ? v : Number(v) || 0);
const behind = (v: unknown) => (typeof v == 'number' ? v : null);

/**
 * The latest split and finish times, newest first. Time4o has no endpoint for this, so it
 * follows what the legacy `getLastPassings` query selected from the LiveRes database:
 * finish times and the class's split controls, without exchange and lap-time columns.
 * `control` keeps only the passings of that control, as the `code` of the legacy radio.php:
 * FINISH or the number of a control (see `radioControls`).
 */
export function lastPassings(
  rows: ResultRow[],
  classes: ClassInfo[],
  limit = 3,
  control?: number,
): Passing[] {
  const passings: Passing[] = [];
  const splitControls = new Map(classes.map((c) => [c.className, c.splitcontrols]));
  for (const row of rows) {
    const base = {
      dbid: row.dbid,
      bib: row.bib,
      name: row.name,
      club: row.club,
      className: row.class,
    };
    for (const split of control == FINISH ? [] : (splitControls.get(row.class) ?? [])) {
      if (control != null && controlNumber(split.code) != control) continue;
      const time = row.splits[split.code];
      const changed = num(row.splits[`${split.code}_changed`]);
      if (split.code >= 100000 || typeof time != 'number' || time <= 0 || changed <= 0) continue;
      passings.push({
        ...base,
        control: split.code,
        controlName: split.name,
        time,
        status: num(row.splits[`${split.code}_status`]),
        place: num(row.splits[`${split.code}_place`]),
        behind: behind(row.splits[`${split.code}_timeplus`]),
        changed,
      });
    }
    const finished = row.status != Status.OK || row.result > 0;
    const wanted = control == null || control == FINISH;
    if (wanted && !HIDDEN_STATUS.includes(row.status) && finished && row.changed > 0)
      passings.push({
        ...base,
        control: FINISH,
        controlName: '',
        time: row.result,
        status: row.status,
        place: num(row.place),
        behind: behind(row.timeplus),
        changed: row.changed,
      });
  }
  return passings
    .sort((a, b) => b.changed - a.changed || a.dbid - b.dbid || a.control - b.control)
    .slice(0, limit);
}

// Time4o codes are the control number plus 1000 for each visit, negated in unordered classes.
const controlNumber = (code: number) => Math.abs(code) % 1000;
const isVisit = (code: number) => Math.abs(code) >= 1000 && Math.abs(code) < 100000;

export interface RadioControl {
  /** The number on the control flag, which the legacy radio.php takes as `code`. */
  number: number;
  /** How many classes pass it. */
  classes: number;
}

/** The controls with split times in any class, by number. */
export function radioControls(classes: ClassInfo[]): RadioControl[] {
  const counts = new Map<number, number>();
  for (const c of classes) {
    const numbers = c.splitcontrols
      .filter((s) => isVisit(s.code))
      .map((s) => controlNumber(s.code));
    for (const n of new Set(numbers)) counts.set(n, (counts.get(n) ?? 0) + 1);
  }
  return [...counts]
    .map(([number, classes]) => ({ number, classes }))
    .sort((a, b) => a.number - b.number);
}

export interface PassingText {
  /** Clock time of the update in the event time zone. */
  passtime: string;
  name: string;
  className: string;
  /** What happened, e.g. "kom i mål med tiden 32:10 (3)". */
  text: string;
}

export interface PassingStrings {
  finished: string;
  passed: string;
  withTime: string;
  withStatus: string;
  newStatus: string;
}

/** The text of one line, as the legacy `_buildPassingLineHtml`. */
export function passingText(
  p: Passing,
  f: DisplayFormat,
  s: PassingStrings,
  timeZone: string,
): PassingText {
  const passtime = new Date(p.changed * 1000).toLocaleTimeString('en-GB', { timeZone });
  const time = formatTime(p.time, p.status, f.labels, f.language, { showTenths: !!f.showTenths });
  const place = p.control > 0 && p.place > 0 && p.status == 0 ? ` (${p.place})` : '';
  const what =
    p.control == FINISH && p.status > 0 && p.status < 7
      ? s.newStatus
      : (p.control == FINISH ? s.finished : `${s.passed} ${p.controlName}`) +
        ' ' +
        (p.status == Status.FinishedUnordered ? s.withStatus : s.withTime);
  return {
    passtime,
    name: p.name.length > f.maxNameLength ? nameShort(p.name, f.maxNameLength) : p.name,
    className: p.className,
    text: `${what} ${time}${place}`,
  };
}

export interface RadioPassing {
  passtime: string;
  controlName: string;
  bib: string;
  name: string;
  club: string;
  className: string;
  place: string;
  time: string;
  /** "+1:23" behind the best time, empty when not OK or unknown. */
  diff: string;
  /** How the legacy radio.php marks a new passing: yellow for a status, green for a lead. */
  highlight: 'yellow_row' | 'green_row' | 'red_row';
}

/** One row of the passings table of the legacy radio.php. */
export function radioPassing(
  p: Passing,
  f: DisplayFormat,
  timeZone: string,
  finishName: string,
): RadioPassing {
  const ok = p.status == Status.OK;
  const diff = formatTime(p.behind ?? 0, 0, f.labels, f.language, { showTenths: !!f.showTenths });
  return {
    passtime: new Date(p.changed * 1000).toLocaleTimeString('en-GB', { timeZone }),
    controlName: p.control == FINISH ? finishName : p.controlName,
    bib: startBib(p.bib),
    name: p.name.length > f.maxNameLength ? nameShort(p.name, f.maxNameLength) : p.name,
    club: clubShort(p.club, f.maxClubLength),
    className: p.className,
    place: ok && p.place > 0 ? String(p.place) : '',
    time: formatTime(p.time, p.status, f.labels, f.language, { showTenths: !!f.showTenths }),
    diff: ok && p.behind != null && p.behind >= 0 ? `+${diff}` : '',
    highlight:
      p.status >= 1 && p.status <= 6 ? 'yellow_row' : ok && p.place == 1 ? 'green_row' : 'red_row',
  };
}
