import { useMemo } from 'react';
import {
  cellHtml,
  classTable,
  highlights,
  predictedCells,
  runnerClub,
  runnerName,
  type Column,
  type TableOptions,
} from '../domain/classTable';
import { sprintStage } from '../domain/classList';
import type { ClassInfo, ResultRow } from '../domain/model';
import type { ClassView } from '../domain/pipeline';
import type { Predictions } from '../domain/predicted';
import { firstNonQualifier, qualificationLimit } from '../domain/ranking';
import { classResultsController } from '../state/controllers';
import { html, Loading, Message } from './common';
import { useDisplay } from './context';
import { clearFound, scrollToRow, useFound } from './found';
import { useFrozenColumns } from './frozen';
import { useControllerState } from './hooks';
import type { RaceProps } from './RaceView';
import { ResultsTable } from './ResultsTable';
import { namePage } from './pageNames';
import { routeHash } from './route';
import { useNewLook } from './ThemeToggle';

export function ClassResults({
  className,
  raceId,
  info,
  classList,
}: RaceProps & { className: string }) {
  const { res } = useDisplay();
  const cls = classList.classes.find((c) => c.className == className);
  if (!cls) return <Message>{res._NOCLASSCHOSEN}</Message>;
  return (
    <ClassTableView
      cls={cls}
      raceId={raceId}
      timeZone={info.timeZone}
      live={info.live}
      isRelayClass={classList.relayClasses.has(className)}
    />
  );
}

export function RunnerCount({ results }: { results: ResultRow[] }) {
  const { res } = useDisplay();
  if (results.length == 0) return null;
  const finished = results.filter((r) => r.status != 9 && r.status != 10).length;
  return <span title={res._RUNNERCOUNT}>{` (${finished}/${results.length})`}</span>;
}

export function ClubLink({
  row,
  text,
  className,
}: {
  row: ResultRow;
  text: string;
  className: string;
}) {
  const href = routeHash({ kind: 'club', clubId: String(row.clubId) });
  return (
    <a className={className} href={href} onClick={() => namePage(href, row.club || text)}>
      {text}
    </a>
  );
}

function RunnerCell({ column, row }: { column: Column; row: ResultRow }) {
  const { format } = useDisplay();
  const name = <span className="runner-name">{runnerName(row, format.maxNameLength)}</span>;
  const club = runnerClub(row, format.maxClubLength);
  switch (column.layout) {
    case 'club':
      return <ClubLink row={row} text={club} className="club" />;
    case 'nameClub':
      return (
        <>
          {name}
          <br />
          <ClubLink row={row} text={club} className="club" />
        </>
      );
    case 'clubName':
      return (
        <>
          <ClubLink row={row} text={club} className="relayclub" />
          <br />
          {name}
        </>
      );
    default:
      return name;
  }
}

type IndexedColumn = readonly [Column, number];

/**
 * The new look shows the name and club in one column, like the liveresultat beta. The table
 * keeps both columns so the column numbers of the highlights still match.
 */
function stackRunnerColumns(columns: IndexedColumn[]): IndexedColumn[] {
  const runners = columns.filter(([c]) => c.kind == 'runner');
  if (runners.length != 2) return columns;
  const [[first, index], [second]] = runners as [IndexedColumn, IndexedColumn];
  const stacked: Column = {
    ...first,
    layout: first.layout == 'club' ? 'clubName' : 'nameClub',
    title: `${first.title} / ${second.title}`,
  };
  return columns
    .filter(([c]) => c != second)
    .map(([c, i]) => (c == first ? ([stacked, index] as const) : ([c, i] as const)));
}

function ClassTableView(props: {
  cls: ClassInfo;
  raceId: string;
  timeZone: string;
  live: boolean;
  isRelayClass: boolean;
}) {
  const { cls, raceId, timeZone, live, isRelayClass } = props;
  const { api } = useDisplay();
  const controller = useMemo(
    () => classResultsController(api, raceId, cls, { timeZone, live }),
    [api, raceId, cls, timeZone, live],
  );
  const { views, predictions, serverNow, error } = useControllerState(controller);
  return (
    <ClassTable
      cls={cls}
      view={views?.[0] ?? null}
      predictions={predictions[0] ?? null}
      serverNow={serverNow}
      error={error}
      isRelayClass={isRelayClass}
    />
  );
}

export function ClassTable(props: {
  cls: ClassInfo;
  view: ClassView | null;
  predictions: Predictions | null;
  serverNow: number;
  error: string | null;
  isRelayClass: boolean;
  /** Seconds a new result is highlighted. */
  highTime?: number;
}) {
  const { cls, view, predictions, serverNow, error, isRelayClass, highTime } = props;
  const { res, format } = useDisplay();
  const newLook = useNewLook();
  const isFound = useFound(cls.className);
  const [frozen] = useFrozenColumns();
  const options = useMemo<TableOptions>(
    () => ({
      labels: format.labels,
      language: format.language,
      showTenths: format.showTenths,
      titles: {
        name: res._NAME ?? '',
        club: res._CLUB ?? '',
        start: res._START ?? '',
        finish: res._CONTROLFINISH ?? '',
      },
      isRelayClass,
      isSprintHeat: sprintStage(cls.className) > 0,
    }),
    [format, res, isRelayClass, cls.className],
  );
  const table = useMemo(() => view && classTable(view, options), [view, options]);
  const running = useMemo(
    () => (table && predictions ? predictedCells(table, predictions) : null),
    [table, predictions],
  );

  const header = (
    <h2 className="class-header">
      {cls.className}
      {view && <RunnerCount results={view.results} />}
    </h2>
  );
  if (!table)
    return (
      <>
        {header}
        <Loading error={error} text={res._LOADINGRESULTS ?? ''} />
      </>
    );
  const rows = table.view.results;
  if (rows.length == 0)
    return (
      <>
        {header}
        <Message>{res._NORUNNERS}</Message>
      </>
    );

  const positions = predictions?.virtualPositions ?? null;
  const order = rows.map((_, i) => i);
  if (positions) order.sort((a, b) => positions[a]! - positions[b]! || a - b);
  const fnq = firstNonQualifier(rows, qualificationLimit(cls), false, positions);
  const shown = table.columns.map((c, i) => [c, i] as const).filter(([c]) => c.visible);
  const visible = newLook ? stackRunnerColumns(shown) : shown;
  const fixed = (c: Column) =>
    !newLook || !frozen
      ? ''
      : c.kind == 'place'
        ? 'fixed-place'
        : c.kind == 'runner'
          ? 'fixed-name'
          : '';

  const head = (
    <thead>
      <tr>
        {visible.map(([c, i]) => (
          <th
            key={i}
            className={[c.kind == 'runner' ? '' : 'right', fixed(c)].join(' ').trim() || undefined}
          >
            {c.title}
          </th>
        ))}
      </tr>
    </thead>
  );
  const body = (
    <tbody>
      {order.map((i) => {
        const row = rows[i]!;
        const mark = highlights(table, row, i == fnq, serverNow, highTime);
        const found = isFound(row);
        const rowClass = [i == fnq ? 'firstnonqualifier' : '', mark.row ?? '', found ? 'found' : '']
          .join(' ')
          .trim();
        return (
          <tr
            key={`${row.dbid}:${row.bib}:${i}`}
            className={rowClass || undefined}
            ref={found ? scrollToRow : undefined}
            onAnimationEnd={found ? clearFound : undefined}
          >
            {visible.map(([c, col]) => {
              const className = [
                c.kind == 'runner' ? '' : 'right',
                fixed(c),
                mark.cells.get(col) ?? '',
              ]
                .join(' ')
                .trim();
              if (c.kind == 'runner')
                return (
                  <td key={col} className={className || undefined}>
                    <RunnerCell column={c} row={row} />
                  </td>
                );
              const content = running?.[i]?.get(col) ?? cellHtml(table, c, row);
              return <td key={col} className={className || undefined} {...html(content)} />;
            })}
          </tr>
        );
      })}
    </tbody>
  );
  return (
    <>
      {header}
      <ResultsTable head={head}>{body}</ResultsTable>
    </>
  );
}
