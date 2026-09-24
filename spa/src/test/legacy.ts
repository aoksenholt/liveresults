import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const LEGACY_DIR = resolve(process.cwd(), '../web/js');
const FILES = [
  'liveresults.js',
  'liveresults.common.js',
  'liveresults.time4o.js',
  'liveresults.radio.js',
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type LegacyViewer = any;

// The legacy viewer is the reference implementation: parity tests run it on the same fixtures.
export function createLegacyViewer(
  state: Record<string, unknown> = {},
  window: Record<string, unknown> = {},
): LegacyViewer {
  const src = FILES.map((f) => readFileSync(resolve(LEGACY_DIR, f), 'utf8')).join(
    '\n;window.LiveResults = LiveResults;\n',
  );
  const load = new Function('window', `${src}\n;return LiveResults;`);
  const LiveResults = load(window);
  const viewer = Object.create(LiveResults.AjaxViewer.prototype);
  Object.assign(viewer, {
    restartTimeOffset: 100 * 3600 * 100,
    timeZone: 'Europe/Oslo',
    language: 'no',
    maxNameLength: 30,
    maxClubLength: 20,
    ...state,
  });
  return viewer;
}
