// The LiveRes result model the legacy viewer renders from. Time4o data is
// normalized into this shape so the ported ranking/rendering logic can be
// reused unchanged. Times are hundredths of a second.

export const Status = {
  OK: 0,
  DNS: 1,
  DNF: 2,
  MP: 3,
  DSQ: 4,
  OT: 5,
  NotClassified: 6,
  OnCourse: 9,
  NotStarted: 10,
  Overtime: 11,
  Walkover: 12,
  FinishedUnordered: 13,
} as const;

/** Added to times of runners that restarted (relay/chase), shown with a small `*`. */
export const RESTART_TIME_OFFSET = 100 * 3600 * 100;

export const FREE_START = -999;

export const NO_RESULT = -3;

export const SplitCode = {
  Exchange: 0,
  Leg: 999,
  UnorderedTime: -999,
  PassTimeOffset: 100000,
} as const;

export type SplitValue = number | string;

/**
 * Split times keyed by control code, with companion keys
 * `<code>_status`, `<code>_place`, `<code>_timeplus`, `<code>_changed` and `<code>_estimate`.
 */
export type SplitEntry = SplitValue | boolean | undefined;

export type Splits = Record<string, SplitEntry>;

export interface SplitControl {
  code: number;
  order: number;
  name: string;
  /** True when split places/time-behind must be computed client side. */
  updated: boolean;
}

export interface ClassInfo {
  /** Time4o raceClassId; relay legs are `<id>.<leg>`. */
  id: string;
  className: string;
  order: number | null;
  showLapTimes: boolean;
  startType: string | null;
  timingResolution: string | null;
  timingStartTimeSource: string | null;
  qualificationLimit: number | null;
  firstStart: string | number;
  cards: { id: number }[];
  resultListMode: string | null;
  isRelay: boolean;
  legs: number;
  splitcontrols: SplitControl[];
  updatedSplits: boolean[];
}

export interface ResultRow {
  /** "1", "2", … for ranked; "" not finished; "-" not ranked; "F" finished in unordered class; "=" tie. */
  place: string;
  dbid: number;
  bib: number;
  ecard1: string;
  ecard2: string;
  name: string;
  club: string;
  organisation: string;
  clubId: number;
  class: string;
  leg: number;
  pace: number;
  status: number;
  splits: Splits;
  /** Hundredths since midnight in the event time zone, FREE_START when unknown. */
  start: number;
  result: number;
  timeplus: SplitValue;
  /** Unix seconds of the last change. */
  changed: number;
  progress: number;
  virtual_position?: number;
  idx?: number;
}

export interface ClassResults {
  className: string;
  splitcontrols: SplitControl[];
  results: ResultRow[];
  updatedSplits: boolean[];
}

export interface GroupedClassResults {
  className: string;
  results: ResultRow[];
  order: number | null;
  qualificationLimit: number | null;
}

export interface RelayResults {
  className: string;
  legs: number;
  relayresults: { leg: number; results: ResultRow[] }[];
}

export interface ClubResults {
  clubName: string;
  results: ResultRow[];
}
