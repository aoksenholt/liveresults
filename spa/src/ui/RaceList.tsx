import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import {
  byStartTime,
  findRaces,
  formatRaceDate,
  raceYears,
  recentRaces,
  upcomingRaces,
  type RaceList as RaceListData,
  type RaceSummary,
  type TodayRace,
} from '../domain/races';
import { LANGUAGE_NAMES, LANGUAGES } from '../i18n';
import { raceListController } from '../state/controllers';
import { Info, Loading } from './common';
import { deviceType, useDisplay } from './context';
import { useControllerState } from './hooks';
import { Logo } from './Logo';
import { ThemeToggle, useNewLook } from './ThemeToggle';

function HeaderRow() {
  const { res } = useDisplay();
  return (
    <tr>
      <th>{res._DATE}</th>
      <th>{res._EVENTNAME}</th>
      <th>{res._ORGANIZER}</th>
      <th>{res._LINK}</th>
    </tr>
  );
}

function RaceRow({ race, className }: { race: RaceSummary; className?: string }) {
  const { lang, res } = useDisplay();
  const maxLength = deviceType() == 'mobile' ? 30 : 60;
  return (
    <tr className={className}>
      <td>{race.date}</td>
      <td>
        <a href={`?comp=${encodeURIComponent(race.id)}&lang=${lang}`}>
          {race.name.slice(0, maxLength)}
        </a>
      </td>
      <td>{race.organiser}</td>
      <td>{race.eventorUrl && <a href={race.eventorUrl}>{res._LINK}</a>}</td>
    </tr>
  );
}

function Heading({ children }: { children: string }) {
  return (
    <tr>
      <td colSpan={4}>
        <h1 className="categoriesheader">{children}</h1>
      </td>
    </tr>
  );
}

/** The race list of the legacy index.php, limited to Time4o races. */
export function RaceList() {
  const { api, res } = useDisplay();
  const newLook = useNewLook();
  const controller = useMemo(() => raceListController(api), [api]);
  const { data, error } = useControllerState(controller);

  useEffect(() => {
    document.title = res._TITLE ?? 'LiveRes';
  }, [res]);

  if (newLook)
    return (
      <>
        <Hero />
        <div className="race-page">
          {data ? <NewRaceList data={data} /> : <Loading error={error} text="…" />}
        </div>
      </>
    );
  if (!data) return <Loading error={error} text="…" />;
  return (
    <div className="race-page">
      <table className="race-table">
        <tbody>
          <Heading>LIVE TODAY!</Heading>
          <HeaderRow />
          {data.today.map(({ race }) => (
            <RaceRow key={race.id} race={race} className="today" />
          ))}
          <tr>
            <td>&nbsp;</td>
          </tr>
          <AllRaces data={data} />
        </tbody>
      </table>
      <Info />
    </div>
  );
}

function AllRaces({ data }: { data: RaceListData }) {
  const { res } = useDisplay();
  return (
    <>
      <Heading>{res._CHOOSECMP ?? ''}</Heading>
      <HeaderRow />
      {data.all.map((item) =>
        item.kind == 'year' ? (
          <Heading key={`year-${item.year}`}>{item.year}</Heading>
        ) : (
          <RaceRow
            key={item.race.id}
            race={item.race}
            className={item.firstBeforeToday ? 'first-before-today' : undefined}
          />
        ),
      )}
    </>
  );
}

function LanguagePicker() {
  const { lang, res } = useDisplay();
  const choose = (value: string) => {
    const params = new URLSearchParams(window.location.search);
    params.set('lang', value);
    window.location.search = params.toString();
  };
  return (
    <select
      className="language"
      value={lang}
      aria-label={res._LANGUAGE}
      onChange={(e) => choose(e.target.value)}
    >
      {LANGUAGES.map((l) => (
        <option key={l} value={l}>
          {LANGUAGE_NAMES[l] ?? l}
        </option>
      ))}
    </select>
  );
}

/** The green top of the front page of the liveresultat beta. */
function Hero() {
  const { res } = useDisplay();
  return (
    <header className="hero">
      <div className="hero-inner">
        <div className="hero-top">
          <span className="brand">
            <Logo />
            <span className="brand-name">{res._TITLE}</span>
          </span>
          <ThemeToggle className="navbtn theme-toggle" />
          <LanguagePicker />
        </div>
        <h1>{res._TAGLINE}</h1>
      </div>
    </header>
  );
}

function CardRow({ race, when }: { race: RaceSummary; when: ReactNode }) {
  const { lang } = useDisplay();
  return (
    <li>
      <span className="when">{when}</span>
      <a className="name" href={`?comp=${encodeURIComponent(race.id)}&lang=${lang}`}>
        {race.name}
      </a>
      <span className="organiser">{race.organiser}</span>
      {race.eventorUrl && (
        <a className="eventor" href={race.eventorUrl}>
          Eventor
        </a>
      )}
    </li>
  );
}

function TodaysRaces({ today }: { today: TodayRace[] }) {
  const { res } = useDisplay();
  return (
    <section className="race-section today-races">
      <h2>{res._TODAYSRACES}</h2>
      {today.length > 0 ? (
        <ul className="race-cards today">
          {byStartTime(today).map(({ race, live }) => (
            <CardRow
              key={race.id}
              race={race}
              when={
                live ? (
                  <span className="live">{res._LIVE}</span>
                ) : (
                  `${res._STARTSAT} ${race.startTime}`
                )
              }
            />
          ))}
        </ul>
      ) : (
        <p className="no-races">{res._NORACESTODAY}</p>
      )}
    </section>
  );
}

function DatedCards({ races }: { races: RaceSummary[] }) {
  const { lang } = useDisplay();
  return (
    <ul className="race-cards">
      {races.map((race) => (
        <CardRow key={race.id} race={race} when={formatRaceDate(race.date, lang)} />
      ))}
    </ul>
  );
}

const SHORT_LIST = 8;

function RaceSection({
  title,
  info,
  races,
}: {
  title: string;
  info: string;
  races: RaceSummary[];
}) {
  const { res } = useDisplay();
  const [all, setAll] = useState(false);
  if (races.length == 0) return null;
  const long = races.length > SHORT_LIST + 2;
  return (
    <section className="race-section">
      <h2>{title}</h2>
      <p className="section-info">{info}</p>
      <DatedCards races={long && !all ? races.slice(0, SHORT_LIST) : races} />
      {long && (
        <button type="button" className="show-all" onClick={() => setAll(!all)}>
          {all ? res._SHOWFEWER : `${res._SHOWALL} ${races.length} ${res._RACES}`}
        </button>
      )}
    </section>
  );
}

const PAGE_SIZE = 50;

/** Every race, one year at a time, or the races that match the search in any year. */
function AllRacesSection({ races, date }: { races: RaceSummary[]; date: string }) {
  const { res } = useDisplay();
  const years = useMemo(() => raceYears(races), [races]);
  const [year, setYear] = useState(() =>
    years.includes(date.slice(0, 4)) ? date.slice(0, 4) : (years[0] ?? ''),
  );
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const top = useRef<HTMLElement>(null);
  const turnTo = (p: number) => {
    setPage(p);
    top.current?.scrollIntoView?.({ block: 'start' });
  };
  const searching = query.trim() != '';
  const shown = useMemo(
    () => (searching ? findRaces(races, query) : races.filter((r) => r.date.startsWith(year))),
    [races, query, searching, year],
  );
  const pages = Math.max(1, Math.ceil(shown.length / PAGE_SIZE));
  const current = Math.min(page, pages - 1);

  return (
    <section className="race-section all-races" ref={top}>
      <h2>{res._ALLRACES}</h2>
      <p className="section-info">{res._ALLRACESINFO}</p>
      <input
        type="search"
        className="race-search"
        placeholder={res._SEARCHRACE}
        aria-label={res._SEARCHRACE}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setPage(0);
        }}
      />
      {!searching && (
        <div className="year-chips" role="group" aria-label={res._YEAR}>
          {years.map((y) => (
            <button
              key={y}
              type="button"
              aria-pressed={y == year}
              onClick={() => {
                setYear(y);
                setPage(0);
              }}
            >
              {y}
            </button>
          ))}
        </div>
      )}
      <p className="race-count">
        {shown.length} {res._RACES}
        {searching ? '' : ` ${year}`}
      </p>
      {shown.length > 0 ? (
        <DatedCards races={shown.slice(current * PAGE_SIZE, (current + 1) * PAGE_SIZE)} />
      ) : (
        <p className="no-races">{res._NOMATCH}</p>
      )}
      {pages > 1 && (
        <nav className="pager">
          <button type="button" disabled={current == 0} onClick={() => turnTo(current - 1)}>
            ← {res._PREVIOUS}
          </button>
          <span>
            {res._PAGE} {current + 1} / {pages}
          </span>
          <button type="button" disabled={current == pages - 1} onClick={() => turnTo(current + 1)}>
            {res._NEXT} →
          </button>
        </nav>
      )}
    </section>
  );
}

function NewRaceList({ data }: { data: RaceListData }) {
  const { res } = useDisplay();
  const recent = useMemo(() => recentRaces(data.races, data.date), [data]);
  const upcoming = useMemo(() => upcomingRaces(data.races, data.date), [data]);
  return (
    <>
      <TodaysRaces today={data.today} />
      <RaceSection title={res._RECENTRACES ?? ''} info={res._RECENTINFO ?? ''} races={recent} />
      <RaceSection
        title={res._UPCOMINGRACES ?? ''}
        info={res._UPCOMINGINFO ?? ''}
        races={upcoming}
      />
      <AllRacesSection races={data.races} date={data.date} />
      <Info themeToggle={false} />
    </>
  );
}
