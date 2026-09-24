import type { ApiResult, Time4oApi } from '../api/client';
import type { Entry, Race, RaceClass } from '../api/types';
import { classListItems, relayClassNames, type ClassListItem } from '../domain/classList';
import type { ClassInfo, ClubResults, GroupedClassResults, ResultRow } from '../domain/model';
import {
  entryRows,
  leftInForest,
  startMarks,
  startRegistration,
  type StartMark,
  type StartWindow,
} from '../domain/organizer';
import { buildClassView, type ClassView } from '../domain/pipeline';
import {
  eventClock,
  serverTimeDiff,
  updatePredictedTimes,
  type Predictions,
} from '../domain/predicted';
import { isRaceToday, localDate, raceList, type RaceList } from '../domain/races';
import { relayTeams, type RelayTeam } from '../domain/relay';
import {
  clubResults,
  DEFAULT_TIME_ZONE,
  groupedResults,
  normalizeClasses,
  relayResults,
  type ListType,
} from '../domain/time4o';
import { Poller } from './poller';
import { Store } from './store';

// Update intervals of the legacy viewer for Time4o races.
export const CLASS_INTERVAL_MS = 3000;
export const CLASS_LIST_INTERVAL_MS = 60000;
export const CLUB_INTERVAL_MS = 20000;
export const ORGANIZER_INTERVAL_MS = 15000;

export interface Loadable<T> {
  data: T | null;
  error: string | null;
}

export interface Clock {
  now: () => number;
}

const systemClock: Clock = { now: () => Date.now() };

export interface Controller<S> {
  store: Store<S>;
  start(): void;
  stop(): void;
}

function pollingController<T, S>(
  request: (etag: string | null) => Promise<ApiResult<T>>,
  intervalMs: number,
  transform: (data: T) => S,
): Controller<Loadable<S>> {
  const store = new Store<Loadable<S>>({ data: null, error: null });
  const poller = new Poller<T>({
    request,
    intervalMs,
    onData: (data) => store.set({ data: transform(data), error: null }),
    onError: (error) => store.set({ error }),
  });
  return { store, start: () => poller.start(), stop: () => poller.stop() };
}

export const raceListController = (api: Time4oApi, clock: Clock = systemClock) =>
  pollingController(
    (etag) => api.getRaces(etag),
    0,
    (races: Race[]): RaceList => raceList(races, localDate(clock.now())),
  );

export interface RaceInfo {
  race: Race;
  timeZone: string;
  live: boolean;
}

export const raceController = (api: Time4oApi, raceId: string, clock: Clock = systemClock) =>
  pollingController(
    (etag) => api.getRace(raceId, etag),
    0,
    (race: Race): RaceInfo => ({
      race,
      timeZone: race.event?.timezone ?? DEFAULT_TIME_ZONE,
      live: isRaceToday(race.date, clock.now()),
    }),
  );

export interface ClassList {
  classes: ClassInfo[];
  items: ClassListItem[];
  relayClasses: Set<string>;
}

export const classListController = (api: Time4oApi, raceId: string, live: boolean) =>
  pollingController(
    (etag) => api.getClasses(raceId, etag),
    live ? CLASS_LIST_INTERVAL_MS : 0,
    (raw: RaceClass[]): ClassList => {
      const classes = normalizeClasses(raw);
      const items = classListItems(classes);
      return { classes, items, relayClasses: relayClassNames(items) };
    },
  );

export interface ClassState {
  view: ClassView | null;
  predictions: Predictions | null;
  /** Unix seconds on the server clock, for highlighting recent results. */
  serverNow: number;
  error: string | null;
}

/**
 * Results of one class, polled while the race is live. Running times are
 * recalculated every whole second like the legacy viewer, which also stops
 * polling once no runner in the class is on course.
 */
export function classResultsController(
  api: Time4oApi,
  raceId: string,
  cls: ClassInfo,
  opts: { timeZone: string; live: boolean; clock?: Clock },
): Controller<ClassState> {
  const clock = opts.clock ?? systemClock;
  const store = new Store<ClassState>({
    view: null,
    predictions: null,
    serverNow: clock.now() / 1000,
    error: null,
  });
  let timeDiff = 0;
  let predData: ClassView['results'] = [];
  let timer: ReturnType<typeof setTimeout> | null = null;

  const tick = () => {
    const view = store.get().view;
    if (!view) return;
    const now = clock.now();
    const predictions = updatePredictedTimes(
      view,
      predData,
      eventClock(now, timeDiff, opts.timeZone),
      false,
    );
    store.set({ predictions, serverNow: (now - timeDiff) / 1000 });
    if (!predictions.active) {
      poller.stop();
      return;
    }
    const ms = now % 1000;
    timer = setTimeout(tick, ms > 950 ? 2000 - ms : 1000 - ms);
  };

  const poller = new Poller<Entry[]>({
    request: async (etag) => {
      const start = clock.now();
      const result = await api.getEntries(raceId, { raceClassId: cls.id }, etag);
      if (result.status != 'error' && result.serverDate != null)
        timeDiff = serverTimeDiff(timeDiff, result.serverDate, start, clock.now());
      return result;
    },
    intervalMs: opts.live ? CLASS_INTERVAL_MS : 0,
    onData: (entries) => {
      const view = buildClassView(cls, entries, { timeZone: opts.timeZone });
      predData = structuredClone(view.results);
      store.set({ view, predictions: null, error: null });
      if (timer) clearTimeout(timer);
      timer = null;
      if (opts.live) tick();
    },
    onError: (error) => store.set({ error }),
  });

  return {
    store,
    start: () => poller.start(),
    stop: () => {
      poller.stop();
      if (timer) clearTimeout(timer);
      timer = null;
    },
  };
}

export const clubController = (
  api: Time4oApi,
  raceId: string,
  clubId: string,
  classes: ClassInfo[],
  opts: { timeZone: string; live: boolean },
) =>
  pollingController(
    (etag) => api.getEntries(raceId, { organisationId: clubId }, etag),
    opts.live ? CLUB_INTERVAL_MS : 0,
    (entries: Entry[]): ClubResults => clubResults(entries, classes, opts),
  );

export interface RelayView {
  className: string;
  legs: number;
  teams: RelayTeam[];
  /** Teams on the first leg, which decides the padding of places like the legacy table. */
  numberOfTeams: number;
}

/** `className` is the first leg; Time4o returns every leg for `<classId>.all`. */
export function relayController(
  api: Time4oApi,
  raceId: string,
  className: string,
  classes: ClassInfo[],
  opts: { timeZone: string },
) {
  const cls = classes.find((c) => c.className == className);
  const raceClassId = (cls?.id ?? '').replace(/\.\d+$/, '.all');
  return pollingController(
    (etag) => api.getEntries(raceId, { raceClassId }, etag),
    0,
    (entries: Entry[]): RelayView => {
      const data = relayResults(entries, className, classes, opts);
      return {
        className: data.className,
        legs: data.legs,
        teams: relayTeams(data),
        numberOfTeams: data.relayresults[0]?.results.length ?? 0,
      };
    },
  );
}

export interface ListView {
  groups: GroupedClassResults[];
  numEntries: number;
}

export const listController = (
  api: Time4oApi,
  raceId: string,
  type: ListType,
  classes: ClassInfo[],
  opts: { timeZone: string },
) =>
  pollingController(
    (etag) => api.getEntries(raceId, {}, etag),
    0,
    (entries: Entry[]): ListView => ({
      groups: groupedResults(entries, type, classes, opts),
      numEntries: entries.length,
    }),
  );

/** Runners on course or not started; the legacy view stops polling when the race is not today. */
export const leftInForestController = (
  api: Time4oApi,
  raceId: string,
  classes: ClassInfo[],
  opts: { timeZone: string; live: boolean },
) =>
  pollingController(
    (etag) => api.getEntries(raceId, {}, etag),
    opts.live ? ORGANIZER_INTERVAL_MS : 0,
    (entries: Entry[]): ResultRow[] => leftInForest(entryRows(entries, classes, opts)),
  );

export interface StartState {
  rows: ResultRow[] | null;
  marks: StartMark[];
  /** Seconds since midnight in the event time zone. */
  time: number;
  error: string | null;
}

export interface StartController extends Controller<StartState> {
  setWindow(w: StartWindow): void;
}

/**
 * The start registration view, which always polls like the legacy one and
 * refilters the runners every whole second so they appear at their call time.
 */
export function startRegistrationController(
  api: Time4oApi,
  raceId: string,
  classes: ClassInfo[],
  opts: {
    timeZone: string;
    window: StartWindow;
    clock?: Clock;
    onBeep?: (long: boolean) => void;
  },
): StartController {
  const clock = opts.clock ?? systemClock;
  const time = () => eventClock(clock.now(), 0, opts.timeZone) / 100;
  const store = new Store<StartState>({ rows: null, marks: [], time: time(), error: null });
  let win = opts.window;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const filter = (patch: Partial<StartState> = {}) => {
    const rows = patch.rows ?? store.get().rows;
    if (!rows) return 0;
    const now = time();
    const { marks, beep } = startMarks(rows, now, win);
    store.set({ ...patch, marks, time: now });
    return beep;
  };

  const tick = (patch?: Partial<StartState>) => {
    if (timer) clearTimeout(timer);
    const beep = filter(patch);
    if (beep > 0) opts.onBeep?.(beep == 2);
    const ms = clock.now() % 1000;
    timer = setTimeout(tick, ms > 800 ? 2000 - ms : 1000 - ms);
  };

  const poller = new Poller<Entry[]>({
    request: (etag) => api.getEntries(raceId, {}, etag),
    intervalMs: ORGANIZER_INTERVAL_MS,
    onData: (entries) =>
      tick({ rows: startRegistration(entryRows(entries, classes, opts)), error: null }),
    onError: (error) => store.set({ error }),
  });

  return {
    store,
    start: () => poller.start(),
    stop: () => {
      poller.stop();
      if (timer) clearTimeout(timer);
      timer = null;
    },
    setWindow: (w) => {
      win = w;
      filter();
    },
  };
}
