import type { Race } from '../api/types';
import { DEFAULT_TIME_ZONE } from './time4o';

export interface RaceSummary {
  id: string;
  date: string;
  name: string;
  organiser: string;
  eventorUrl: string | null;
  /** Local start time (HH:MM) when the event starts on the day of this race. */
  startTime: string | null;
}

export type RaceListItem =
  { kind: 'year'; year: string } | { kind: 'race'; race: RaceSummary; firstBeforeToday: boolean };

export interface TodayRace {
  race: RaceSummary;
  /** Time4o does not tell whether a race is running, so it is live from its start time. */
  live: boolean;
}

export interface RaceList {
  today: TodayRace[];
  all: RaceListItem[];
  /** Public races, newest first. */
  races: RaceSummary[];
  /** The local date the list was made for. */
  date: string;
}

/** Calendar date (YYYY-MM-DD) of `nowMs` in the given time zone. */
export function localDate(nowMs: number, timeZone = DEFAULT_TIME_ZONE): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone }).format(nowMs);
}

/** Local clock time (HH:MM) of `nowMs` in the given time zone. */
export function localTime(nowMs: number, timeZone = DEFAULT_TIME_ZONE): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(nowMs);
}

/** Legacy `isCompToday`: from the race date's midnight UTC and 30 hours on, so polling lasts into the night. */
export function isRaceToday(date: string, nowMs: number): boolean {
  const days = (nowMs - new Date(date).getTime()) / 86400000;
  return days > 0 && days < 1.25;
}

export function summarize(race: Race): RaceSummary {
  return {
    id: race.id,
    date: race.date.slice(0, 10),
    name: race.title ?? race.name ?? '',
    organiser: race.event?.organisers?.[0]?.name ?? '',
    eventorUrl:
      race.identifierType == 'Norway' && race.identifier
        ? `https://eventor.orientering.no/Events/Show/${race.identifier}`
        : null,
    startTime:
      race.event?.startTime && race.event.startDate == race.date.slice(0, 10)
        ? race.event.startTime.slice(0, 5)
        : null,
  };
}

/**
 * The race list of the legacy index.php: today's races, then all races newest first by year.
 * `now` is the local clock time (HH:MM) that tells which of today's races have started.
 */
export function raceList(races: Race[], today: string, now = '23:59'): RaceList {
  const list = races
    .filter((r) => r.public !== false)
    .map(summarize)
    .sort((a, b) => b.date.localeCompare(a.date));

  const all: RaceListItem[] = [];
  let year = today.slice(0, 4);
  let passedToday = false;
  for (const race of list) {
    const raceYear = race.date.slice(0, 4);
    if (raceYear != year) {
      year = raceYear;
      all.push({ kind: 'year', year });
    }
    const firstBeforeToday = race.date < today && !passedToday;
    if (firstBeforeToday) passedToday = true;
    all.push({ kind: 'race', race, firstBeforeToday });
  }
  const todays = list.filter((r) => r.date == today);
  return {
    today: todays.map((race) => ({ race, live: race.startTime == null || race.startTime <= now })),
    all,
    races: list,
    date: today,
  };
}

/** Today's races in the order they start; races without a start time come first. */
export function byStartTime(today: TodayRace[]): TodayRace[] {
  return [...today].sort((a, b) => (a.race.startTime ?? '').localeCompare(b.race.startTime ?? ''));
}

/** The date `days` days after (or before) a YYYY-MM-DD date. */
export function addDays(date: string, days: number): string {
  return new Date(Date.parse(date) + days * 86400000).toISOString().slice(0, 10);
}

/** Races of the last `days` days before today, newest first. */
export function recentRaces(races: RaceSummary[], today: string, days = 7): RaceSummary[] {
  const from = addDays(today, -days);
  return races.filter((r) => r.date >= from && r.date < today);
}

/** Races of the next `days` days after today, soonest first. */
export function upcomingRaces(races: RaceSummary[], today: string, days = 7): RaceSummary[] {
  const to = addDays(today, days);
  return races.filter((r) => r.date > today && r.date <= to).reverse();
}

/** The years that have races, newest first. */
export function raceYears(races: RaceSummary[]): string[] {
  return [...new Set(races.map((r) => r.date.slice(0, 4)))].sort().reverse();
}

/** Races whose name or organiser contains every word of the query, in any year. */
export function findRaces(races: RaceSummary[], query: string): RaceSummary[] {
  const words = query.toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return races.filter((r) => {
    const text = `${r.name} ${r.organiser}`.toLocaleLowerCase();
    return words.every((w) => text.includes(w));
  });
}

/** Short date with the weekday, like "tor. 24. sep.", in the language of the page. */
export function formatRaceDate(date: string, lang: string): string {
  const locale = lang == 'cz' ? 'cs' : lang == 'no' ? 'nb' : lang;
  return new Intl.DateTimeFormat(locale, {
    timeZone: 'UTC',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(Date.parse(date));
}
