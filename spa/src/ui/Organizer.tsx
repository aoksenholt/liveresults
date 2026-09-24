import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { strPad } from '../domain/format';
import type { ClassInfo } from '../domain/model';
import {
  matchesSearch,
  organizerRow,
  timeToStartText,
  type OrganizerRow,
  type StartWindow,
} from '../domain/organizer';
import { eventClock } from '../domain/predicted';
import { summarize } from '../domain/races';
import {
  classListController,
  leftInForestController,
  raceController,
  startRegistrationController,
  type RaceInfo,
} from '../state/controllers';
import { Info, Loading, Message } from './common';
import { useDisplay } from './context';
import { useControllerState, useWakeLock } from './hooks';
import { routeHash } from './route';

export const LEFT_IN_FOREST = '-2';
export const START_REGISTRATION = '0';

interface OrganizerProps {
  raceId: string;
  info: RaceInfo;
  classes: ClassInfo[];
  params: URLSearchParams;
}

/** The Time4o views of the legacy radio.php, chosen by its `code` parameter. */
export function OrganizerView({
  raceId,
  code,
  params,
}: {
  raceId: string;
  code: string;
  params: URLSearchParams;
}) {
  const { api, res } = useDisplay();
  const race = useMemo(() => raceController(api, raceId), [api, raceId]);
  const { data: info, error } = useControllerState(race);
  if (!info) return <Loading error={error} text={res._LOADINGCLASSES ?? ''} />;
  return <OrganizerClasses raceId={raceId} info={info} code={code} params={params} />;
}

function OrganizerClasses({ code, ...props }: Omit<OrganizerProps, 'classes'> & { code: string }) {
  const { api, res } = useDisplay();
  const controller = useMemo(
    () => classListController(api, props.raceId, props.info.live),
    [api, props.raceId, props.info.live],
  );
  const { data, error } = useControllerState(controller);
  const name = summarize(props.info.race).name;
  const title = code == START_REGISTRATION ? res._STARTREGISTRATION : res._LEFTINFOREST;

  useEffect(() => {
    document.title = `${title} – ${name}`;
  }, [title, name]);

  useWakeLock();

  return (
    <div className="organizer">
      {!data ? (
        <Loading error={error} text={res._LOADINGCLASSES ?? ''} />
      ) : code == START_REGISTRATION ? (
        <StartRegistration classes={data.classes} {...props} />
      ) : (
        <LeftInForest classes={data.classes} {...props} />
      )}
      <Info />
    </div>
  );
}

const clockText = (seconds: number) => {
  const s = ((seconds % 86400) + 86400) % 86400;
  return [s / 3600, (s / 60) % 60, s % 60].map((n) => strPad(Math.floor(n), 2)).join(':');
};

const eventTime = (timeZone: string) => eventClock(Date.now(), 0, timeZone) / 100;

function useEventTime(timeZone: string): number {
  const [time, setTime] = useState(() => eventTime(timeZone));
  useEffect(() => {
    const timer = setInterval(() => setTime(eventTime(timeZone)), 1000);
    return () => clearInterval(timer);
  }, [timeZone]);
  return time;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label>
      <span>{label}</span> {children}
    </label>
  );
}

function FilterField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { res } = useDisplay();
  return (
    <Field label={res._FILTER ?? ''}>
      <input
        type="text"
        value={value}
        placeholder="filter..."
        onChange={(e) => onChange(e.target.value)}
      />
    </Field>
  );
}

function ClassLink({ raceId, className }: { raceId: string; className: string }) {
  const { lang } = useDisplay();
  const href = `?comp=${encodeURIComponent(raceId)}&lang=${lang}${routeHash({ kind: 'class', className })}`;
  return (
    <a href={href} target="_blank" rel="noreferrer">
      {className}
    </a>
  );
}

const Bib = ({ bib }: { bib: string }) => (bib ? <span className="bib">{bib}</span> : null);

const Ecard = ({ row }: { row: OrganizerRow }) => (
  <>
    {row.checked ? '✅' : '⬜'} {row.ecards}
  </>
);

function LeftInForest({ raceId, info, classes }: OrganizerProps) {
  const { api, res, format } = useDisplay();
  const controller = useMemo(
    () => leftInForestController(api, raceId, classes, info),
    [api, raceId, classes, info],
  );
  const { data, error } = useControllerState(controller);
  const [filter, setFilter] = useState('');
  const time = useEventTime(info.timeZone);
  const rows = useMemo(() => data?.map((r) => organizerRow(r, format)) ?? [], [data, format]);

  return (
    <>
      <div className="organizer-head">
        <b>{res._LEFTINFOREST}</b>
        <span />
        <FilterField value={filter} onChange={setFilter} />
        <Field label={res._NOW ?? ''}>
          <span className="clock">{clockText(time)}</span>
        </Field>
      </div>
      {!data ? (
        <Loading error={error} text={res._LOADINGRESULTS ?? ''} />
      ) : rows.length == 0 ? (
        <Message>{res._NORUNNERS}</Message>
      ) : (
        <>
          <table className="results">
            <thead>
              <tr>
                <th className="right">№</th>
                <th>{res._NAME}</th>
                <th>{res._CLUB}</th>
                <th>{res._CLASS}</th>
                <th>{res._STARTTIME}</th>
                <th>{res._ECARD}</th>
              </tr>
            </thead>
            <tbody>
              {rows
                .filter((r) => matchesSearch(r.searchText, filter))
                .map((r) => (
                  <tr key={r.dbid}>
                    <td className="right">
                      <Bib bib={r.bib} />
                    </td>
                    <td>{r.name}</td>
                    <td>{r.club}</td>
                    <td>
                      <ClassLink raceId={raceId} className={r.className} />
                    </td>
                    <td>{r.start}</td>
                    <td>
                      <Ecard row={r} />
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
          <p>
            {res._COUNT}: {rows.length}
          </p>
        </>
      )}
    </>
  );
}

const DEFAULT_WINDOW = { preTime: '1', callTime: '3', postTime: '5', minBib: '', maxBib: '' };
type WindowInputs = typeof DEFAULT_WINDOW;

function windowInputs(params: URLSearchParams): WindowInputs {
  const get = (name: string, fallback: string) => {
    const v = params.get(name);
    return v == null || v == 'null' ? fallback : v;
  };
  return {
    preTime: get('pretime', DEFAULT_WINDOW.preTime),
    callTime: get('calltime', DEFAULT_WINDOW.callTime),
    postTime: get('posttime', DEFAULT_WINDOW.postTime),
    minBib: get('minbib', ''),
    maxBib: get('maxbib', ''),
  };
}

function startWindow(inputs: WindowInputs, openStart: boolean): StartWindow {
  const int = (v: string) => {
    const n = Number.parseInt(v);
    return Number.isNaN(n) ? null : n;
  };
  return {
    preTime: int(inputs.preTime) ?? 0,
    callTime: int(inputs.callTime) ?? 0,
    postTime: int(inputs.postTime) ?? 0,
    minBib: int(inputs.minBib),
    maxBib: int(inputs.maxBib),
    openStart,
  };
}

/** The legacy URL of the start view, used to switch between timed and free start. */
function startUrl(raceId: string, lang: string, inputs: WindowInputs, openStart: boolean) {
  const q = new URLSearchParams({
    comp: raceId,
    code: START_REGISTRATION,
    lang,
    calltime: inputs.callTime,
    posttime: inputs.postTime,
    pretime: inputs.preTime,
  });
  if (inputs.minBib) q.set('minbib', inputs.minBib);
  if (inputs.maxBib) q.set('maxbib', inputs.maxBib);
  return '?' + q.toString() + (openStart ? '&openstart' : '');
}

function useStartBeep() {
  const audio = useRef<AudioContext | null>(null);
  const soundRef = useRef(false);
  const [sound, setSound] = useState(false);

  const toggle = () => {
    // Browsers only allow audio that is started from a user gesture.
    audio.current ??= new AudioContext();
    void audio.current.resume();
    soundRef.current = !soundRef.current;
    setSound(soundRef.current);
  };

  const beep = useCallback((long: boolean) => {
    const ctx = audio.current;
    if (!ctx || !soundRef.current) return;
    const oscillator = ctx.createOscillator();
    oscillator.type = 'sine';
    oscillator.frequency.value = long ? 1100 : 900;
    oscillator.connect(ctx.destination);
    oscillator.start(0);
    oscillator.stop(ctx.currentTime + (long ? 1 : 0.2));
  }, []);

  return { sound, toggle, beep };
}

function StartRegistration({ raceId, info, classes, params }: OrganizerProps) {
  const { api, res, format, lang } = useDisplay();
  const openStart = params.has('openstart');
  const [inputs, setInputs] = useState(() => windowInputs(params));
  const [filter, setFilter] = useState('');
  const { sound, toggle, beep } = useStartBeep();
  const win = useMemo(() => startWindow(inputs, openStart), [inputs, openStart]);
  const [initialWin] = useState(win);

  const controller = useMemo(
    () =>
      startRegistrationController(api, raceId, classes, {
        timeZone: info.timeZone,
        window: initialWin,
        onBeep: beep,
      }),
    [api, raceId, classes, info.timeZone, initialWin, beep],
  );
  useEffect(() => controller.setWindow(win), [controller, win]);
  const state = useControllerState(controller);
  const rows = useMemo(
    () => state.rows?.map((r) => organizerRow(r, format)) ?? [],
    [state.rows, format],
  );

  const input = (name: keyof WindowInputs, className?: string) => (
    <input
      type="text"
      className={className}
      value={inputs[name]}
      onChange={(e) => setInputs((i) => ({ ...i, [name]: e.target.value }))}
    />
  );

  return (
    <>
      <div className="organizer-head">
        <b>{res._STARTREGISTRATION}</b>
        <Field label={res._BEFORE ?? ''}>{input('preTime', 'gray')}</Field>
        <FilterField value={filter} onChange={setFilter} />
        <Field label={res._NOW ?? ''}>
          <button onClick={toggle} title={res._SOUND} aria-pressed={sound}>
            {sound ? '🔈' : '🔇'}
          </button>{' '}
          <span className="clock">{clockText(state.time)}</span>
        </Field>

        <span>
          {res._STARTTYPE}: {openStart ? res._OPENSTART : res._TIMEDSTART}
        </span>
        <Field label={res._CALL ?? ''}>{input('callTime', 'yellow')}</Field>
        <Field label={res._MINBIB ?? ''}>{input('minBib')}</Field>
        <Field label={res._CALL ?? ''}>
          <span className="clock call-clock">{clockText(state.time + win.callTime * 60)}</span>
        </Field>

        <a href={startUrl(raceId, lang, inputs, !openStart)}>⇄ {res._SWITCHSTARTTYPE}</a>
        <Field label={res._AFTER ?? ''}>{input('postTime', 'gray')}</Field>
        <Field label={res._MAXBIB ?? ''}>{input('maxBib')}</Field>
      </div>
      {!state.rows ? (
        <Loading error={state.error} text={res._LOADINGRESULTS ?? ''} />
      ) : (
        <table className="results">
          <thead>
            <tr>
              <th className="right">№</th>
              <th>{res._NAME}</th>
              <th>{res._CLUB}</th>
              <th>{res._CLASS}</th>
              <th>{res._ECARD}</th>
              <th className="right">{res._STARTTIME}</th>
              {!openStart && <th className="right">Diff</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const mark = state.marks[i];
              if (!mark?.show || !matchesSearch(r.searchText, filter)) return null;
              return (
                <tr key={r.dbid} className={mark.classes.join(' ') || undefined}>
                  <td className="right">
                    <Bib bib={r.bib} />
                  </td>
                  <td>{r.name}</td>
                  <td>{r.club}</td>
                  <td>
                    <ClassLink raceId={raceId} className={r.className} />
                  </td>
                  <td>
                    <Ecard row={r} />
                  </td>
                  <td className="right">{r.start}</td>
                  {!openStart && (
                    <td className={mark.timeToStart < 0 ? 'right' : 'right late'}>
                      {timeToStartText(mark.timeToStart, format)}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </>
  );
}
