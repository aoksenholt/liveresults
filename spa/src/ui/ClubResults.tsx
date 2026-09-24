import { useEffect, useMemo } from 'react';
import { clubList } from '../domain/lists';
import { clubController } from '../state/controllers';
import { RunnerCount } from './ClassResults';
import { html, Loading, Message } from './common';
import { useDisplay } from './context';
import { ResultsTable } from './ResultsTable';
import { useControllerState } from './hooks';
import type { RaceProps } from './RaceView';
import { namePage } from './pageNames';
import { routeHash } from './route';

export function ClubResults({ clubId, raceId, info, classList }: RaceProps & { clubId: string }) {
  const { api, res, format } = useDisplay();
  const controller = useMemo(
    () =>
      clubController(api, raceId, clubId, classList.classes, {
        timeZone: info.timeZone,
        live: info.live,
      }),
    [api, raceId, clubId, classList.classes, info.timeZone, info.live],
  );
  const { data, error } = useControllerState(controller);
  const list = useMemo(() => data && clubList(data.results, format), [data, format]);
  const clubName = data?.clubName;
  useEffect(() => {
    if (clubName) namePage(routeHash({ kind: 'club', clubId }), clubName);
  }, [clubId, clubName]);

  if (!data || !list) return <Loading error={error} text={res._LOADINGRESULTS ?? ''} />;
  if (list.rows.length == 0) return <Message>{res._NORUNNERS}</Message>;
  return (
    <>
      <h2 className="class-header">
        {data.clubName}
        <RunnerCount results={data.results} />
      </h2>
      <ResultsTable
        head={
          <thead>
            <tr>
              <th className="right">#</th>
              <th>{res._NAME}</th>
              <th>{res._CLASS}</th>
              <th className="right">№</th>
              <th className="right">{res._START}</th>
              <th className="right">{res._CONTROLFINISH}</th>
              <th className="right"></th>
              {list.hasPace && <th className="right">m/km</th>}
            </tr>
          </thead>
        }
      >
        <tbody>
          {list.rows.map((r, i) => (
            <tr key={`${r.row.dbid}:${i}`}>
              <td className="right">{r.row.place}</td>
              <td>{r.name}</td>
              <td>
                <a href={routeHash({ kind: 'class', className: r.row.class })}>{r.row.class}</a>
              </td>
              <td className="right" {...html(r.bib)} />
              <td className="right">{r.start}</td>
              <td className="right" {...html(r.finish)} />
              <td className="right" {...html(r.diff)} />
              {list.hasPace && <td className="right" {...html(r.pace)} />}
            </tr>
          ))}
        </tbody>
      </ResultsTable>
    </>
  );
}
