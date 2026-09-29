import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import type { ClassInfo } from '../domain/model';
import { passingRow, passingText, type PassingStrings } from '../domain/passings';
import { lastPassingsController, type ShownPassing } from '../state/controllers';
import { useDisplay } from './context';
import { FollowChooser, FunnelIcon, type Follow } from './FollowClasses';
import { useControllerState } from './hooks';
import { routeHash } from './route';
import { storedChoice } from './stored';

const SHOWN = 3;
export const COUNTED = 10;

export type PassingsView = 'open' | 'strip' | 'hidden';

// A strip by default on phones, where the box pushes the results far down.
const usePassingsView = storedChoice<PassingsView>(
  'liveres-passings-view',
  ['open', 'strip', 'hidden'],
  () => {
    try {
      const folded = window.localStorage.getItem('liveres-passings-collapsed');
      if (folded != null) return folded == '1' ? 'strip' : 'open';
    } catch {
      // Then the default below.
    }
    return window.matchMedia?.('(max-width: 600px)').matches ? 'strip' : 'open';
  },
);

/** The latest updates box at the top of the legacy followfull.php, in the classic look. */
export function LastPassings({
  raceId,
  classes,
  timeZone,
}: {
  raceId: string;
  classes: ClassInfo[];
  timeZone: string;
}) {
  const { api, res, format } = useDisplay();
  const controller = useMemo(
    () => lastPassingsController(api, raceId, classes, { timeZone }),
    [api, raceId, classes, timeZone],
  );
  const { data } = useControllerState(controller);
  const strings: PassingStrings = {
    finished: res._LASTPASSFINISHED ?? '',
    passed: res._LASTPASSPASSED ?? '',
    withTime: res._LASTPASSWITHTIME ?? '',
    withStatus: res._LASTPASSWITHSTATUS ?? '',
    newStatus: res._NEWSTATUS ?? '',
  };
  const lines = (data ?? []).map((p) => ({ ...passingText(p, format, strings, timeZone), p }));
  const list = (
    <div className="passings-container">
      {lines.map(({ p, ...line }) => (
        <div key={p.key} className={p.fresh ? 'passing-line fresh' : 'passing-line'}>
          {line.passtime}: {line.name} (
          <a href={routeHash({ kind: 'class', className: line.className })}>{line.className}</a>){' '}
          {line.text}
        </div>
      ))}
    </div>
  );

  return (
    <section className="last-passings" aria-live="polite">
      <b>{res._LASTPASSINGS}</b>
      {list}
    </section>
  );
}

const noSubscribe = () => () => {};

/**
 * Every update of a live race, polled once for the box and the toolbar button, which show those
 * of the classes followed.
 */
export function useLastPassings(
  raceId: string,
  classes: ClassInfo[],
  timeZone: string,
  live: boolean,
): ShownPassing[] | null {
  const { api } = useDisplay();
  const controller = useMemo(
    () =>
      live ? lastPassingsController(api, raceId, classes, { timeZone, limit: Infinity }) : null,
    [api, raceId, classes, timeZone, live],
  );
  useEffect(() => {
    if (!controller) return;
    controller.start();
    return () => controller.stop();
  }, [controller]);
  return useSyncExternalStore(controller?.store.subscribe ?? noSubscribe, () =>
    controller ? controller.store.get().data : null,
  );
}

export interface PassingsPanel {
  view: PassingsView;
  setView: (view: PassingsView) => void;
  /** Updates since the box was hidden. */
  unseen: number;
}

/** Whether the box is open, a strip or hidden, and what the button counts while hidden. */
export function usePassingsPanel(passings: ShownPassing[] | null): PassingsPanel {
  const [view, saveView] = usePassingsView();
  const [since, setSince] = useState<number | null>(null);
  const newest = passings?.[0]?.changed ?? null;
  // Hidden when the page opened: count from the updates there were then.
  if (view == 'hidden' && since == null && newest != null) setSince(newest);
  const setView = (next: PassingsView) => {
    setSince(next == 'hidden' ? newest : null);
    saveView(next);
  };
  const unseen =
    view == 'hidden' && since != null
      ? (passings ?? []).filter((p) => p.changed > since).length
      : 0;
  return { view, setView, unseen };
}

/** The latest updates of the new look: a box with rows, a strip with the newest, or hidden. */
export function PassingsBox({
  passings,
  panel: { view, setView },
  follow,
  timeZone,
}: {
  passings: ShownPassing[] | null;
  panel: PassingsPanel;
  follow: Follow;
  timeZone: string;
}) {
  const { res, format } = useDisplay();
  const filtered = follow.names != null;
  // A box without updates only shows when the classes chosen have none, so they can be changed.
  if (view == 'hidden' || !passings || (passings.length == 0 && !filtered)) return null;
  const empty = <p className="passings-empty">{res._NOFOLLOWEDPASSINGS}</p>;
  const pages = follow.groups.flatMap((g) => g.pages);
  const chosen = pages.filter((p) => p.classes.every((c) => follow.names?.has(c))).length;
  const scope = !filtered
    ? ''
    : follow.followed == 'tabs'
      ? res._TABS
      : `${chosen} ${res._CLASSESCOUNT}`;
  const rows = passings
    .slice(0, SHOWN)
    .map((p) => ({ ...passingRow(p, format, timeZone, res._CONTROLFINISH ?? ''), p }));
  const hide = (
    <button
      type="button"
      className="passings-hide"
      aria-label={res._HIDEPASSINGS}
      title={res._HIDEPASSINGS}
      onClick={() => setView('hidden')}
    >
      <span aria-hidden="true">×</span>
    </button>
  );

  if (view == 'strip') {
    const [latest] = rows;
    return (
      <section className="last-passings strip" aria-live="polite">
        <button
          type="button"
          className="passings-toggle"
          aria-expanded={false}
          aria-label={res._LASTPASSINGS}
          onClick={() => setView('open')}
        >
          <span className="live-dot" aria-hidden="true" />
          {filtered && (
            <span className="follow-mark" title={scope}>
              <FunnelIcon size={14} />
            </span>
          )}
          {latest ? (
            <>
              <span className="passing-name">{latest.name}</span>
              <span className="passing-where">{latest.controlName}</span>
              <span className={latest.isStatus ? 'passing-time status' : 'passing-time'}>
                {latest.time}
              </span>
              {latest.place && (
                <span className={latest.place == '1' ? 'passing-place first' : 'passing-place'}>
                  {latest.place}.
                </span>
              )}
              <span className="passing-class">{latest.className}</span>
            </>
          ) : (
            <span className="passings-empty">{res._NOFOLLOWEDPASSINGS}</span>
          )}
          <span className="chevron" aria-hidden="true" />
        </button>
      </section>
    );
  }

  return (
    <section className="last-passings" aria-live="polite">
      <div className="passings-head">
        <button
          type="button"
          className="passings-toggle"
          aria-expanded={true}
          onClick={() => setView('strip')}
        >
          <b>{res._LASTPASSINGS}</b>
          {scope && <span className="follow-scope">· {scope}</span>}
          <span className="chevron" aria-hidden="true" />
        </button>
        <FollowChooser follow={follow} />
        {hide}
      </div>
      {rows.length == 0 && empty}
      <ol className="passing-rows">
        {rows.map(({ p, ...row }) => (
          <li key={p.key} className={p.fresh ? 'passing-row fresh' : 'passing-row'}>
            <div className="passing-who">
              <span className="passing-name">{row.name}</span>
              <a
                className="passing-class"
                href={routeHash({ kind: 'class', className: row.className })}
              >
                {row.className}
              </a>
              <span className="passing-clock">{row.passtime}</span>
            </div>
            <div className="passing-what">
              <span className="passing-where">{row.controlName}</span>
              <span className={row.isStatus ? 'passing-time status' : 'passing-time'}>
                {row.time}
              </span>
              {row.place && (
                <span className={row.place == '1' ? 'passing-place first' : 'passing-place'}>
                  {row.place}.
                </span>
              )}
              {row.diff && <span className="passing-diff">{row.diff}</span>}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** The `activity` icon of Lucide (ISC licence). */
function ActivityIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2" />
    </svg>
  );
}

/** Brings the hidden box back, with the number of updates since it was hidden. */
export function PassingsButton({ panel: { view, setView, unseen } }: { panel: PassingsPanel }) {
  const { res } = useDisplay();
  if (view != 'hidden') return null;
  return (
    <button
      type="button"
      className="passings-button"
      aria-label={res._SHOWPASSINGS}
      title={res._SHOWPASSINGS}
      onClick={() => setView('strip')}
    >
      <ActivityIcon />
      {unseen > 0 && (
        <span className="unseen" aria-hidden="true">
          {unseen >= COUNTED ? `${COUNTED - 1}+` : unseen}
        </span>
      )}
    </button>
  );
}
