import { Fragment, useMemo } from 'react';
import {
  resultList,
  sprintList,
  startList,
  type ResultListSection,
  type StartListSection,
} from '../domain/lists';
import type { ListType } from '../domain/time4o';
import { listController } from '../state/controllers';
import { html, Loading, Message } from './common';
import { useDisplay } from './context';
import { useControllerState } from './hooks';
import type { RaceProps } from './RaceView';

type Props = RaceProps & { type: ListType; sprintKey?: string };

/** The legacy lists over all classes: results, start list, or the heats of one sprint class. */
export function ListResults({ type, sprintKey = '', raceId, info, classList }: Props) {
  const { api, res, format } = useDisplay();
  const controller = useMemo(
    () => listController(api, raceId, type, classList.classes, { timeZone: info.timeZone }),
    [api, raceId, type, classList.classes, info.timeZone],
  );
  const { data, error } = useControllerState(controller);
  const title =
    type == 'startlist' ? res._STARTLIST : type == 'sprint' ? sprintKey : res._ALLCLASSES;

  const content = useMemo(() => {
    if (!data) return null;
    if (type == 'startlist') return <StartList sections={startList(data.groups, format)} />;
    if (type == 'plainresults') return <ResultList sections={resultList(data.groups, format)} />;
    const columns = sprintList(data.groups, sprintKey, format);
    return (
      <table className="lists">
        <tbody>
          <tr>
            {columns.map((sections, i) => (
              <td key={i} style={{ verticalAlign: 'top' }}>
                <ResultList sections={sections} sprint />
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    );
  }, [data, type, sprintKey, format]);

  if (!data) return <Loading error={error} text={res._LOADINGRESULTS ?? ''} />;
  return (
    <>
      <h2 className="class-header">{title}</h2>
      {data.groups.length == 0 ? <Message>{res._NORUNNERS}</Message> : content}
    </>
  );
}

function SectionTitle({ title, span }: { title: string; span: number }) {
  return (
    <tr className="section">
      <td colSpan={span}>
        &nbsp;<span>{title}</span>
      </td>
    </tr>
  );
}

function ResultList({
  sections,
  sprint = false,
}: {
  sections: ResultListSection[];
  sprint?: boolean;
}) {
  const { res } = useDisplay();
  return (
    <table className="lists">
      <tbody>
        {sections.map((s) => (
          <Fragment key={s.className}>
            <SectionTitle title={s.title} span={6} />
            {!sprint && (
              <tr className="head">
                <td className="right">#</td>
                <td>{res._NAME}</td>
                <td>{res._CLUB}</td>
                <td className="right">Tid</td>
                <td className="right">Diff</td>
              </tr>
            )}
            {s.rows.map((r, i) => (
              <tr key={i}>
                <td className={r.qualified ? 'right qualified' : 'right'}>{r.place}</td>
                <td>{r.name}</td>
                {r.club != null && <td>{r.club}</td>}
                <td className="right" {...html(r.time)} />
                {r.diff != null && <td className="right" {...html(r.diff)} />}
              </tr>
            ))}
            <tr className="gap">
              <td colSpan={5}></td>
            </tr>
          </Fragment>
        ))}
      </tbody>
    </table>
  );
}

function StartList({ sections }: { sections: StartListSection[] }) {
  const { res } = useDisplay();
  return (
    <table className="lists">
      <tbody>
        {sections.map((s) => (
          <Fragment key={s.className}>
            <SectionTitle title={s.className} span={5} />
            <tr className="head">
              <td className="right">№</td>
              <td>{res._NAME}</td>
              <td>{res._CLUB}</td>
              <td className="right">{res._START}</td>
              <td className="right">Brikke&nbsp;</td>
            </tr>
            {s.rows.map((r, i) => (
              <tr key={i} className={r.dns ? 'dns' : undefined}>
                <td className="right">{r.bib}</td>
                <td>{r.name}</td>
                <td>{r.club}</td>
                <td className="right">{r.start}</td>
                <td className="right">
                  <span className="small">{r.ecards}</span>&nbsp;
                </td>
              </tr>
            ))}
            <tr className="gap">
              <td colSpan={5}></td>
            </tr>
          </Fragment>
        ))}
      </tbody>
    </table>
  );
}
