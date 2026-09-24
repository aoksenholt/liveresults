import { Time4oApi } from '../api/client';
import type { Entry } from '../api/types';
import { normalizeClasses } from '../domain/time4o';
import { FIXTURES, midRace } from '../test/fixtures';
import {
  leftInForestController,
  ORGANIZER_INTERVAL_MS,
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
