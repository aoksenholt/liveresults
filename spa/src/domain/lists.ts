import { sprintStage } from './classList';
import { clubShort, formatTime, nameShort, type DisplayFormat } from './format';
import type { GroupedClassResults, ResultRow } from './model';

export interface ResultListRow {
  place: string;
  qualified: boolean;
  name: string;
  /** Null in sprint heats, where the legacy list leaves out the club. */
  club: string | null;
  clubId: number;
  /** HTML built from numbers only. */
  time: string;
  /** Null in sprint lists, which show the time behind in the time column. */
  diff: string | null;
}

export interface ResultListSection {
  className: string;
  title: string;
  rows: ResultListRow[];
}

export interface StartListRow {
  bib: string;
  name: string;
  club: string;
  clubId: number;
  start: string;
  ecards: string;
  /** Did not start, struck through. */
  dns: boolean;
}

export interface StartListSection {
  className: string;
  rows: StartListRow[];
}

const num = (v: unknown) => Number(v);
const sprintClean = (s: string) => s.replace(/[\s-]+/g, '');

function timeFormatter(f: DisplayFormat) {
  return {
    time: (t: number, status = 0) =>
      formatTime(t, status, f.labels, f.language, { showTenths: !!f.showTenths }),
    clock: (t: number, padZeros: boolean) =>
      formatTime(t, 0, f.labels, f.language, { showHours: true, padZeros, clockTime: true }),
  };
}

const qualified = (group: GroupedClassResults, row: ResultRow) =>
  group.qualificationLimit != null &&
  num(row.place) > 0 &&
  num(row.place) <= group.qualificationLimit;

/** The legacy "all classes" list: finished runners per class with time and time behind. */
export function resultList(groups: GroupedClassResults[], f: DisplayFormat): ResultListSection[] {
  const { time } = timeFormatter(f);
  return groups.map((g) => ({
    className: g.className,
    title: g.className,
    rows: g.results.map((r) => ({
      place: r.place,
      qualified: qualified(g, r),
      name: nameShort(r.name, f.maxNameLength),
      club: clubShort(r.club, f.maxClubLength),
      clubId: r.clubId,
      time: time(r.result, r.status),
      diff: `<span class="plustime">${r.status == 0 ? '+' + time(num(r.timeplus), r.status) : ''}</span>`,
    })),
  }));
}

/**
 * The legacy `plainresultsclass_<key>` list: every heat of one sprint class,
 * one column per sprint stage. Heats hide clubs and, unless `showTimesInSprint`, times.
 */
export function sprintList(
  groups: GroupedClassResults[],
  key: string,
  f: DisplayFormat & { showTimesInSprint?: boolean },
): ResultListSection[][] {
  const { time, clock } = timeFormatter(f);
  const plainKey = sprintClean(key);
  const prefix = key + ' | ';
  const columns: ResultListSection[][] = [];
  let lastStage: number | null = null;
  for (const g of groups) {
    if (!sprintClean(g.className).includes(plainKey) || /NM KO Tot(al|alt)$/.test(g.className))
      continue;
    const stage = sprintStage(g.className);
    const heat = stage > 0;
    if (stage !== lastStage) columns.push([]);
    lastStage = stage;
    const showTime = !!f.showTimesInSprint || !heat;
    columns.at(-1)!.push({
      className: g.className,
      title: g.className.replace(prefix, ''),
      rows: g.results.map((r) => ({
        place: r.place,
        qualified: qualified(g, r),
        name: nameShort(r.name, f.maxNameLength),
        club: heat ? null : clubShort(r.club, f.maxClubLength),
        clubId: r.clubId,
        time: !showTime
          ? ''
          : r.status == 9 || r.status == 10
            ? `<span class="small plustime">${clock(r.start, false)}</span>`
            : r.place == '1' || r.status != 0
              ? time(r.result, r.status)
              : '+' + time(num(r.timeplus)),
        diff: null,
      })),
    });
  }
  return columns;
}

export function startBib(bib: number): string {
  if (bib < 0) return `${(-bib / 100) | 0}-${-bib % 100}`;
  return bib > 0 ? String(bib) : '';
}

export function ecards(row: ResultRow): string {
  const [e1, e2] = [num(row.ecard1), num(row.ecard2)];
  if (e1 > 0) return e2 > 0 ? `${row.ecard1} / ${row.ecard2}` : row.ecard1;
  return e2 > 0 ? row.ecard2 : '';
}

export function startList(groups: GroupedClassResults[], f: DisplayFormat): StartListSection[] {
  const { clock } = timeFormatter(f);
  return groups.map((g) => ({
    className: g.className,
    rows: g.results.map((r) => ({
      bib: startBib(r.bib),
      name: r.name.length > f.maxNameLength ? nameShort(r.name, f.maxNameLength) : r.name,
      club: r.club.length > f.maxClubLength ? clubShort(r.club, f.maxClubLength) : r.club,
      clubId: r.clubId,
      start: r.start == 0 ? '' : clock(r.start, true),
      ecards: ecards(r),
      dns: r.status == 1,
    })),
  }));
}

export interface ClubRow {
  row: ResultRow;
  name: string;
  bib: string;
  start: string;
  finish: string;
  diff: string;
  pace: string;
}

export interface ClubList {
  hasPace: boolean;
  rows: ClubRow[];
}

const placeSortable = (place: string) =>
  place == '-' ? 999999 : place == '' ? 9999 : place == 'F' ? 0 : num(place) || 9999;
const startSortable = (start: number) => (start < 0 ? 99999999 : start);

/** The legacy club table: ordered by place, start time and bib, with the columns rendered as HTML. */
export function clubList(results: ResultRow[], f: DisplayFormat): ClubList {
  const { time, clock } = timeFormatter(f);
  const plain = (t: number, status: number) => formatTime(t, status, f.labels, f.language);
  const placeTag = (place: string) =>
    `<span class="place"> ${num(place) < 10 ? '&numsp;' : ''}&#10072;${num(place) > 0 ? place : '-'}&#10072;</span>`;
  const isNum = (v: unknown) => !isNaN(parseInt(String(v)));
  const rows = results
    .map((r, i) => ({ r, i }))
    .sort(
      (a, b) =>
        placeSortable(a.r.place) - placeSortable(b.r.place) ||
        startSortable(a.r.start) - startSortable(b.r.start) ||
        Math.abs(a.r.bib) - Math.abs(b.r.bib) ||
        a.i - b.i,
    )
    .map(({ r }) => ({
      row: r,
      name: r.name.length > f.maxNameLength ? nameShort(r.name, f.maxNameLength) : r.name,
      bib:
        r.bib < 0
          ? `<span class="bib">${(-r.bib / 100) | 0}</span>`
          : r.bib > 0
            ? `<span class="bib">${r.bib}</span>`
            : '',
      start: r.start == 0 ? '' : clock(r.start, true),
      finish: !isNum(r.result)
        ? String(r.result)
        : r.place == '-' || r.place == '' || r.place == 'F'
          ? plain(r.result, r.status)
          : time(r.result, 0) + placeTag(r.place),
      diff: !isNum(r.timeplus)
        ? String(r.timeplus)
        : r.status == 0
          ? `<span class="plustime">+${plain(num(r.timeplus), r.status)}</span>`
          : '',
      pace: r.status == 0 && r.pace > 0 ? `<span class="plustime">${plain(r.pace, 0)}</span>` : '',
    }));
  return { hasPace: results.some((r) => r.pace > 0), rows };
}
