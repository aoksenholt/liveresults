import type { Race } from '../api/types';
import { FIXTURES } from '../test/fixtures';
import { createLegacyViewer } from '../test/legacy';
import { isRaceToday, localDate, raceList, summarize } from './races';

const race = (id: string, date: string, extra: Partial<Race> = {}): Race => ({
  id,
  date,
  title: `Race ${id}`,
  ...extra,
});

describe('summarize', () => {
  it('takes the organiser and Eventor link from a recorded race', () => {
    const recorded = (FIXTURES.interval as unknown as { race: Race }).race;
    expect(summarize(recorded)).toEqual({
      id: recorded.id,
      date: '2026-09-19',
      name: 'NC/O-Idol',
      organiser: 'Frol il',
      eventorUrl: 'https://eventor.orientering.no/Events/Show/22775',
    });
  });

  it('has no Eventor link outside Norway', () => {
    expect(
      summarize(race('a', '2026-01-01', { identifierType: 'Sweden', identifier: '1' })),
    ).toMatchObject({ eventorUrl: null });
  });
});

describe('raceList', () => {
  it('lists today, then all public races newest first with year headers', () => {
    const races = [
      race('old', '2025-06-01'),
      race('today', '2026-09-23'),
      race('hidden', '2026-09-23', { public: false }),
      race('future', '2027-01-02'),
      race('yesterday', '2026-09-22'),
      race('earlier', '2026-05-01'),
    ];
    const list = raceList(races, '2026-09-23');
    expect(list.today.map((r) => r.id)).toEqual(['today']);
    expect(
      list.all.map((i) =>
        i.kind == 'year' ? i.year : i.race.id + (i.firstBeforeToday ? '|' : ''),
      ),
    ).toEqual(['2027', 'future', '2026', 'today', 'yesterday|', 'earlier', '2025', 'old']);
  });
});

describe('dates', () => {
  it('gives the calendar date in the event time zone', () => {
    expect(localDate(Date.parse('2026-09-22T22:30:00Z'), 'Europe/Oslo')).toBe('2026-09-23');
  });

  it.each([
    '2026-09-23T10:00:00Z',
    '2026-09-23T00:00:00Z',
    '2026-09-24T05:00:00Z',
    '2026-09-24T07:00:00Z',
    '2026-09-22T23:00:00Z',
  ])('matches legacy isCompToday at %s', (now) => {
    const nowMs = Date.parse(now);
    vi.useFakeTimers({ now: nowMs, toFake: ['Date'] });
    const expected = Boolean(createLegacyViewer({ compDate: '2026-09-23' }).isCompToday());
    vi.useRealTimers();
    expect(isRaceToday('2026-09-23', nowMs)).toBe(expected);
  });
});
