import { useEffect, useMemo, useState, type CSSProperties, type MouseEvent } from 'react';
import { summarize } from '../domain/races';
import {
  classListController,
  raceController,
  type ClassList,
  type RaceInfo,
} from '../state/controllers';
import { ClassMenu, ClassPicker, PageSelect, useTabs } from './ClassMenu';
import { ClassResults } from './ClassResults';
import { ClubResults } from './ClubResults';
import { Info, Loading, Message } from './common';
import { deviceType, useDisplay } from './context';
import { useControllerState, useHashRoute } from './hooks';
import { LastPassings } from './LastPassings';
import { ListResults } from './ListResults';
import { RelayResults } from './RelayResults';
import { parseHash, type Route } from './route';
import { RaceSearch } from './Search';
import { otherColumns } from './tabs';
import { ThemeToggle, useNewLook } from './ThemeToggle';

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
  const newLook = useNewLook();
  const mobile = deviceType() == 'mobile';
  const [menuOpen, setMenuOpen] = useState(!mobile);
  const { name, date } = summarize(info.race);

  useEffect(() => {
    document.title = name;
  }, [name]);

  const closeOnMobile = (e: MouseEvent) => {
    if (mobile && (e.target as HTMLElement).closest('a')) setMenuOpen(false);
  };

  const content = (
    <>
      {info.live && classList && classList.classes.length > 0 && (
        <LastPassings raceId={raceId} classes={classList.classes} timeZone={info.timeZone} />
      )}
      {!classList ? (
        <Loading error={error} text={res._LOADINGCLASSES ?? ''} />
      ) : classList.classes.length == 0 ? (
        <Message>{res._NOCLASSESYET}</Message>
      ) : (
        <RouteView route={route} raceId={raceId} info={info} classList={classList} />
      )}
      <Info themeToggle={false} />
    </>
  );

  return (
    <>
      <div className="bar">
        <a className="navbtn" href={`?lang=${lang}`} title={res._CHOOSECMP}>
          ☰
        </a>
        {!newLook && (
          <button
            className="navbtn"
            onClick={() => setMenuOpen((open) => !open)}
            title={res._CHOOSECLASS}
            aria-expanded={menuOpen}
          >
            ▤
          </button>
        )}
        <span className="title">{name}</span>
        <span className="date">{date}</span>
        <ThemeToggle className="navbtn theme-toggle" />
      </div>
      {newLook && classList && classList.classes.length > 0 ? (
        <NewLookPage route={route} raceId={raceId} info={info} classList={classList} />
      ) : newLook ? (
        <main className="page">{content}</main>
      ) : (
        <div className="container">
          <nav
            className={menuOpen ? 'class-column' : 'class-column closed'}
            onClick={closeOnMobile}
          >
            {classList && <ClassMenu items={classList.items} route={route} />}
          </nav>
          <main className="result-column">{content}</main>
        </div>
      )}
    </>
  );
}

function NewLookPage({ route, ...props }: RaceProps & { route: Route }) {
  const { res } = useDisplay();
  const { raceId, info, classList } = props;
  const tabs = useTabs(classList.items, route);
  const [columns, setColumns] = useState(1);
  const [others, setOthers] = useState<string[]>([]);
  const chooseColumns = (n: number) => {
    if (n == 1) tabs.openAll(others.filter((h) => h != ''));
    setOthers(otherColumns(others, tabs.tabs, tabs.current, n));
    setColumns(n);
  };
  const choose = (i: number, hash: string) =>
    setOthers((pages) => pages.map((p, j) => (j == i ? hash : p)));
  const pane = (hash: string) =>
    hash == '' ? (
      <div className="empty-column">{res._NOCLASSCHOSEN}</div>
    ) : (
      <RouteView route={parseHash(hash)} {...props} />
    );
  return (
    <main className={columns > 1 ? 'page wide' : 'page'}>
      <ClassPicker
        items={classList.items}
        route={route}
        tabs={tabs}
        columns={columns}
        setColumns={chooseColumns}
        search={<RaceSearch raceId={raceId} classes={classList.classes} timeZone={info.timeZone} />}
      />
      {info.live && (
        <LastPassings raceId={raceId} classes={classList.classes} timeZone={info.timeZone} />
      )}
      {route.kind == 'none' ? null : columns == 1 ? (
        pane(tabs.current)
      ) : (
        <div className="columns" style={{ '--columns': columns } as CSSProperties}>
          <div className="column">
            <PageSelect
              entries={tabs.entries}
              value={tabs.current}
              onChange={(hash) => (window.location.hash = hash)}
            />
            {pane(tabs.current)}
          </div>
          {others.map((hash, i) => (
            <div className="column" key={i}>
              <PageSelect entries={tabs.entries} value={hash} onChange={(h) => choose(i, h)} />
              {pane(hash)}
            </div>
          ))}
        </div>
      )}
      <Info themeToggle={false} />
    </main>
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
