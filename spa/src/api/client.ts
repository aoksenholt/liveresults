import type { Entry, Envelope, Race, RaceClass } from './types';

export const TIME4O_BASE_URL = 'https://center.time4o.com/api/v1/';

export type ApiResult<T> =
  | { status: 'ok'; data: T; etag: string | null; serverDate: number | null }
  | { status: 'notModified'; serverDate: number | null }
  | { status: 'error'; message: string };

export type FetchFn = (url: string, init?: RequestInit) => Promise<Response>;

export interface EntryFilter {
  raceClassId?: string;
  organisationId?: number | string;
}

export class Time4oApi {
  constructor(
    private readonly baseUrl: string = TIME4O_BASE_URL,
    private readonly fetchFn: FetchFn = (url, init) => fetch(url, init),
  ) {}

  getRaces(etag?: string | null): Promise<ApiResult<Race[]>> {
    return this.request('race', etag);
  }

  getRace(raceId: string, etag?: string | null): Promise<ApiResult<Race>> {
    return this.request(`race/${encodeURIComponent(raceId)}`, etag);
  }

  getClasses(raceId: string, etag?: string | null): Promise<ApiResult<RaceClass[]>> {
    return this.request(`race/${encodeURIComponent(raceId)}/raceClass`, etag);
  }

  /** Relay legs are addressed as `<classId>.<leg>`, or `<classId>.all` for every leg. */
  getEntries(
    raceId: string,
    filter: EntryFilter = {},
    etag?: string | null,
  ): Promise<ApiResult<Entry[]>> {
    const qs = new URLSearchParams();
    if (filter.raceClassId) qs.set('raceClassId', filter.raceClassId);
    if (filter.organisationId != null) qs.set('organisationId', String(filter.organisationId));
    const query = qs.size ? `?${qs.toString()}` : '';
    return this.request(`race/${encodeURIComponent(raceId)}/entry${query}`, etag);
  }

  private async request<T>(path: string, etag?: string | null): Promise<ApiResult<T>> {
    // Time4o only answers 304 when the ETag is sent without the surrounding quotes.
    const headers: Record<string, string> = etag ? { 'If-None-Match': etag } : {};
    let resp: Response;
    try {
      resp = await this.fetchFn(this.baseUrl + path, { headers });
    } catch (e) {
      return { status: 'error', message: e instanceof Error ? e.message : 'Request failed' };
    }
    const serverDate = parseDate(resp.headers.get('date'));
    if (resp.status === 304) return { status: 'notModified', serverDate };
    if (!resp.ok) return { status: 'error', message: `HTTP ${resp.status}` };
    try {
      const body = (await resp.json()) as Envelope<T>;
      return { status: 'ok', data: body.data, etag: unquote(resp.headers.get('etag')), serverDate };
    } catch (e) {
      return { status: 'error', message: e instanceof Error ? e.message : 'Invalid JSON' };
    }
  }
}

function unquote(etag: string | null): string | null {
  if (!etag) return null;
  return etag.replace(/^W\//, '').replace(/^"(.*)"$/, '$1');
}

function parseDate(value: string | null): number | null {
  if (!value) return null;
  const t = Date.parse(value);
  return Number.isNaN(t) ? null : t;
}
