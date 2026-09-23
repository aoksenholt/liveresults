import type { Entry } from '../api/types';
import { FIXTURES, midRace } from '../test/fixtures';
import { createLegacyViewer } from '../test/legacy';
import { clubShort, formatTime, type TimeLabels } from './format';
import { relayCells, relayTeams, type RelayTeam } from './relay';
import { normalizeClasses, relayResults } from './time4o';

const labels: TimeLabels = {
  status: { 1: 'DNS', 2: 'DNF', 3: 'MP', 4: 'DSQ', 9: '', 10: '' },
  freeStart: 'fristart',
  notShown: 'OK',
};

const text = (html: string) =>
  html.split('<br>').map((line) =>
    line
      .replace(/&numsp;/g, '')
      .replace(/&#10072;/g, '|')
      .replace(/<[^>]+>/g, ''),
  );

function legacyTable(entries: Entry[], className: string) {
  const { raceClass } = FIXTURES.relay!;
  let options: { data: Record<string, string>[] } | undefined;
  const jq = {
    html: () => jq,
    DataTable: (o: typeof options) => (options = o),
  };
  Object.assign(globalThis, { $: () => jq });
  try {
    const viewer = createLegacyViewer({
      Time4oServer: true,
      curRelayView: className,
      activeClasses: normalizeClasses([raceClass]),
      runnerStatus: labels.status,
      resources: { _FREESTART: labels.freeStart },
      calculateScrollY: () => 0,
      updateScrollY: () => {},
    });
    viewer.updateRelayResults({ status: 'OK', data: entries }, false, className);
  } finally {
    delete (globalThis as Record<string, unknown>).$;
  }
  return options!.data;
}

function legacyTeams(entries: Entry[], className: string) {
  return legacyTable(entries, className).map((t) => ({
    names: text(t.names!),
    totTime: text(t.totTime!),
    placeDiff: text(t.placeDiff!),
    totGained: text(t.totGained!),
    legTime: text(t.legTime!),
  }));
}

const time = (t: number, status = 0) => formatTime(t, status, labels, 'no');
const placed = (t: number, status: number, place: unknown) =>
  time(t, status) + (status == 0 ? `|${place}|` : '');

function asText(team: RelayTeam) {
  return {
    names: [clubShort(team.club, 20), ...team.legs.map((l) => l.name)],
    totTime: [
      time(team.total, team.totalStatus),
      ...team.legs.map((l) => placed(l.total, l.totalStatus, l.totalPlace)),
    ],
    placeDiff: [
      '',
      ...team.legs.map((l) =>
        l.leg == 1 ? '' : (Number(l.placeChange) > 0 ? '+' : '') + l.placeChange,
      ),
    ],
    totGained: [
      '',
      ...team.legs.map((l) =>
        l.gained == null ? '' : (l.gained < 0 ? '-' : '+') + time(Math.abs(l.gained)),
      ),
    ],
    legTime: ['', ...team.legs.map((l) => placed(l.legTime, l.legStatus, l.legPlace))],
  };
}

describe('relayTeams', () => {
  const { raceClass, entries } = FIXTURES.relay!;
  const classes = normalizeClasses([raceClass]);
  const className = classes[0]!.className;

  it.each([
    ['finished', entries],
    ['mid race', midRace(entries)],
  ])('matches the legacy relay table (%s)', (_name, live) => {
    const byBib = relayTeams(relayResults(live, className, classes)).sort((a, b) => a.bib - b.bib);
    expect(byBib.map(asText)).toEqual(legacyTeams(live, className));
  });

  it.each([
    ['finished', entries],
    ['mid race', midRace(entries)],
  ])('renders the time columns like the legacy relay table (%s)', (_name, live) => {
    const data = relayResults(live, className, classes);
    const numberOfTeams = data.relayresults[0]!.results.length;
    const ours = relayTeams(data)
      .sort((a, b) => a.bib - b.bib)
      .map((t) => relayCells(t, data.legs, numberOfTeams, { labels, language: 'no' }));
    const legacy = legacyTable(live, className).map(
      ({ placeStr, bib, totTime, totDiff, placeDiff, totGained, legTime, legDiff, kmTime }) => ({
        place: placeStr,
        bib,
        totTime,
        totDiff,
        placeDiff,
        totGained,
        legTime,
        legDiff,
        kmTime,
      }),
    );
    expect(ours).toEqual(legacy);
  });

  it('orders teams by place after the last leg, then by earlier legs', () => {
    const teams = relayTeams(relayResults(entries, className, classes));
    expect(teams.every((t) => t.legs.length == 3)).toBe(true);
    expect(teams.map((t) => `${t.bib}:${t.place}`)).toEqual([
      '107:4',
      '114:5',
      '110:6',
      '139:10',
      '122:19',
      '119:20',
      '113:31',
      '118:-',
      '134:-',
      '147:-',
      '144:-',
      '148:-',
    ]);
  });
});
