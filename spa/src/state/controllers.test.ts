import { Time4oApi } from '../api/client';
import type { Entry } from '../api/types';
import { normalizeClasses } from '../domain/time4o';
import { FIXTURES, midRace } from '../test/fixtures';
import {
  lastPassingsController,
  leftInForestController,
  ORGANIZER_INTERVAL_MS,
  PASSINGS_INTERVAL_MS,
  SCROLL_INTERVAL_MS,
  scrollController,
  startRegistrationController,
} from './controllers';

const interval = FIXTURES.interval!;
const classes = normalizeClasses([interval.raceClass]);
const entries = midRace(interval.entries);

function fakeApi(data: Entry[]) {
  const fetch = vi.fn(() =>
    Promise.resolve(new Response(JSON.stringify({ data }), { status: 200 })),
  );
  return { api: new Time4oApi('https://t/', fetch), fetch };
}

const opts = { timeZone: 'Europe/Oslo' };
const window = { preTime: 1, callTime: 3, postTime: 5, openStart: false };

afterEach(() => vi.useRealTimers());

describe('leftInForestController', () => {
  it('keeps runners on course and polls only live races', async () => {
    vi.useFakeTimers();
    const { api, fetch } = fakeApi(entries);
    const controller = leftInForestController(api, 'r', classes, { ...opts, live: false });
    controller.start();
    await vi.advanceTimersByTimeAsync(ORGANIZER_INTERVAL_MS * 2);
    const rows = controller.store.get().data!;
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.status == 9 || r.status == 10)).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(1);
    controller.stop();
  });
});

describe('startRegistrationController', () => {
  const runner = entries.find((e) => e.status?.status == 'Active' && e.start?.startTime)!;
  const startMs = Date.parse(runner.start!.startTime!);

  it('refilters every second and beeps before and at the start', async () => {
    vi.useFakeTimers({ now: startMs - 5000 });
    const { api, fetch } = fakeApi(entries);
    const onBeep = vi.fn();
    const controller = startRegistrationController(api, 'r', classes, { ...opts, window, onBeep });
    controller.start();
    await vi.advanceTimersByTimeAsync(0);
    const shown = () => controller.store.get().marks.filter((m) => m.show).length;
    expect(shown()).toBeGreaterThan(0);
    expect(onBeep).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(5000);
    expect(onBeep.mock.calls.map(([long]) => long)).toEqual([false, false, false, false, true]);

    controller.setWindow({ ...window, minBib: 1e9 });
    expect(shown()).toBe(0);
    await vi.advanceTimersByTimeAsync(ORGANIZER_INTERVAL_MS);
    expect(fetch).toHaveBeenCalledTimes(2);
    controller.stop();
  });
});

describe('lastPassingsController', () => {
  it('marks passings that are new since the previous update', async () => {
    vi.useFakeTimers();
    const later = entries.map((e, i) =>
      i == 0 ? { ...e, time: { ...e.time, updated: '2099-01-01T00:00:00Z' } } : e,
    );
    const fetch = vi
      .fn()
      .mockImplementationOnce(() =>
        Promise.resolve(new Response(JSON.stringify({ data: entries }))),
      )
      .mockImplementation(() => Promise.resolve(new Response(JSON.stringify({ data: later }))));
    const controller = lastPassingsController(
      new Time4oApi('https://t/', fetch),
      'r',
      classes,
      opts,
    );
    controller.start();
    await vi.advanceTimersByTimeAsync(0);
    const first = controller.store.get().data!;
    expect(first).toHaveLength(3);
    expect(first.some((p) => p.fresh)).toBe(false);

    await vi.advanceTimersByTimeAsync(PASSINGS_INTERVAL_MS);
    const [newest, ...rest] = controller.store.get().data!;
    expect(newest).toMatchObject({
      fresh: true,
      changed: Date.parse('2099-01-01T00:00:00Z') / 1000,
    });
    expect(rest.map((p) => p.key)).toEqual(first.slice(0, 2).map((p) => p.key));
    expect(rest.some((p) => p.fresh)).toBe(false);
    controller.stop();
  });
});

describe('scrollController', () => {
  it('fetches every class in one request and keeps polling', async () => {
    vi.useFakeTimers();
    const finished = interval.entries.filter((e) => e.status?.status != 'Active');
    const { api, fetch } = fakeApi(finished);
    const controller = scrollController(api, 'r', classes, { ...opts, live: true });
    controller.start();
    await vi.advanceTimersByTimeAsync(0);
    const { views, predictions } = controller.store.get();
    expect(views!.map((v) => v.results.length)).toEqual([finished.length]);
    expect(predictions[0]!.active).toBe(false);
    await vi.advanceTimersByTimeAsync(SCROLL_INTERVAL_MS);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(fetch.mock.calls)).not.toContain('raceClassId');
    controller.stop();
  });
});
