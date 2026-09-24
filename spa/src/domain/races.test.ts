import type { Race } from '../api/types';
import { FIXTURES } from '../test/fixtures';
import { createLegacyViewer } from '../test/legacy';
import {
  addDays,
  byStartTime,
  findRaces,
  formatRaceDate,
  isRaceToday,
  localDate,
  localTime,
  raceList,
  raceYears,
  recentRaces,
  summarize,
  upcomingRaces,
} from './races';

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
      startTime: null,
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
    expect(list.today.map((t) => t.race.id)).toEqual(['today']);
    expect(
      list.all.map((i) =>
        i.kind == 'year' ? i.year : i.race.id + (i.firstBeforeToday ? '|' : ''),
      ),
    ).toEqual(['2027', 'future', '2026', 'today', 'yesterday|', 'earlier', '2025', 'old']);
  });
  it("shows today's races as live from the start time of the event", () => {
    const event = (startDate: string, startTime?: string) => ({ event: { startDate, startTime } });
    const races = [
      race('evening', '2026-09-23', event('2026-09-23', '18:30:00')),
      race('morning', '2026-09-23', event('2026-09-23', '10:00:00')),
      race('second-day', '2026-09-23', event('2026-09-22', '19:00:00')),
      race('no-time', '2026-09-23'),
    ];
    const live = (now: string) =>
      raceList(races, '2026-09-23', now)
        .today.filter((t) => t.live)
        .map((t) => t.race.id)
        .sort();
    expect(live('12:00')).toEqual(['morning', 'no-time', 'second-day']);
    expect(live('18:30')).toEqual(['evening', 'morning', 'no-time', 'second-day']);
    expect(
      raceList(races, '2026-09-23').today.find((t) => t.race.id == 'evening')?.race,
    ).toMatchObject({ startTime: '18:30' });
  });

  it('orders today by start time for the new look', () => {
    const at = (id: string, startTime?: string) =>
      race(id, '2026-09-23', { event: { startDate: '2026-09-23', startTime } });
    const today = raceList(
      [at('evening', '19:30:00'), at('none'), at('afternoon', '17:00:00')],
      '2026-09-23',
    ).today;
    expect(byStartTime(today).map((t) => t.race.id)).toEqual(['none', 'afternoon', 'evening']);
  });
});

describe('the race list of the new look', () => {
  const races = raceList(
    [
      race('last-year', '2025-12-30', { event: { organisers: [{ name: 'Nydalens SK' }] } }),
      race('eight-days-ago', '2026-09-15'),
      race('week-ago', '2026-09-16', { title: 'Nattcup Nydalen' }),
      race('yesterday', '2026-09-22'),
      race('today', '2026-09-23'),
      race('tomorrow', '2026-09-24'),
      race('in-a-week', '2026-09-30'),
      race('later', '2026-10-01'),
    ],
    '2026-09-23',
  ).races;
  const ids = (list: { id: string }[]) => list.map((r) => r.id);

  it('has the races of the last seven days, newest first', () => {
    expect(ids(recentRaces(races, '2026-09-23'))).toEqual(['yesterday', 'week-ago']);
  });

  it('has the races of the next seven days, soonest first', () => {
    expect(ids(upcomingRaces(races, '2026-09-23'))).toEqual(['tomorrow', 'in-a-week']);
  });

  it('lists the years with races', () => {
    expect(raceYears(races)).toEqual(['2026', '2025']);
  });

  it('finds races by name or organiser in every year', () => {
    expect(ids(findRaces(races, 'nydal'))).toEqual(['week-ago', 'last-year']);
    expect(ids(findRaces(races, 'NATTCUP  nydalen'))).toEqual(['week-ago']);
    expect(findRaces(races, '')).toHaveLength(races.length);
  });

  it('counts days across months and years', () => {
    expect(addDays('2026-09-23', -30)).toBe('2026-08-24');
    expect(addDays('2026-12-30', 3)).toBe('2027-01-02');
  });

  it('writes the date with the weekday in the language of the page', () => {
    expect(formatRaceDate('2026-09-24', 'en')).toBe('Thu, Sep 24');
    expect(formatRaceDate('2026-09-24', 'no')).toBe('tor. 24. sep.');
    expect(formatRaceDate('2026-09-24', 'cz')).toMatch(/24/);
  });
});

describe('dates', () => {
  it('gives the calendar date in the event time zone', () => {
    expect(localDate(Date.parse('2026-09-22T22:30:00Z'), 'Europe/Oslo')).toBe('2026-09-23');
  });

  it('gives the clock time in the event time zone', () => {
    expect(localTime(Date.parse('2026-09-22T22:30:00Z'), 'Europe/Oslo')).toBe('00:30');
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
