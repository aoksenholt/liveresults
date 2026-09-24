import { FIXTURES } from '../test/fixtures';
import type { ResultRow } from './model';
import { entryRows } from './organizer';
import { searchRace } from './search';
import { normalizeClasses } from './time4o';

const all = Object.values(FIXTURES);
const classes = normalizeClasses(all.map((f) => f.raceClass));
const rows = entryRows(
  all.flatMap((f) => f.entries),
  classes,
);

const row = (patch: Partial<ResultRow>) => ({ ...rows[0]!, ...patch });

describe('searchRace', () => {
  it('finds nothing for an empty query', () => {
    expect(searchRace(rows, '  ')).toEqual({ clubs: [], runners: [] });
  });

  it('finds runners by every word of the name and club, ignoring case', () => {
    const some = rows.find((r) => r.name.includes(' ') && r.club)!;
    const [first] = some.name.split(' ');
    const { runners } = searchRace(rows, `${first!.toUpperCase()} ${some.club.slice(0, 3)}`);
    expect(runners).toContain(some);
    expect(runners.every((r) => r.name.toLowerCase().includes(first!.toLowerCase()))).toBe(true);
  });

  it('finds runners by bib', () => {
    const some = rows.find((r) => r.bib > 0)!;
    expect(searchRace(rows, String(some.bib)).runners).toContain(some);
  });

  it('links runners to classes of the race', () => {
    const names = new Set(classes.map((c) => c.className));
    expect(searchRace(rows, 'a').runners.every((r) => names.has(r.class))).toBe(true);
  });

  it('counts every runner of a matching club, sorted by name', () => {
    const club = rows.find((r) => r.clubId)!;
    const { clubs } = searchRace(rows, club.club);
    expect(clubs).toContainEqual({
      id: club.clubId,
      name: club.club,
      runners: rows.filter((r) => r.clubId == club.clubId).length,
    });
    const found = searchRace(rows, 'o').clubs.map((c) => c.name);
    expect(found).toEqual([...found].sort((a, b) => a.localeCompare(b, 'no')));
  });

  it('matches the full organisation name and skips runners without club', () => {
    const rows = [
      row({ clubId: 7, club: 'Ås-NMBU O.', organisation: 'Ås-NMBU Orientering' }),
      row({ clubId: 0, club: 'Orientering', organisation: '' }),
    ];
    expect(searchRace(rows, 'orientering').clubs).toEqual([
      { id: 7, name: 'Ås-NMBU O.', runners: 1 },
    ]);
  });
});
