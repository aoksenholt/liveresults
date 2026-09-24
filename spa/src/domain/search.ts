import type { ResultRow } from './model';
import { matchesSearch } from './organizer';

export interface ClubMatch {
  id: number;
  name: string;
  runners: number;
}

export interface SearchResult {
  clubs: ClubMatch[];
  runners: ResultRow[];
}

const byName = (a: string, b: string) => a.localeCompare(b, 'no');

/** Runners whose name, club or bib match every word of the query, and clubs whose name does. */
export function searchRace(rows: ResultRow[], query: string): SearchResult {
  if (query.trim() == '') return { clubs: [], runners: [] };
  const clubs = new Map<number, ClubMatch>();
  for (const row of rows) {
    if (!row.clubId) continue;
    const club = clubs.get(row.clubId);
    if (club) club.runners++;
    else if (matchesSearch(`${row.club} ${row.organisation}`.toLowerCase(), query))
      clubs.set(row.clubId, { id: row.clubId, name: row.club || row.organisation, runners: 1 });
  }
  const runners = rows
    .filter((r) => matchesSearch(`${r.name} ${r.club} ${r.bib || ''}`.toLowerCase(), query))
    .sort((a, b) => byName(a.name, b.name) || byName(a.class, b.class));
  return { clubs: [...clubs.values()].sort((a, b) => byName(a.name, b.name)), runners };
}
