import { useMemo } from 'react';
import type { ClassInfo } from '../domain/model';
import { passingText, type PassingStrings } from '../domain/passings';
import { lastPassingsController } from '../state/controllers';
import { useDisplay } from './context';
import { useControllerState } from './hooks';
import { routeHash } from './route';

/** The latest updates box at the top of the legacy followfull.php. */
export function LastPassings({
  raceId,
  classes,
  timeZone,
}: {
  raceId: string;
  classes: ClassInfo[];
  timeZone: string;
}) {
  const { api, res, format } = useDisplay();
  const controller = useMemo(
    () => lastPassingsController(api, raceId, classes, { timeZone }),
    [api, raceId, classes, timeZone],
  );
  const { data } = useControllerState(controller);
  const strings: PassingStrings = {
    finished: res._LASTPASSFINISHED ?? '',
    passed: res._LASTPASSPASSED ?? '',
    withTime: res._LASTPASSWITHTIME ?? '',
    withStatus: res._LASTPASSWITHSTATUS ?? '',
    newStatus: res._NEWSTATUS ?? '',
  };

  return (
    <section className="last-passings" aria-live="polite">
      <b>{res._LASTPASSINGS}</b>
      <div className="passings-container">
        {data?.map((p) => {
          const line = passingText(p, format, strings, timeZone);
          return (
            <div key={p.key} className={p.fresh ? 'passing-line fresh' : 'passing-line'}>
              {line.passtime}: {line.name} (
              <a href={routeHash({ kind: 'class', className: line.className })}>{line.className}</a>
              ) {line.text}
            </div>
          );
        })}
      </div>
    </section>
  );
}
