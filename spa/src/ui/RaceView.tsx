import { Fragment, useEffect, useMemo, useState, type MouseEvent, type ReactNode } from 'react';
import type { ClassListItem } from '../domain/classList';
import { summarize } from '../domain/races';
import {
  classListController,
  raceController,
  type ClassList,
  type RaceInfo,
} from '../state/controllers';
import { ClassResults } from './ClassResults';
import { ClubResults } from './ClubResults';
import { Info, Loading, Message } from './common';
import { deviceType, useDisplay } from './context';
import { useControllerState, useHashRoute } from './hooks';
import { ListResults } from './ListResults';
import { RelayResults } from './RelayResults';
import { routeHash, type Route } from './route';

export interface RaceProps {
  raceId: string;
  info: RaceInfo;
  classList: ClassList;
}

export function RaceView({ raceId }: { raceId: string }) {
  const { api, res } = useDisplay();
  const controller = useMemo(() => raceController(api, raceId), [api, raceId]);
  const { data, error } = useControllerState(controller);
  if (!data) return <Loading error={error} text={res._LOADINGCLASSES ?? ''} />;
  return <RaceContent raceId={raceId} info={data} />;
}

function RaceContent({ raceId, info }: { raceId: string; info: RaceInfo }) {
  const { api, res, lang } = useDisplay();
  const controller = useMemo(
    () => classListController(api, raceId, info.live),
    [api, raceId, info.live],
  );
  const { data: classList, error } = useControllerState(controller);
  const route = useHashRoute();
  const mobile = deviceType() == 'mobile';
  const [menuOpen, setMenuOpen] = useState(!mobile);
  const name = summarize(info.race).name;

  useEffect(() => {
    document.title = name;
  }, [name]);

  const closeOnMobile = (e: MouseEvent) => {
    if (mobile && (e.target as HTMLElement).closest('a')) setMenuOpen(false);
  };

  return (
    <>
      <div className="bar">
        <a className="navbtn" href={`?lang=${lang}`} title={res._CHOOSECMP}>
          ☰
        </a>
        <button
          className="navbtn"
          onClick={() => setMenuOpen((open) => !open)}
          title={res._CHOOSECLASS}
          aria-expanded={menuOpen}
        >
          ▤
        </button>
        <span className="title">{name}</span>
      </div>
      <div className="container">
        <nav className={menuOpen ? 'class-column' : 'class-column closed'} onClick={closeOnMobile}>
          {classList && <ClassMenu items={classList.items} route={route} />}
        </nav>
        <main className="result-column">
          {!classList ? (
            <Loading error={error} text={res._LOADINGCLASSES ?? ''} />
          ) : classList.classes.length == 0 ? (
            <Message>{res._NOCLASSESYET}</Message>
          ) : (
            <RouteView route={route} raceId={raceId} info={info} classList={classList} />
          )}
          <Info />
        </main>
      </div>
    </>
  );
}

function RouteView({ route, ...props }: RaceProps & { route: Route }) {
  const { res } = useDisplay();
  switch (route.kind) {
    case 'class':
      return <ClassResults key={route.className} className={route.className} {...props} />;
    case 'club':
      return <ClubResults key={route.clubId} clubId={route.clubId} {...props} />;
    case 'relay':
      return <RelayResults key={route.className} className={route.className} {...props} />;
    case 'startlist':
    case 'plainresults':
      return <ListResults key={route.kind} type={route.kind} {...props} />;
    case 'sprint':
      return (
        <ListResults key={`sprint:${route.key}`} type="sprint" sprintKey={route.key} {...props} />
      );
    default:
      return <Message>{res._NOCLASSCHOSEN}</Message>;
  }
}

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
function ClassMenu({ items, route }: { items: ClassListItem[]; route: Route }) {
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
