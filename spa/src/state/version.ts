import { Store } from './store';

export interface VersionState {
  outdated: boolean;
}

type FetchFn = (url: string, init?: RequestInit) => Promise<Response>;

/**
 * Checks the build id the deployed site publishes in `version.json` against the build that
 * is running, so pages left open learn that a new version has been deployed.
 */
export function versionWatcher(
  current: string,
  fetchFn: FetchFn = (url, init) => fetch(url, init),
  url = 'version.json',
) {
  const store = new Store<VersionState>({ outdated: false });
  const check = async () => {
    if (store.get().outdated) return;
    try {
      const resp = await fetchFn(url, { cache: 'no-store' });
      if (!resp.ok) return;
      const { build } = (await resp.json()) as { build?: unknown };
      if (typeof build == 'string' && build != current) store.set({ outdated: true });
    } catch {
      // Offline or in the middle of a deploy; the next check tries again.
    }
  };
  return { store, check };
}
