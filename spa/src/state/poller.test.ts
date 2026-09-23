import type { ApiResult } from '../api/client';
import { Poller } from './poller';

const ok = <T>(data: T, etag: string): ApiResult<T> => ({
  status: 'ok',
  data,
  etag,
  serverDate: 1000,
});

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('Poller', () => {
  it('polls at the interval and sends the last ETag', async () => {
    const request = vi
      .fn<(etag: string | null) => Promise<ApiResult<number>>>()
      .mockResolvedValueOnce(ok(1, 'a'))
      .mockResolvedValueOnce({ status: 'notModified', serverDate: null })
      .mockResolvedValueOnce(ok(2, 'b'));
    const onData = vi.fn();
    const poller = new Poller({ request, intervalMs: 15000, onData });

    poller.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(onData).toHaveBeenLastCalledWith(1, 1000);

    await vi.advanceTimersByTimeAsync(15000);
    expect(request).toHaveBeenLastCalledWith('a');
    expect(onData).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(15000);
    expect(request).toHaveBeenLastCalledWith('a');
    expect(onData).toHaveBeenLastCalledWith(2, 1000);
    poller.stop();
  });

  it('reports errors and keeps polling', async () => {
    const request = vi
      .fn<(etag: string | null) => Promise<ApiResult<number>>>()
      .mockResolvedValueOnce({ status: 'error', message: 'HTTP 500' })
      .mockResolvedValueOnce(ok(1, 'a'));
    const onData = vi.fn();
    const onError = vi.fn();
    const poller = new Poller({ request, intervalMs: 1000, onData, onError });

    poller.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(onError).toHaveBeenCalledWith('HTTP 500');
    await vi.advanceTimersByTimeAsync(1000);
    expect(onData).toHaveBeenCalledWith(1, 1000);
    poller.stop();
  });

  it('drops a response that arrives after stop', async () => {
    let resolve: (r: ApiResult<number>) => void = () => {};
    const request = vi.fn(() => new Promise<ApiResult<number>>((r) => (resolve = r)));
    const onData = vi.fn();
    const poller = new Poller({ request, intervalMs: 1000, onData });

    poller.start();
    poller.stop();
    resolve(ok(1, 'a'));
    await vi.advanceTimersByTimeAsync(5000);
    expect(onData).not.toHaveBeenCalled();
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('refresh polls immediately and ignores the superseded response', async () => {
    const resolvers: ((r: ApiResult<number>) => void)[] = [];
    const request = vi.fn(() => new Promise<ApiResult<number>>((r) => resolvers.push(r)));
    const onData = vi.fn();
    const poller = new Poller({ request, intervalMs: 1000, onData });

    poller.start();
    poller.refresh();
    resolvers[0]!(ok(1, 'old'));
    resolvers[1]!(ok(2, 'new'));
    await vi.advanceTimersByTimeAsync(0);
    expect(onData).toHaveBeenCalledTimes(1);
    expect(onData).toHaveBeenCalledWith(2, 1000);
    poller.stop();
  });

  it('fetches once without an interval', async () => {
    const request = vi.fn(async () => ok(1, 'a'));
    const onData = vi.fn();
    const poller = new Poller({ request, intervalMs: 0, onData });

    poller.start();
    await vi.advanceTimersByTimeAsync(60000);
    expect(request).toHaveBeenCalledTimes(1);
    expect(onData).toHaveBeenCalledWith(1, 1000);

    poller.refresh();
    await vi.advanceTimersByTimeAsync(0);
    expect(request).toHaveBeenCalledTimes(2);
    poller.stop();
  });
});
