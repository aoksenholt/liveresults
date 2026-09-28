import { versionWatcher } from './version';

const answer = (body: unknown, status = 200) =>
  vi.fn(() => Promise.resolve(new Response(JSON.stringify(body), { status })));

describe('versionWatcher', () => {
  it('flags the page as outdated when another build is deployed', async () => {
    const fetchFn = answer({ build: 'b' });
    const watcher = versionWatcher('a', fetchFn);
    await watcher.check();
    expect(watcher.store.get().outdated).toBe(true);
    expect(fetchFn).toHaveBeenCalledWith('version.json', { cache: 'no-store' });
    await watcher.check();
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('stays current on the same build, errors and odd answers', async () => {
    for (const fetchFn of [
      answer({ build: 'a' }),
      answer({ build: 'b' }, 404),
      answer({}),
      answer('b'),
      vi.fn(() => Promise.reject(new Error('offline'))),
    ]) {
      const watcher = versionWatcher('a', fetchFn);
      await watcher.check();
      expect(watcher.store.get().outdated).toBe(false);
    }
  });
});
