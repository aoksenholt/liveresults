import { Fragment, useMemo } from 'react';
import { clubShort, nameShort } from '../domain/format';
import { relayCells } from '../domain/relay';
import { relayController } from '../state/controllers';
import { html, Loading, Message } from './common';
import { useDisplay } from './context';
import { ResultsTable } from './ResultsTable';
import { useControllerState } from './hooks';
import type { RaceProps } from './RaceView';

const shorten = (s: string, max: number, fn: (s: string, max: number) => string) =>
  s.length > max ? fn(s, max) : s;

/** All legs of a relay, `className` is the first leg. */
export function RelayResults({
  className,
  raceId,
  info,
  classList,
}: RaceProps & { className: string }) {
  const { api, res, format } = useDisplay();
  const controller = useMemo(
    () => relayController(api, raceId, className, classList.classes, { timeZone: info.timeZone }),
    [api, raceId, className, classList.classes, info.timeZone],
  );
  const { data, error } = useControllerState(controller);
  const cells = useMemo(
    () => data?.teams.map((t) => relayCells(t, data.legs, data.numberOfTeams, format)) ?? [],
    [data, format],
  );

  if (!data) return <Loading error={error} text={res._LOADINGRESULTS ?? ''} />;
  if (data.teams.length == 0) return <Message>{res._NORUNNERS}</Message>;
  return (
    <>
      <h2 className="class-header">{data.className}</h2>
      <ResultsTable
        head={
          <thead>
            <tr>
              <th className="right">#</th>
              <th className="right">№</th>
              <th>{res._NAME}</th>
              <th className="right">Total</th>
              <th className="right"></th>
              <th className="right"></th>
              <th className="right">±Tet</th>
              <th className="right">Etappe</th>
              <th className="right"></th>
              <th className="right">m/km</th>
            </tr>
          </thead>
        }
      >
        <tbody>
          {data.teams.map((team, i) => {
            const c = cells[i]!;
            return (
              <tr key={team.bib}>
                <td className="right" {...html(c.place)} />
                <td className="right" {...html(c.bib)} />
                <td>
                  <b>{shorten(team.club, format.maxClubLength, clubShort)}</b>
                  {team.legs.map((leg) => (
                    <Fragment key={leg.leg}>
                      <br />
                      {shorten(leg.name, format.maxNameLength, nameShort)}
                    </Fragment>
                  ))}
                </td>
                <td className="right" {...html(c.totTime)} />
                <td className="right" {...html(c.totDiff)} />
                <td className="right" {...html(c.placeDiff)} />
                <td className="right" {...html(c.totGained)} />
                <td className="right" {...html(c.legTime)} />
                <td className="right" {...html(c.legDiff)} />
                <td className="right" {...html(c.kmTime)} />
              </tr>
            );
          })}
        </tbody>
      </ResultsTable>
    </>
  );
}
