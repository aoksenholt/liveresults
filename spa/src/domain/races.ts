import type { Race } from '../api/types';
import { DEFAULT_TIME_ZONE } from './time4o';

export interface RaceSummary {
  id: string;
  date: string;
  name: string;
  organiser: string;
  eventorUrl: string | null;
}

export type RaceListItem =
  { kind: 'year'; year: string } | { kind: 'race'; race: RaceSummary; firstBeforeToday: boolean };

export interface RaceList {
  today: RaceSummary[];
  all: RaceListItem[];
}

/** Calendar date (YYYY-MM-DD) of `nowMs` in the given time zone. */
export function localDate(nowMs: number, timeZone = DEFAULT_TIME_ZONE): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone }).format(nowMs);
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
  };
}

/** The race list of the legacy index.php: today's races, then all races newest first by year. */
export function raceList(races: Race[], today: string): RaceList {
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
  return { today: list.filter((r) => r.date == today), all };
}
