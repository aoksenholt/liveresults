import type { Entry, Race, RaceClass } from '../api/types';
import chase from '../api/__fixtures__/chase.json';
import interval from '../api/__fixtures__/interval.json';
import lapTimes from '../api/__fixtures__/lap-times.json';
import massStart from '../api/__fixtures__/mass-start.json';
import relay from '../api/__fixtures__/relay.json';
import unorderedNoTimes from '../api/__fixtures__/unordered-no-times.json';
import unordered from '../api/__fixtures__/unordered.json';
import { createLegacyViewer } from '../test/legacy';
import {
  classResults,
  clubResults,
  groupedResults,
  mapStatus,
  normalizeClasses,
  normalizeEntry,
  normalizeIntermediateControls,
  relayResults,
  toHundredthsSinceMidnight,
} from './time4o';

interface Fixture {
  race: Race;
  raceClass: RaceClass;
  entries: Entry[];
}

const FIXTURES = {
  interval,
  'mass-start': massStart,
  chase,
  unordered,
  'unordered-no-times': unorderedNoTimes,
  'lap-times': lapTimes,
  relay,
} as unknown as Record<string, Fixture>;

const legacy = createLegacyViewer();

describe.each(Object.entries(FIXTURES))('legacy parity: %s', (_name, fixture) => {
  const classes = normalizeClasses([fixture.raceClass]);

  it('normalizes classes like the legacy viewer', () => {
    expect(classes).toEqual(legacy.normalizeClasses(fixture.raceClass));
  });

  it('normalizes every entry like the legacy viewer', () => {
    for (const entry of fixture.entries) {
      const cls = classes.find((c) => c.id === entry.raceClassId) ?? classes[0];
      expect(normalizeEntry(entry, cls)).toEqual(legacy.normalizeEntry(entry, cls));
    }
  });

  it.each(['startlist', 'plainresults'] as const)(
    'groups the %s like the legacy viewer',
    (type) => {
      const rows = fixture.entries.map((e) =>
        legacy.normalizeEntry(
          e,
          classes.find((c) => c.id === e.raceClassId),
        ),
      );
      const expected = legacy.groupEntriesByClass(rows, type, classes);
      for (const group of expected) delete group.distance;
      expect(groupedResults(fixture.entries, type, classes)).toEqual(expected);
    },
  );
});

describe('normalizeClasses', () => {
  it('splits a relay into one class per leg with exchange and leg controls from leg 2', () => {
    const [leg1, leg2] = normalizeClasses([relay.raceClass as RaceClass]);
    expect(leg1!.className).toBe('H17-20-1');
    expect(leg1!.id).toBe(`${relay.raceClass.id}.1`);
    expect(leg1!.splitcontrols.some((c) => c.code === 0)).toBe(false);
    expect(leg2!.splitcontrols[0]).toEqual({ code: 0, order: 0, name: 'Exchange', updated: true });
    expect(leg2!.splitcontrols.at(-1)).toEqual({
      code: 999,
      order: 999,
      name: 'Leg',
      updated: false,
    });
  });

  it('interleaves pass-time controls for lap times', () => {
    const [cls] = normalizeClasses([lapTimes.raceClass as RaceClass]);
    const codes = cls!.splitcontrols.map((c) => c.code);
    expect(codes[0]! - codes[1]!).toBe(100000);
    expect(codes.at(-1)).toBe(999);
    expect(cls!.updatedSplits.at(-1)).toBe(true);
  });

  it('adds a time column for unordered classes that show times', () => {
    const [shown] = normalizeClasses([unordered.raceClass as RaceClass]);
    const [hidden] = normalizeClasses([unorderedNoTimes.raceClass as RaceClass]);
    expect(shown!.splitcontrols.at(-1)!.code).toBe(-999);
    expect(hidden!.splitcontrols.some((c) => c.code === -999)).toBe(false);
  });
});

describe('normalizeIntermediateControls', () => {
  it('codes controls as id + counter * 1000, negative when unordered', () => {
    const controls = { a: { id: '31', counter: 2, order: 1, name: 'R1' } };
    expect(normalizeIntermediateControls(controls, 'Default')[0]!.code).toBe(2031);
    expect(normalizeIntermediateControls(controls, 'Unordered')[0]!.code).toBe(-2031);
    expect(normalizeIntermediateControls(null, 'Default')).toEqual([]);
  });
});

describe('mapStatus', () => {
  it('maps Time4o statuses to LiveRes codes', () => {
    expect(mapStatus('OK', false)).toBe(0);
    expect(mapStatus('OK', true)).toBe(13);
    expect(mapStatus('Active', false)).toBe(9);
    expect(mapStatus('MissingPunch', false)).toBe(3);
    expect(mapStatus('Something new', false)).toBe(10);
  });
});

describe('toHundredthsSinceMidnight', () => {
  it('converts to local clock time in the event time zone', () => {
    expect(toHundredthsSinceMidnight('2025-06-01T08:30:15.250Z')).toBe(
      (10 * 3600 + 30 * 60 + 15) * 100,
    );
    expect(toHundredthsSinceMidnight('2025-01-01T08:30:15Z')).toBe((9 * 3600 + 30 * 60 + 15) * 100);
    expect(toHundredthsSinceMidnight('2025-06-01T08:30:15Z', 'UTC')).toBe(
      (8 * 3600 + 30 * 60 + 15) * 100,
    );
  });

  it('returns free start for missing or invalid values', () => {
    expect(toHundredthsSinceMidnight(null)).toBe(-999);
    expect(toHundredthsSinceMidnight('2025-06-01')).toBe(-999);
    expect(toHundredthsSinceMidnight('xxTyy')).toBe(-999);
  });
});

describe('normalizeEntry', () => {
  const [cls] = normalizeClasses([interval.raceClass as RaceClass]);
  const base = (interval.entries as Entry[]).find((e) => e.status?.status === 'OK')!;

  it('has no result until time, behind and place are all known', () => {
    const entry = { ...base, time: { ...base.time, behind: null } } as Entry;
    expect(normalizeEntry(entry, cls)!.result).toBe(-3);
  });

  it('marks non-rankable statuses with place "-"', () => {
    const entry = (interval.entries as Entry[]).find((e) => e.status?.status === 'MissingPunch')!;
    expect(normalizeEntry(entry, cls)).toMatchObject({ status: 3, place: '-', progress: 100 });
  });

  it('adds the restart offset to relay times after a restart', () => {
    const [, leg2] = normalizeClasses([relay.raceClass as RaceClass]);
    const entry = (relay.entries as Entry[]).find(
      (e) => e.leg?.number === 2 && e.overallResult?.time != null,
    )!;
    const restarted = { ...entry, time: { ...entry.time, restart: true } } as Entry;
    const normal = normalizeEntry(entry, leg2)!;
    const row = normalizeEntry(restarted, leg2)!;
    expect(row.result - normal.result).toBe(100 * 3600 * 100);
    expect(row.splits['0']).toBe((normal.splits['0'] as number) + 100 * 3600 * 100);
  });

  it('uses the time zone option', () => {
    const utc = normalizeEntry(base, cls, { timeZone: 'UTC' })!;
    const oslo = normalizeEntry(base, cls)!;
    expect(oslo.start - utc.start).toBeGreaterThanOrEqual(3600 * 100);
  });

  it('returns null without entry or class', () => {
    expect(normalizeEntry(null, cls)).toBeNull();
    expect(normalizeEntry(base, null)).toBeNull();
  });
});

describe('converters', () => {
  it('builds class results', () => {
    const [cls] = normalizeClasses([interval.raceClass as RaceClass]);
    const res = classResults(interval.entries as Entry[], cls!);
    expect(res.className).toBe('H 16');
    expect(res.results).toHaveLength(interval.entries.length);
    expect(res.splitcontrols).toBe(cls!.splitcontrols);
  });

  it('splits relay results per leg like the legacy viewer', () => {
    const classes = normalizeClasses([relay.raceClass as RaceClass]);
    const expected = legacy.Time4oRelayResultsToLiveres(
      { data: relay.entries },
      'H17-20-2',
      classes,
    );
    const res = relayResults(relay.entries as Entry[], 'H17-20-2', classes);
    expect(res.className).toBe('H17-20');
    expect(res.legs).toBe(3);
    expect(res.relayresults).toEqual(expected.relayresults);
  });

  it('uses the first entry organisation as club name', () => {
    const classes = normalizeClasses([interval.raceClass as RaceClass]);
    const res = clubResults(interval.entries as Entry[], classes);
    expect(res.clubName).toBe(interval.entries[0]!.organisation!.name);
  });
});
