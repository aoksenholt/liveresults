import { useMemo } from 'react';
import type { ClassInfo } from '../domain/model';
import { passingText, type PassingStrings } from '../domain/passings';
import { lastPassingsController } from '../state/controllers';
import { useDisplay } from './context';
import { useControllerState } from './hooks';
import { routeHash } from './route';
import { storedFlag } from './stored';
import { useNewLook } from './ThemeToggle';

// Closed by default on phones, where the box pushes the results far down.
const useCollapsed = storedFlag(
  'liveres-passings-collapsed',
  () => window.matchMedia?.('(max-width: 600px)').matches ?? false,
);

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

  const newLook = useNewLook();
  const [collapsed, toggle] = useCollapsed();
  const lines = (data ?? []).map((p) => ({ ...passingText(p, format, strings, timeZone), p }));
  const list = (
    <div className="passings-container">
      {lines.map(({ p, ...line }) => (
        <div key={p.key} className={p.fresh ? 'passing-line fresh' : 'passing-line'}>
          {line.passtime}: {line.name} (
          <a href={routeHash({ kind: 'class', className: line.className })}>{line.className}</a>){' '}
          {line.text}
        </div>
      ))}
    </div>
  );

  if (!newLook)
    return (
      <section className="last-passings" aria-live="polite">
        <b>{res._LASTPASSINGS}</b>
        {list}
      </section>
    );
  const latest = lines[0];
  if (!latest) return null;
  return (
    <section className={collapsed ? 'last-passings collapsed' : 'last-passings'} aria-live="polite">
      <button type="button" className="passings-toggle" aria-expanded={!collapsed} onClick={toggle}>
        <b>{res._LASTPASSINGS}</b>
        {collapsed && (
          <span className="passing-summary">
            {latest.passtime}: {latest.name} ({latest.className}) {latest.text}
          </span>
        )}
        <span className="chevron" aria-hidden="true" />
      </button>
      {!collapsed && list}
    </section>
  );
}
