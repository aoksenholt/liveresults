// Wire types for the public Time4o API (https://center.time4o.com/api/v1/).
// Only the fields the viewer uses are typed; everything is optional because
// Time4o omits fields while results are being processed.

export interface Envelope<T> {
  data: T;
}

export interface Race {
  id: string;
  public?: boolean;
  date: string;
  title?: string;
  name?: string;
  raceNumber?: number | null;
  eventForm?: 'Individual' | 'Relay' | string;
  event?: {
    id?: string;
    name?: string;
    organisers?: { id?: string; name?: string }[];
    startDate?: string;
    startTime?: string;
    locale?: string;
    timezone?: string;
    test?: boolean;
  };
  identifierType?: string | null;
  identifier?: string | null;
}

export interface IntermediateControl {
  id?: string;
  counter?: number;
  order?: number;
  name?: string;
}

export interface RaceClassLeg {
  id?: number;
  number?: number;
  order?: number;
  optional?: boolean;
  intermediateControls?: Record<string, IntermediateControl> | null;
}

export type ResultListMode = 'Default' | 'Unordered' | 'UnorderedNoTimes' | string;
export type StartType = 'Free' | 'Interval' | 'Common' | 'Chasing' | string;

export interface CardType {
  id: number;
  name?: string;
  punchingSystem?: string;
}

export interface RaceClass {
  id: string;
  raceId?: string;
  name?: string;
  order?: number | null;
  eventForm?: 'Individual' | 'Relay' | string;
  resultListMode?: ResultListMode | null;
  startType?: StartType | null;
  showLapTimes?: boolean;
  timingResolution?: string | null;
  timingStartTimeSource?: string | null;
  qualificationLimit?: number | null;
  firstStart?: string | null;
  cardTypes?: CardType[];
  intermediateControls?: Record<string, IntermediateControl> | null;
  legs?: Record<string, RaceClassLeg> | null;
}

export interface TimedStatus {
  status?: string;
  updated?: string | null;
}

export interface IntermediateTime {
  time?: number | null;
  behind?: number | null;
  position?: number | null;
  counter?: number;
  intermediateControl?: string;
  updated?: string | null;
}

export interface OverallResult {
  position?: number | null;
  time?: number | null;
  behind?: number | null;
}

/** Times are milliseconds; clock times are ISO 8601 with offset. */
export interface Entry {
  id?: string;
  raceId?: string;
  raceClassId?: string;
  entryStatus?: string;
  person?: { id?: number; name?: string };
  organisation?: { id?: number; name?: string };
  team?: { id?: number; name?: string };
  leg?: { number?: number } | null;
  cards?: Record<string, { cardNo?: string; cardTypeId?: number; rental?: boolean } | undefined>;
  start?: { startTime?: string | null; bibNo?: number | null; updated?: string | null };
  time?: {
    time?: number | null;
    behind?: number | null;
    startTime?: string | null;
    finishTime?: string | null;
    restart?: boolean;
    updated?: string | null;
  };
  status?: TimedStatus;
  position?: number | null;
  overallStatus?: TimedStatus;
  overallResult?: OverallResult;
  startOverallResult?: OverallResult;
  intermediateTimes?: Record<string, IntermediateTime> | unknown[];
  timingStartTimeSource?: string | null;
  updated_at?: string | null;
}
