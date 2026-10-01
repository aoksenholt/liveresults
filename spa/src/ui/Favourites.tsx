import { useEffect, useMemo } from 'react';
import {
  canBeFavourite,
  favouriteList,
  formatFavourites,
  parseFavourites,
  toggleFavourite,
} from '../domain/favourites';
import type { ResultRow } from '../domain/model';
import { passingRow } from '../domain/passings';
import { favouritesController } from '../state/controllers';
import { runnerClub } from '../domain/classTable';
import { ClubLink } from './ClassResults';
import { html, Loading, Message } from './common';
import { useDisplay } from './context';
import { useControllerState } from './hooks';
import { PassingItem } from './LastPassings';
import { namePage } from './pageNames';
import type { RaceProps } from './RaceView';
import { ResultsTable } from './ResultsTable';
import { routeHash } from './route';
import { storedPerKey } from './stored';
import { useNewLook } from './ThemeToggle';

const MAX_PASSINGS = 30;
export const FAVOURITES_HASH = routeHash({ kind: 'favourites' });

// `useSyncExternalStore` needs the same list on every read until the user picks a favourite.
const NONE: number[] = [];

const useStoredFavourites = storedPerKey<number[]>(
  'liveres-favourites-',
  () => NONE,
  parseFavourites,
  formatFavourites,
);

export interface Favourites {
  ids: Set<number>;
  toggle: (dbid: number) => void;
}

/** The favourite runners of a race, remembered per race and shared by every star. */
export function useFavourites(raceId: string): Favourites {
  const [list, setList] = useStoredFavourites(raceId);
  const ids = useMemo(() => new Set(list), [list]);
  return { ids, toggle: (dbid) => setList(toggleFavourite(list, dbid)) };
}

/** The `star` icon of Lucide (ISC licence). */
export function StarIcon({ size = 16, filled = false }: { size?: number; filled?: boolean }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z" />
    </svg>
  );
}

/** Marks a runner as a favourite in the new look; without a race there is nothing to mark. */
export function FavouriteStar({ raceId, row }: { raceId?: string; row: ResultRow }) {
  const newLook = useNewLook();
  const { ids, toggle } = useFavourites(raceId ?? '');
  const { res } = useDisplay();
  if (!newLook || raceId === undefined || !canBeFavourite(row)) return null;
  const on = ids.has(row.dbid);
  const label = `${on ? res._REMOVEFAVOURITE : res._ADDFAVOURITE}: ${row.name}`;
  return (
    <button
      type="button"
      className={on ? 'favourite-star on' : 'favourite-star'}
      aria-pressed={on}
      aria-label={label}
      title={label}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggle(row.dbid);
      }}
    >
      <StarIcon size={14} filled={on} />
    </button>
  );
}

/** Opens the favourites page, with the number of favourites, once there are any. */
export function FavouritesButton({ raceId }: { raceId: string }) {
  const { res } = useDisplay();
  const { ids } = useFavourites(raceId);
  if (ids.size == 0) return null;
  return (
    <a
      className="favourites-button"
      href={FAVOURITES_HASH}
      aria-label={`${res._FAVOURITES} (${ids.size})`}
      title={res._FAVOURITES}
    >
      <StarIcon size={18} filled />
      <span className="count">{ids.size}</span>
    </a>
  );
}

/** The favourites of a race across classes: their results, latest split and every passing. */
export function FavouritesView({ raceId, info, classList }: RaceProps) {
  const { api, res, format } = useDisplay();
  const { ids } = useFavourites(raceId);
  const controller = useMemo(
    () =>
      favouritesController(api, raceId, classList.classes, {
        timeZone: info.timeZone,
        live: info.live,
      }),
    [api, raceId, classList.classes, info.timeZone, info.live],
  );
  const { data, error } = useControllerState(controller);
  const list = useMemo(
    () => data && favouriteList(data, classList.classes, ids, format),
    [data, classList.classes, ids, format],
  );
  const title = res._FAVOURITES ?? '';
  useEffect(() => namePage(FAVOURITES_HASH, title), [title]);
  const finish = res._CONTROLFINISH ?? '';
  const passing = (p: Parameters<typeof passingRow>[0]) =>
    passingRow(p, format, info.timeZone, finish);

  const header = <h2 className="class-header">{title}</h2>;
  const onCourse = list?.rows.some((r) => r.latest) ?? false;
  if (ids.size == 0)
    return (
      <>
        {header}
        <Message>{res._NOFAVOURITES}</Message>
      </>
    );
  if (!list) return <Loading error={error} text={res._LOADINGRESULTS ?? ''} />;
  return (
    <>
      {header}
      {list.rows.length == 0 ? (
        <Message>{res._NORUNNERS}</Message>
      ) : (
        <ResultsTable
          head={
            <thead className="favourites">
              <tr>
                <th className="right">#</th>
                <th className="wide">{`${res._NAME} / ${res._CLUB}`}</th>
                <th>{res._CLASS}</th>
                <th className="right">{res._START}</th>
                {onCourse && <th>{res._LASTCONTROL}</th>}
                <th className="right">{finish}</th>
                <th className="right">Diff</th>
              </tr>
            </thead>
          }
        >
          <tbody className="favourites">
            {list.rows.map((r, i) => {
              const latest = r.latest && passing(r.latest);
              return (
                <tr key={`${r.row.dbid}:${r.row.class}:${i}`}>
                  <td className="right">{r.row.place}</td>
                  <td>
                    <FavouriteStar raceId={raceId} row={r.row} />
                    <span className="runner-name">{r.name}</span>
                    <br />
                    <ClubLink
                      row={r.row}
                      text={runnerClub(r.row, format.maxClubLength)}
                      className="club"
                    />
                  </td>
                  <td>
                    <a href={routeHash({ kind: 'class', className: r.row.class })}>{r.row.class}</a>
                  </td>
                  <td className="right">{r.start}</td>
                  {onCourse && (
                    <td className="latest">
                      {latest && (
                        <>
                          <span className="latest-where">{latest.controlName}</span> {latest.time}
                          {latest.place && ` (${latest.place})`}
                        </>
                      )}
                    </td>
                  )}
                  <td className="right" {...html(r.finish)} />
                  <td className="right" {...html(r.diff)} />
                </tr>
              );
            })}
          </tbody>
        </ResultsTable>
      )}
      {list.passings.length > 0 && (
        <section className="favourite-passings">
          <h3>{res._PASSINGS}</h3>
          <ol className="passing-rows">
            {list.passings.slice(0, MAX_PASSINGS).map((p) => (
              <PassingItem key={`${p.dbid}:${p.control}:${p.changed}`} row={passing(p)} />
            ))}
          </ol>
        </section>
      )}
    </>
  );
}
