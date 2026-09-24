import { Fragment, useEffect, useMemo, useState, type ReactNode } from 'react';
import { classGroups, type ClassListItem } from '../domain/classList';
import { useDisplay } from './context';
import { useFrozenColumns } from './frozen';
import { usePageName } from './pageNames';
import { routeHash, type Route } from './route';
import { useStoredList } from './stored';
import { closeTab, menuEntries, openTab, rememberPage, type MenuEntry } from './tabs';

function MenuLink({
  route,
  current,
  children,
}: {
  route: Route;
  current: string;
  children: ReactNode;
}) {
  const href = routeHash(route);
  return (
    <a href={href} className={href == current ? 'active' : undefined}>
      {children}
    </a>
  );
}

function MenuItems({ items, current }: { items: ClassListItem[]; current: string }) {
  const link = (r: Route, children: ReactNode) => (
    <MenuLink route={r} current={current}>
      {children}
    </MenuLink>
  );
  return items.map((item, i) => (
    <Fragment key={i}>
      {item.kind == 'relay' ? (
        link({ kind: 'relay', className: item.className }, <b>{item.title}</b>)
      ) : item.kind == 'sprint' ? (
        link(
          { kind: 'sprint', key: item.plainKey.replace(/^plainresultsclass_/, '') },
          <b>{item.title}</b>,
        )
      ) : item.kind == 'leg' ? (
        <>
          {' '}
          {link(
            { kind: 'class', className: item.className },
            item.label == 'Ⓐ' ? (
              item.label
            ) : (
              <span style={{ fontSize: '1.2em' }}>{item.label}</span>
            ),
          )}
        </>
      ) : item.kind == 'heat' ? (
        <> {link({ kind: 'class', className: item.className }, item.label)}</>
      ) : item.kind == 'class' ? (
        link({ kind: 'class', className: item.className }, item.label)
      ) : item.kind == 'indent' ? (
        <>
          <br />
          &nbsp;
        </>
      ) : item.kind == 'break' ? (
        <br />
      ) : (
        <hr />
      )}
    </Fragment>
  ));
}

/** The class menu of the legacy viewer, followed by the lists for all classes. */
export function ClassMenu({ items, route }: { items: ClassListItem[]; route: Route }) {
  const { res } = useDisplay();
  const current = routeHash(route);
  return (
    <>
      <MenuItems items={items} current={current} />
      <hr />
      <MenuLink route={{ kind: 'plainresults' }} current={current}>
        {res._ALLCLASSES}
      </MenuLink>
      <br />
      <MenuLink route={{ kind: 'startlist' }} current={current}>
        {res._STARTLIST}
      </MenuLink>
      <hr />
    </>
  );
}

const GROUP_TITLES = { women: '_WOMEN', men: '_MEN', other: '_OTHERCLASSES' } as const;

/** The class buttons of the new look: the classes opened last, then women, men and the rest. */
function ClassButtons({
  items,
  sexes,
  current,
  recent,
  label,
}: {
  items: ClassListItem[];
  sexes: Map<string, string>;
  current: string;
  recent: string[];
  label: (hash: string) => string;
}) {
  const { res } = useDisplay();
  const groups = useMemo(() => classGroups(items, sexes), [items, sexes]);
  return (
    <div className="class-buttons">
      {recent.length > 0 && (
        <section className="class-group recent">
          <h3>{res._RECENTCLASSES}</h3>
          <nav>
            {recent.map((hash) => (
              <a key={hash} href={hash}>
                {label(hash)}
              </a>
            ))}
          </nav>
        </section>
      )}
      <div className="class-groups">
        {groups.map((group) => (
          <section key={group.kind} className={`class-group ${group.kind}`}>
            {groups.length > 1 && <h3>{res[GROUP_TITLES[group.kind]]}</h3>}
            <nav>
              <MenuItems items={group.items} current={current} />
            </nav>
          </section>
        ))}
      </div>
      <nav className="class-lists">
        <MenuLink route={{ kind: 'plainresults' }} current={current}>
          {res._ALLCLASSES}
        </MenuLink>
        <MenuLink route={{ kind: 'startlist' }} current={current}>
          {res._STARTLIST}
        </MenuLink>
      </nav>
    </div>
  );
}

export interface Tabs {
  entries: MenuEntry[];
  tabs: string[];
  current: string;
  close: (hash: string) => void;
  /** Opens a tab for each page, for the columns when going back to one. */
  openAll: (hashes: string[]) => void;
  label: (hash: string) => string;
}

/** The tabs of the new look: every page opened from the menu, until it is closed. */
export function useTabs(items: ClassListItem[], route: Route): Tabs {
  const { res } = useDisplay();
  const current = routeHash(route);
  const entries = useMemo(
    () =>
      menuEntries(items, { allClasses: res._ALLCLASSES ?? '', startList: res._STARTLIST ?? '' }),
    [items, res],
  );
  const [{ tabs, shown }, setState] = useState({ tabs: [] as string[], shown: '' });
  // A tab only opens when the page changes, so a closed tab stays closed until the hash follows.
  if (shown != current) setState({ tabs: openTab(tabs, current, entries), shown: current });
  const close = (hash: string) => {
    const { tabs: rest, next } = closeTab(tabs, hash, current);
    setState({ tabs: rest, shown });
    if (next) window.location.hash = next;
  };
  const openAll = (hashes: string[]) =>
    setState((s) => ({ ...s, tabs: hashes.reduce((t, h) => openTab(t, h, entries), s.tabs) }));
  const pageName = usePageName();
  const label = (hash: string) =>
    entries.find((e) => e.hash == hash)?.label ?? pageName(hash) ?? hash;
  return { entries, tabs, current, close, openAll, label };
}

/** A drop-down of every page of the menu; other pages, such as clubs, show the placeholder. */
export function PageSelect({
  entries,
  value,
  onChange,
}: {
  entries: MenuEntry[];
  value: string;
  onChange: (hash: string) => void;
}) {
  const { res } = useDisplay();
  return (
    <select
      aria-label={res._CHOOSECLASS}
      value={entries.some((e) => e.hash == value) ? value : ''}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="" disabled>
        {res._CHOOSECLASS}
      </option>
      {entries.map((e) => (
        <option key={e.hash} value={e.hash}>
          {e.label}
        </option>
      ))}
    </select>
  );
}

export const MAX_COLUMNS = 4;

const ICON_WIDTH = 20;
const ICON_GAP = 2;

function ColumnsIcon({ columns }: { columns: number }) {
  const width = (ICON_WIDTH - (columns - 1) * ICON_GAP) / columns;
  return (
    <svg width={ICON_WIDTH} height="12" viewBox={`0 0 ${ICON_WIDTH} 12`} aria-hidden="true">
      {Array.from({ length: columns }, (_, i) => (
        <rect key={i} x={i * (width + ICON_GAP)} width={width} height="12" rx="1.5" />
      ))}
    </svg>
  );
}

/**
 * The class picker of the new look: class buttons until a class is chosen, then a drop-down
 * with every page of the menu and a tab for each page opened. With more than one column, each
 * column has its own drop-down instead.
 */
function FreezeToggle() {
  const { res } = useDisplay();
  const [frozen, toggle] = useFrozenColumns();
  return (
    <button
      className="freeze-toggle"
      aria-label={res._FREEZE}
      title={res._FREEZE}
      aria-pressed={frozen}
      onClick={toggle}
    >
      <svg width="20" height="12" viewBox="0 0 20 12" aria-hidden="true">
        <rect width="7" height="12" rx="1.5" />
        <rect x="8.5" y="0.5" width="11" height="11" rx="1.5" fill="none" stroke="currentColor" />
      </svg>
    </button>
  );
}

export function ClassPicker({
  raceId,
  items,
  sexes,
  route,
  tabs: { entries, tabs, current, close, label },
  columns,
  setColumns,
  search,
}: {
  raceId: string;
  items: ClassListItem[];
  sexes: Map<string, string>;
  route: Route;
  tabs: Tabs;
  columns: number;
  setColumns: (columns: number) => void;
  search: ReactNode;
}) {
  const { res } = useDisplay();
  const chosen = route.kind != 'none';
  const [recent, setRecent] = useStoredList(`liveres-recent-${raceId}`);
  useEffect(() => {
    const next = rememberPage(recent, current, entries);
    if (next != recent) setRecent(next);
  }, [current, entries, recent, setRecent]);
  const counts = Array.from({ length: MAX_COLUMNS }, (_, i) => i + 1);
  return (
    <section className="class-picker">
      <div className="class-toolbar">
        {chosen && columns == 1 && (
          <PageSelect
            entries={entries}
            value={current}
            onChange={(hash) => (window.location.hash = hash)}
          />
        )}
        {search}
        {chosen && <FreezeToggle />}
        {chosen && (
          <div className="columns-choice" role="group" aria-label={res._COLUMNS}>
            {counts.map((n) => (
              <button
                key={n}
                aria-label={String(n)}
                aria-pressed={n == columns}
                onClick={() => setColumns(n)}
              >
                <ColumnsIcon columns={n} />
              </button>
            ))}
          </div>
        )}
      </div>
      {!chosen && (
        <>
          <h2>{res._CHOOSECLASS}</h2>
          <ClassButtons
            items={items}
            sexes={sexes}
            current={current}
            recent={recent}
            label={label}
          />
        </>
      )}
      {chosen && columns == 1 && tabs.length > 0 && (
        <nav className="tabs">
          {tabs.map((hash) => (
            <span key={hash} className={hash == current ? 'tab active' : 'tab'}>
              <a href={hash}>{label(hash)}</a>
              <button onClick={() => close(hash)} aria-label={`${res._CLOSETAB} ${label(hash)}`}>
                ×
              </button>
            </span>
          ))}
        </nav>
      )}
    </section>
  );
}
