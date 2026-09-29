import { useEffect, useSyncExternalStore, type RefObject } from 'react';
import type { Controller } from '../state/controllers';
import { parseHash, type Route } from './route';

/** Runs a controller while the component is mounted; create it with `useMemo`. */
export function useControllerState<S>(controller: Controller<S>): S {
  useEffect(() => {
    controller.start();
    return () => controller.stop();
  }, [controller]);
  return useSyncExternalStore(controller.store.subscribe, controller.store.get);
}

const subscribeHash = (listener: () => void) => {
  window.addEventListener('hashchange', listener);
  return () => window.removeEventListener('hashchange', listener);
};
const getHash = () => window.location.hash;

export function useHashRoute(): Route {
  const hash = useSyncExternalStore(subscribeHash, getHash);
  return parseHash(hash);
}

/** Keeps the screen on at the start and finish, taken on a click as browsers require. */
export function useWakeLock() {
  useEffect(() => {
    if (!('wakeLock' in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    const request = () => {
      if (lock && !lock.released) return;
      navigator.wakeLock
        .request('screen')
        .then((l) => (lock = l))
        .catch(() => {});
    };
    document.addEventListener('click', request);
    return () => {
      document.removeEventListener('click', request);
      void lock?.release();
    };
  }, []);
}

/** Closes a menu on Escape or a click outside `root`. */
export function useDismiss(open: boolean, close: () => void, root: RefObject<HTMLElement | null>) {
  useEffect(() => {
    if (!open) return;
    const dismiss = (e: Event) => {
      if (
        e instanceof KeyboardEvent ? e.key == 'Escape' : !root.current?.contains(e.target as Node)
      )
        close();
    };
    document.addEventListener('pointerdown', dismiss);
    document.addEventListener('keydown', dismiss);
    return () => {
      document.removeEventListener('pointerdown', dismiss);
      document.removeEventListener('keydown', dismiss);
    };
  }, [open, close, root]);
}
