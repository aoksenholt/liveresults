import type { ApiResult } from '../api/client';

export interface PollerOptions<T> {
  request: (etag: string | null) => Promise<ApiResult<T>>;
  /** 0 or less fetches once, for views that are not live. */
  intervalMs: number;
  onData: (data: T, serverDate: number | null) => void;
  onError?: (message: string) => void;
}

export class Poller<T> {
  private etag: string | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private running = false;
  private generation = 0;

  constructor(private readonly opts: PollerOptions<T>) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    void this.poll();
  }

  stop(): void {
    this.running = false;
    this.generation++;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  refresh(): void {
    if (!this.running) return;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    void this.poll();
  }

  private async poll(): Promise<void> {
    // A stop() or refresh() while a request is in flight must not deliver stale data.
    const generation = ++this.generation;
    const result = await this.opts.request(this.etag);
    if (generation !== this.generation || !this.running) return;

    if (result.status === 'ok') {
      this.etag = result.etag;
      this.opts.onData(result.data, result.serverDate);
    } else if (result.status === 'error') {
      this.opts.onError?.(result.message);
    }
    if (this.opts.intervalMs > 0)
      this.timer = setTimeout(() => void this.poll(), this.opts.intervalMs);
  }
}
