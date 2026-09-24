import { formatTime, nameShort, type DisplayFormat } from './format';
import { Status, type ClassInfo, type ResultRow } from './model';

export interface Passing {
  dbid: number;
  name: string;
  className: string;
  /** Split control code, or FINISH. */
  control: number;
  controlName: string;
  /** Hundredths; only the status is shown when it is not OK. */
  time: number;
  status: number;
  place: number;
  /** Unix seconds when Time4o last updated the time. */
  changed: number;
}

export const FINISH = 1000;
const HIDDEN_STATUS: number[] = [Status.NotClassified, Status.OnCourse, Status.NotStarted];
const num = (v: unknown) => (typeof v == 'number' ? v : Number(v) || 0);

/**
 * The latest split and finish times, newest first. Time4o has no endpoint for this, so it
 * follows what the legacy `getLastPassings` query selected from the LiveRes database:
 * finish times and the class's split controls, without exchange and lap-time columns.
 */
export function lastPassings(rows: ResultRow[], classes: ClassInfo[], limit = 3): Passing[] {
  const passings: Passing[] = [];
  const splitControls = new Map(classes.map((c) => [c.className, c.splitcontrols]));
  for (const row of rows) {
    const base = { dbid: row.dbid, name: row.name, className: row.class };
    for (const split of splitControls.get(row.class) ?? []) {
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
        changed,
      });
    }
    const finished = row.status != Status.OK || row.result > 0;
    if (!HIDDEN_STATUS.includes(row.status) && finished && row.changed > 0)
      passings.push({
        ...base,
        control: FINISH,
        controlName: '',
        time: row.result,
        status: row.status,
        place: num(row.place),
        changed: row.changed,
      });
  }
  return passings
    .sort((a, b) => b.changed - a.changed || a.dbid - b.dbid || a.control - b.control)
    .slice(0, limit);
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
