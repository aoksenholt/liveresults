import { Fragment, useMemo, useState, type ReactNode } from 'react';
import type { ClassListItem } from '../domain/classList';
import { useDisplay } from './context';
import { routeHash, type Route } from './route';
import { closeTab, menuEntries, openTab } from './tabs';

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

/** The class menu of the legacy viewer, followed by the lists for all classes. */
export function ClassMenu({ items, route }: { items: ClassListItem[]; route: Route }) {
  const { res } = useDisplay();
  const current = routeHash(route);
  const link = (r: Route, children: ReactNode) => (
    <MenuLink route={r} current={current}>
      {children}
    </MenuLink>
  );
  return (
    <>
      {items.map((item, i) => (
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
      ))}
      <hr />
      {link({ kind: 'plainresults' }, res._ALLCLASSES)}
      <br />
      {link({ kind: 'startlist' }, res._STARTLIST)}
      <hr />
    </>
  );
}

/**
 * The class picker of the new look: class buttons until a class is chosen, then a drop-down
 * with every page of the menu and a tab for each page opened.
 */
export function ClassPicker({ items, route }: { items: ClassListItem[]; route: Route }) {
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

  if (route.kind == 'none')
    return (
      <section className="class-picker">
        <h2>{res._CHOOSECLASS}</h2>
        <nav className="class-buttons">
          <ClassMenu items={items} route={route} />
        </nav>
      </section>
    );

  const close = (hash: string) => {
    const { tabs: rest, next } = closeTab(tabs, hash, current);
    setState({ tabs: rest, shown });
    if (next) window.location.hash = next;
  };
  const label = (hash: string) => entries.find((e) => e.hash == hash)?.label ?? hash;
  return (
    <section className="class-picker">
      <div className="class-toolbar">
        <select
          aria-label={res._CHOOSECLASS}
          value={entries.some((e) => e.hash == current) ? current : ''}
          onChange={(e) => (window.location.hash = e.target.value)}
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
      </div>
      {tabs.length > 0 && (
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
