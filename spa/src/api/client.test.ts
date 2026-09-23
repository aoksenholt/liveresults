import { Time4oApi, type FetchFn } from './client';

function mockFetch(status: number, body: unknown, headers: Record<string, string> = {}) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const fn: FetchFn = async (url, init) => {
    calls.push({ url, init });
    return new Response(status === 304 ? null : JSON.stringify(body), { status, headers });
  };
  return { fn, calls };
}

describe('Time4oApi', () => {
  it('unwraps the data envelope and strips quotes from the ETag', async () => {
    const { fn } = mockFetch(
      200,
      { data: [{ id: 'r1', date: '2026-09-20' }] },
      {
        etag: '"abc123"',
        date: 'Sun, 20 Sep 2026 10:00:00 GMT',
      },
    );
    const res = await new Time4oApi('https://t4o/', fn).getRaces();
    expect(res).toEqual({
      status: 'ok',
      data: [{ id: 'r1', date: '2026-09-20' }],
      etag: 'abc123',
      serverDate: Date.parse('Sun, 20 Sep 2026 10:00:00 GMT'),
    });
  });

  it('sends the unquoted ETag as If-None-Match and reports 304 as notModified', async () => {
    const { fn, calls } = mockFetch(304, null);
    const res = await new Time4oApi('https://t4o/', fn).getClasses('r1', 'abc123');
    expect(res.status).toBe('notModified');
    expect(calls[0]!.url).toBe('https://t4o/race/r1/raceClass');
    expect(calls[0]!.init?.headers).toEqual({ 'If-None-Match': 'abc123' });
  });

  it('builds entry filters for class, relay leg and club', async () => {
    const { fn, calls } = mockFetch(200, { data: [] });
    const api = new Time4oApi('https://t4o/', fn);
    await api.getEntries('r1');
    await api.getEntries('r1', { raceClassId: 'c1.all' });
    await api.getEntries('r1', { organisationId: 42 });
    expect(calls.map((c) => c.url)).toEqual([
      'https://t4o/race/r1/entry',
      'https://t4o/race/r1/entry?raceClassId=c1.all',
      'https://t4o/race/r1/entry?organisationId=42',
    ]);
  });

  it('returns an error result for HTTP errors and network failures', async () => {
    const { fn } = mockFetch(500, {});
    expect(await new Time4oApi('https://t4o/', fn).getRace('r1')).toEqual({
      status: 'error',
      message: 'HTTP 500',
    });
    const failing: FetchFn = async () => {
      throw new Error('offline');
    };
    expect(await new Time4oApi('https://t4o/', failing).getRace('r1')).toEqual({
      status: 'error',
      message: 'offline',
    });
  });
});
