import { useEffect, useMemo } from 'react';
import type { ClassInfo } from '../domain/model';
import { summarize } from '../domain/races';
import { scrollClasses, scrollDelay, scrollOptions, type ScrollOptions } from '../domain/scroll';
import {
  classListController,
  raceController,
  scrollController,
  type RaceInfo,
} from '../state/controllers';
import { ClassTable } from './ClassResults';
import { Loading, Message } from './common';
import { useDisplay } from './context';
import { useControllerState, useWakeLock } from './hooks';

const PAUSE_MS = 5000;

/** Scrolls down one pixel at a time, then pauses and starts over from the top, as followallscroll.php. */
function useAutoScroll(speed: number) {
  useEffect(() => {
    const delay = scrollDelay(speed);
    let timer: ReturnType<typeof setTimeout>;
    const step = () => {
      const bottom = window.scrollY + window.innerHeight >= document.body.offsetHeight;
      if (bottom) {
        timer = setTimeout(() => {
          window.scroll(0, 0);
          timer = setTimeout(step, PAUSE_MS);
        }, PAUSE_MS);
        return;
      }
      window.scroll(0, window.scrollY + 1);
      timer = setTimeout(step, delay);
    };
    timer = setTimeout(step, PAUSE_MS);
    return () => clearTimeout(timer);
  }, [speed]);
}

/** Every class on one page that scrolls by itself, for screens at the arena. */
export function ScrollView({ raceId, search }: { raceId: string; search: string }) {
  const { api, res } = useDisplay();
  const race = useMemo(() => raceController(api, raceId), [api, raceId]);
  const { data: info, error } = useControllerState(race);
  const options = useMemo(() => scrollOptions(new URLSearchParams(search)), [search]);
  useWakeLock();
  useAutoScroll(options.speed);
  if (!info) return <Loading error={error} text={res._LOADINGCLASSES ?? ''} />;
  return <ScrollClasses raceId={raceId} info={info} options={options} />;
}

function ScrollClasses({
  raceId,
  info,
  options,
}: {
  raceId: string;
  info: RaceInfo;
  options: ScrollOptions;
}) {
  const { api, res } = useDisplay();
  const controller = useMemo(
    () => classListController(api, raceId, info.live),
    [api, raceId, info.live],
  );
  const { data, error } = useControllerState(controller);
  const classes = useMemo(() => data && scrollClasses(data.classes, options), [data, options]);
  const name = summarize(info.race).name;

  useEffect(() => {
    document.title = name;
  }, [name]);

  if (!data || !classes) return <Loading error={error} text={res._LOADINGCLASSES ?? ''} />;
  if (classes.length == 0) return <Message>{res._NOCLASSESYET}</Message>;
  return (
    <ScrollResults raceId={raceId} info={info} classes={classes} relayClasses={data.relayClasses} />
  );
}

function ScrollResults({
  raceId,
  info,
  classes,
  relayClasses,
}: {
  raceId: string;
  info: RaceInfo;
  classes: ClassInfo[];
  relayClasses: Set<string>;
}) {
  const { api, res } = useDisplay();
  const controller = useMemo(
    () => scrollController(api, raceId, classes, { timeZone: info.timeZone, live: info.live }),
    [api, raceId, classes, info.timeZone, info.live],
  );
  const { views, predictions, serverNow, error } = useControllerState(controller);
  if (!views) return <Loading error={error} text={res._LOADINGRESULTS ?? ''} />;
  return (
    <div className="scroll">
      {classes.map((cls, i) => (
        <section key={cls.className}>
          <ClassTable
            cls={cls}
            view={views[i] ?? null}
            predictions={predictions[i] ?? null}
            serverNow={serverNow}
            error={error}
            isRelayClass={relayClasses.has(cls.className)}
            highTime={0}
          />
        </section>
      ))}
    </div>
  );
}
