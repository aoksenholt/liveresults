// Port of web/js/liveresults.time4o.js; keep behaviour in sync with the legacy viewer.
import type { Entry, IntermediateControl, RaceClass } from '../api/types';
import {
  FREE_START,
  NO_RESULT,
  RESTART_TIME_OFFSET,
  type ClassInfo,
  type ClassResults,
  type ClubResults,
  type GroupedClassResults,
  type RelayResults,
  type ResultRow,
  type SplitControl,
  type Splits,
  type SplitValue,
} from './model';
import { resultListSorter, sortClasses, startListSorter } from './sorting';

export const DEFAULT_TIME_ZONE = 'Europe/Oslo';

const isUnordered = (mode: string | null | undefined) =>
  mode === 'Unordered' || mode === 'UnorderedNoTimes';

const msToHundredths = (ms: number) => Math.floor(ms / 10);

export function normalizeClasses(classes: RaceClass[]): ClassInfo[] {
  return classes.flatMap((c) => normalizeClass(c));
}

export function normalizeClass(classEntry: RaceClass): ClassInfo[] {
  const relay = classEntry.eventForm == 'Relay';
  const resultListMode = classEntry.resultListMode ?? null;
  const chaseStart = classEntry.startType == 'Chasing';
  const unordered = isUnordered(resultListMode);
  const noTimes = resultListMode === 'UnorderedNoTimes';
  const showLapTimes = (classEntry.showLapTimes && !unordered) ?? false;
  const legs = classEntry.legs ? Object.keys(classEntry.legs).length : 1;

  const classInfo: ClassInfo[] = [];
  for (let i = 1; i <= legs; i++) {
    let legNo = 0;
    let className = classEntry.name ?? 'NoName';
    let id = classEntry.id ?? 'NoId';
    let intermediateControls: Record<string, IntermediateControl> | null | undefined;

    if (relay) {
      const leg = classEntry.legs?.[i];
      legNo = leg?.number ?? 1;
      if (!className.endsWith('-')) className += '-';
      className += String(legNo);
      id = id + '.' + String(legNo);
      intermediateControls = leg?.intermediateControls;
    } else {
      intermediateControls = classEntry.intermediateControls;
    }

    const splitcontrols = normalizeIntermediateControls(intermediateControls, resultListMode);

    if (chaseStart || (relay && legNo >= 2)) {
      addPassTimeControls(splitcontrols);
      splitcontrols.push({ code: 0, order: 0, name: 'Exchange', updated: true });
      splitcontrols.push({ code: 999, order: 999, name: 'Leg', updated: false });
      splitcontrols.sort((a, b) => a.order - b.order);
    }

    if (unordered && !noTimes)
      splitcontrols.push({ code: -999, order: 999, name: 'Time', updated: false });

    if (showLapTimes && splitcontrols.length > 0) {
      addPassTimeControls(splitcontrols);
      splitcontrols.push({ code: 999, order: 999, name: 'Leg', updated: true });
      splitcontrols.sort((a, b) => a.order - b.order);
    }

    classInfo.push({
      id,
      className,
      order: classEntry.order ?? null,
      showLapTimes: classEntry.showLapTimes ?? false,
      startType: classEntry.startType ?? null,
      timingResolution: classEntry.timingResolution ?? null,
      timingStartTimeSource: classEntry.timingStartTimeSource ?? null,
      qualificationLimit: classEntry.qualificationLimit ?? null,
      firstStart: classEntry.firstStart ?? FREE_START,
      cards: classEntry.cardTypes ?? [],
      resultListMode,
      isRelay: relay,
      legs,
      splitcontrols,
      updatedSplits: splitcontrols.map((ctrl) => !!ctrl.updated),
    });
  }
  return classInfo;
}

function addPassTimeControls(splitcontrols: SplitControl[]) {
  for (const ctrl of [...splitcontrols]) {
    splitcontrols.push({
      code: ctrl.code + 100000,
      order: 2 * ctrl.order - 1,
      name: ctrl.name + 'PassTime',
      updated: true,
    });
    ctrl.order = 2 * ctrl.order;
  }
}

export function normalizeIntermediateControls(
  controls: Record<string, IntermediateControl> | null | undefined,
  resultListMode: string | null,
): SplitControl[] {
  if (!controls) return [];
  const sign = isUnordered(resultListMode) ? -1 : 1;
  return Object.values(controls)
    .map((ctrl, idx) => ({
      order: ctrl?.order ?? idx + 1,
      code: (Number(ctrl?.id) + (ctrl?.counter ?? 1) * 1000) * sign,
      name: ctrl?.name ?? `Split ${idx + 1}`,
      updated: false,
    }))
    .sort((a, b) => a.order - b.order);
}

const STATUS_MAP: Record<string, number> = {
  OK: 0,
  Finished: 0, // Finished but not yet validated
  DidNotStart: 1,
  DidNotFinish: 2,
  MissingPunch: 3,
  Disqualified: 4,
  OverTime: 5,
  NotClassified: 6,
  Checked: 9, // Ecard check done
  Active: 9, // Currently on course
  Inactive: 10, // Entered, but not yet started
  Empty: 10,
  Overtime: 11,
  Walkover: 12,
  FinishedUnordered: 13,
};

export function mapStatus(statusKey: string | undefined, unordered: boolean): number {
  let key = statusKey ?? '';
  if ((key == 'OK' || key == 'Finished') && unordered) key = 'FinishedUnordered';
  return STATUS_MAP[key] ?? 10;
}

export function toHundredthsSinceMidnight(
  isoString: string | null | undefined,
  timeZone: string = DEFAULT_TIME_ZONE,
): number {
  if (!isoString?.includes('T')) return FREE_START;
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return FREE_START;
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return (get('hour') * 3600 + get('minute') * 60 + get('second')) * 100;
}

const toUnixSeconds = (iso: string | null | undefined) =>
  iso ? Math.floor(Date.parse(iso) / 1000) : 0;

export interface NormalizeOptions {
  timeZone?: string;
}

export function normalizeEntry(
  entry: Entry | null | undefined,
  classInfo: ClassInfo | null | undefined,
  opts: NormalizeOptions = {},
): ResultRow | null {
  if (!entry || !classInfo) return null;
  const tz = opts.timeZone ?? DEFAULT_TIME_ZONE;

  const timingStartTimeSource =
    entry.timingStartTimeSource ?? classInfo.timingStartTimeSource ?? 'Timing';
  const startListStartTime = entry.start?.startTime ?? classInfo.firstStart ?? null;
  let rawStartIso: string | number | null;
  if (classInfo.startType === 'Free') {
    rawStartIso = entry.time?.startTime ?? null;
  } else if (timingStartTimeSource === 'Timing') {
    rawStartIso = entry.time?.startTime ?? (classInfo.isRelay ? null : startListStartTime);
  } else {
    rawStartIso = startListStartTime;
  }
  // Legacy throws when firstStart is the numeric -999 default; treat it as no start time instead.
  const startTime = rawStartIso
    ? toHundredthsSinceMidnight(typeof rawStartIso === 'string' ? rawStartIso : null, tz)
    : classInfo.isRelay
      ? 0
      : FREE_START;
  let timeFromClassStart = -1;
  if (startTime > 0 && classInfo.firstStart) {
    const first =
      typeof classInfo.firstStart === 'string'
        ? toHundredthsSinceMidnight(classInfo.firstStart, tz)
        : FREE_START;
    timeFromClassStart = startTime - first;
  }

  const unordered = isUnordered(classInfo.resultListMode);
  const noTimes = classInfo.resultListMode === 'UnorderedNoTimes';
  const chaseStart = classInfo.startType == 'Chasing';
  const legNumber = entry.leg?.number ?? 0;
  const splits: Splits = {};
  let rawResult: number | null;
  let rawBehind: number | null;
  let place: string;
  let statusValue: number;
  let startTotalTime = -1;
  let restart = false;

  if (chaseStart || (classInfo.isRelay && legNumber >= 2)) {
    restart = entry.time?.restart ?? false;
    statusValue = mapStatus(entry.overallStatus?.status ?? 'Unknown', unordered);
    place = entry.overallResult?.position != null ? String(entry.overallResult.position) : '';
    rawResult = entry.overallResult?.time ?? null;
    rawBehind = entry.overallResult?.behind ?? null;
    if (restart) {
      rawResult = (rawResult ?? 0) + RESTART_TIME_OFFSET * 10;
      rawBehind = (rawBehind ?? 0) + RESTART_TIME_OFFSET * 10;
    }

    if (entry.startOverallResult?.time) {
      startTotalTime = msToHundredths(entry.startOverallResult.time);
      if (classInfo.isRelay && startTotalTime < timeFromClassStart)
        startTotalTime = timeFromClassStart;
    } else if (timeFromClassStart >= 0) {
      startTotalTime = timeFromClassStart;
    }
    if (startTotalTime >= 0 && startTime > 0) {
      splits['0'] = startTotalTime + (restart ? RESTART_TIME_OFFSET : 0);
    }

    if (entry.time?.time != null && entry.time?.behind != null) {
      const legStatusValue = mapStatus(entry.status?.status ?? 'Unknown', unordered);
      const legResult = msToHundredths(entry.time.time);
      const legBehind = msToHundredths(entry.time.behind);
      splits['999'] = legResult > 0 ? legResult : '';
      splits['999_status'] = legStatusValue;
      splits['999_timeplus'] = legBehind >= 0 ? legBehind : '';
      splits['999_place'] = entry.position != null ? String(entry.position) : '-';
    }
  } else {
    statusValue = mapStatus(entry.status?.status ?? 'Unknown', unordered);
    rawResult = entry.time?.time ?? null;
    rawBehind = entry.time?.behind ?? null;
    place = entry.position != null ? String(entry.position) : '';
  }

  // Behind and place can be missing shortly after a result is updated.
  let result =
    rawResult != null && rawBehind != null && place != '' ? msToHundredths(rawResult) : NO_RESULT;
  if (statusValue != 0 && statusValue != 9 && statusValue != 10) place = '-';

  const intermediates =
    entry.intermediateTimes && !Array.isArray(entry.intermediateTimes)
      ? entry.intermediateTimes
      : {};
  let prevSplitTime = 0;
  for (const [key, val] of Object.entries(intermediates)) {
    if (val?.behind == null || val?.position == null) continue;
    const [controlId, counter] = key.split('-');
    const code = (Number(counter) * 1000 + Number(controlId)) * (unordered ? -1 : 1);
    let timeHundredths: SplitValue = noTimes
      ? -10
      : val.time != null
        ? msToHundredths(val.time)
        : '';
    let behindHundredths: SplitValue = noTimes ? '' : msToHundredths(val.behind);

    if (classInfo.isRelay && legNumber >= 2) {
      splits[code + 100000] =
        timeHundredths !== '' ? (timeHundredths as number) - timeFromClassStart : '';
    }
    if (chaseStart) {
      splits[code + 100000] =
        timeHundredths !== '' ? (timeHundredths as number) - startTotalTime : '';
    }

    if (restart && timeHundredths !== '') {
      timeHundredths = (timeHundredths as number) + RESTART_TIME_OFFSET;
      // Legacy adds to "" as a string when behind is missing; keep numbers numeric.
      if (typeof behindHundredths === 'number') behindHundredths += RESTART_TIME_OFFSET;
    }
    splits[code] = timeHundredths;
    splits[`${code}_status`] = statusValue == 9 || statusValue == 10 ? 0 : statusValue;
    splits[`${code}_changed`] = toUnixSeconds(val.updated);
    splits[`${code}_timeplus`] = behindHundredths;
    splits[`${code}_place`] = val.position ?? '-';

    if (classInfo.showLapTimes) {
      splits[code + 100000] =
        timeHundredths !== '' ? (timeHundredths as number) - prevSplitTime : '';
      prevSplitTime = val.time != null ? msToHundredths(val.time) : prevSplitTime;
    }
  }

  if (classInfo.showLapTimes && result > 0 && result > prevSplitTime) {
    splits['999'] = result - prevSplitTime;
  }

  const changed = toUnixSeconds(
    entry.time?.updated ?? entry.status?.updated ?? entry.updated_at ?? null,
  );

  if (statusValue == 13) {
    if (!noTimes) {
      splits['-999'] = result > 0 ? result : '';
      splits['-999_status'] = 13;
      splits['-999_changed'] = changed;
      splits['-999_timeplus'] = 0;
      splits['-999_place'] = 'F';
    }
    // Unordered classes are listed in a stable, non-ranking order.
    result = entry.person?.id != null ? entry.person.id : 100;
    place = 'F';
  }

  const clubName = classInfo.isRelay ? (entry.team?.name ?? '') : (entry.organisation?.name ?? '');
  const ecard1no = classInfo.cards[0]?.id ?? '';
  const ecard2no = classInfo.cards[1]?.id ?? '';

  let progress = 0;
  if (statusValue == 9 || statusValue == 10 || place == '') {
    if (Object.keys(splits).length > 0) {
      let passedSplits = 0;
      let splitCnt = 0;
      for (const split of classInfo.splitcontrols) {
        splitCnt++;
        if (splits[split.code] != undefined) passedSplits = splitCnt;
      }
      progress = (passedSplits * 100.0) / (splitCnt + 1);
    }
  } else {
    progress = 100;
  }

  return {
    place,
    dbid: entry.person?.id ?? 0,
    bib: entry.start?.bibNo ?? 0,
    ecard1: entry.cards?.['card' + ecard1no]?.cardNo ?? '',
    ecard2: entry.cards?.['card' + ecard2no]?.cardNo ?? '',
    name: entry.person?.name ?? '',
    club: clubName,
    organisation: entry.organisation?.name ?? '',
    clubId: entry.organisation?.id ?? 0,
    class: classInfo.className ?? '',
    leg: classInfo.isRelay ? (entry.leg?.number ?? 1) : 0,
    pace: -1,
    status: statusValue,
    splits,
    start: startTime,
    result,
    timeplus: rawBehind != null ? msToHundredths(rawBehind) : '',
    changed,
    progress,
  };
}

const findClass = (classes: ClassInfo[], entry: Entry) =>
  classes.find((c) => c.id === entry?.raceClassId);

const notNull = <T>(v: T | null): v is T => v != null;

export function classResults(
  entries: Entry[],
  classInfo: ClassInfo,
  opts?: NormalizeOptions,
): ClassResults {
  return {
    className: classInfo.className,
    splitcontrols: classInfo.splitcontrols,
    results: entries.map((e) => normalizeEntry(e, classInfo, opts)).filter(notNull),
    updatedSplits: classInfo.updatedSplits,
  };
}

export function relayResults(
  entries: Entry[],
  className: string,
  classes: ClassInfo[],
  opts?: NormalizeOptions,
): RelayResults {
  const rows = entries.map((e) => normalizeEntry(e, findClass(classes, e), opts)).filter(notNull);
  const currentClass = classes.find((c) => c.className === className);
  const legs = currentClass?.legs ?? 0;
  const relayresults = [];
  for (let leg = 1; leg <= legs; leg++) {
    relayresults.push({ leg, results: rows.filter((r) => r.leg == leg) });
  }
  return { className: className.replace(/-[0-9]{1,2}$/, ''), legs, relayresults };
}

export function clubResults(
  entries: Entry[],
  classes: ClassInfo[],
  opts?: NormalizeOptions,
): ClubResults {
  const rows = entries.map((e) => normalizeEntry(e, findClass(classes, e), opts)).filter(notNull);
  return { clubName: rows[0]?.organisation ?? '', results: rows };
}

export type ListType = 'startlist' | 'plainresults';

export function groupedResults(
  entries: Entry[],
  type: ListType,
  classes: ClassInfo[],
  opts?: NormalizeOptions,
): GroupedClassResults[] {
  const groups = new Map<string, ResultRow[]>();
  for (const e of entries) {
    const row = normalizeEntry(e, findClass(classes, e), opts);
    if (row?.status == null || row.class == null) continue;
    if (type === 'plainresults' && (row.status == 9 || row.status == 10)) continue;
    const name = row.class || 'Unknown';
    if (!groups.has(name)) groups.set(name, []);
    groups.get(name)!.push(row);
  }
  const sorter = type === 'startlist' ? startListSorter : resultListSorter;
  const grouped = Array.from(groups, ([className, results]) => {
    const info = classes.find((c) => c.className === className);
    return {
      className,
      results: results.slice().sort(sorter),
      order: info?.order ?? null,
      qualificationLimit: info?.qualificationLimit ?? null,
    };
  });
  return sortClasses(grouped);
}
