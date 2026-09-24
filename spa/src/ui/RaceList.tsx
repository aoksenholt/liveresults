import { useEffect, useMemo } from 'react';
import {
  byStartTime,
  type RaceList as RaceListData,
  type RaceSummary,
  type TodayRace,
} from '../domain/races';
import { LANGUAGE_NAMES, LANGUAGES } from '../i18n';
import { raceListController } from '../state/controllers';
import { Info, Loading } from './common';
import { deviceType, useDisplay } from './context';
import { useControllerState } from './hooks';
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

function Logo() {
  return (
    <svg className="logo" width="36" height="36" viewBox="0 0 36 36" aria-hidden="true">
      <rect width="36" height="36" rx="3" fill="#fff" />
      <path d="M36 0V33a3 3 0 0 1-3 3H0Z" fill="var(--orange)" />
    </svg>
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
            {res._TITLE}
          </span>
          <ThemeToggle className="navbtn theme-toggle" />
          <LanguagePicker />
        </div>
        <h1>{res._TAGLINE}</h1>
      </div>
    </header>
  );
}

function TodayRow({ today: { race, live } }: { today: TodayRace }) {
  const { lang, res } = useDisplay();
  return (
    <li>
      <span className="when">
        {live ? <span className="live">{res._LIVE}</span> : `${res._STARTSAT} ${race.startTime}`}
      </span>
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

function NewRaceList({ data }: { data: RaceListData }) {
  const { res } = useDisplay();
  return (
    <>
      <section className="today-races">
        <h2>{res._TODAYSRACES}</h2>
        {data.today.length > 0 ? (
          <ul className="race-cards">
            {byStartTime(data.today).map((t) => (
              <TodayRow key={t.race.id} today={t} />
            ))}
          </ul>
        ) : (
          <p className="no-races">{res._NORACESTODAY}</p>
        )}
      </section>
      <table className="race-table">
        <tbody>
          <AllRaces data={data} />
        </tbody>
      </table>
      <Info themeToggle={false} />
    </>
  );
}
