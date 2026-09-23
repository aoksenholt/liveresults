import { useEffect, useSyncExternalStore } from 'react';
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
