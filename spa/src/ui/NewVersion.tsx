import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { versionWatcher } from '../state/version';
import { useDisplay } from './context';

const CHECK_EVERY = 5 * 60 * 1000;
const BUILD: unknown = import.meta.env.VITE_BUILD_ID;
const noSubscription = () => () => {};

/**
 * Reloads the page when a new version has been deployed, at once if nobody is looking at it
 * (hidden tab or `reloadAtOnce`, e.g. the scrolling page on a big screen), and otherwise asks
 * with a banner, so the page does not jump while it is being read.
 */
export function NewVersion({ reloadAtOnce }: { reloadAtOnce: boolean }) {
  const { res } = useDisplay();
  const watcher = useMemo(
    () => (import.meta.env.PROD && typeof BUILD == 'string' ? versionWatcher(BUILD) : null),
    [],
  );
  const outdated = useSyncExternalStore(
    watcher?.store.subscribe ?? noSubscription,
    () => watcher?.store.get().outdated ?? false,
  );

  useEffect(() => {
    if (!watcher) return;
    const timer = setInterval(() => void watcher.check(), CHECK_EVERY);
    const onVisibility = () => {
      if (!document.hidden) void watcher.check();
      else if (watcher.store.get().outdated) window.location.reload();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [watcher]);

  useEffect(() => {
    if (outdated && (reloadAtOnce || document.hidden)) window.location.reload();
  }, [outdated, reloadAtOnce]);

  if (!outdated) return null;
  return (
    <div className="new-version" role="status">
      {res._NEWVERSION}
      <button onClick={() => window.location.reload()}>{res._RELOAD}</button>
    </div>
  );
}
