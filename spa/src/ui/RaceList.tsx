import { useEffect, useMemo } from 'react';
import type { RaceSummary } from '../domain/races';
import { raceListController } from '../state/controllers';
import { Info, Loading } from './common';
import { deviceType, useDisplay } from './context';
import { useControllerState } from './hooks';

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
  const controller = useMemo(() => raceListController(api), [api]);
  const { data, error } = useControllerState(controller);

  useEffect(() => {
    document.title = res._TITLE ?? 'LiveRes';
  }, [res]);

  if (!data) return <Loading error={error} text="…" />;
  return (
    <div className="race-page">
      <table className="race-table">
        <tbody>
          <Heading>LIVE TODAY!</Heading>
          <HeaderRow />
          {data.today.map((race) => (
            <RaceRow key={race.id} race={race} className="today" />
          ))}
          <tr>
            <td>&nbsp;</td>
          </tr>
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
        </tbody>
      </table>
      <Info />
    </div>
  );
}
