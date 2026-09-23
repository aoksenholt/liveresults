import { formatTime, type DisplayFormat } from './format';
import type { RelayResults, SplitValue } from './model';

export interface RelayLeg {
  leg: number;
  name: string;
  legTime: number;
  legStatus: number;
  legBehind: number;
  legPlace: SplitValue;
  total: number;
  totalStatus: number;
  totalBehind: number;
  totalPlace: string;
  /** Places gained (negative) or lost since the previous leg, '' when unknown. */
  placeChange: number | '';
  /** Change in time behind the leader since the previous leg, null on the first leg or without a leg time. */
  gained: number | null;
  pace: number;
}

export interface RelayTeam {
  bib: number;
  club: string;
  place: string;
  total: number;
  totalStatus: number;
  totalBehind: number;
  legs: RelayLeg[];
}

const num = (v: unknown) => Number(v);

/**
 * Teams with one line per leg, ported from the legacy `updateRelayResults`
 * and ordered like its table: by place after the last leg, then the leg before.
 */
export function relayTeams(data: RelayResults): RelayTeam[] {
  const byBib = new Map<number, RelayTeam>();
  const progress = new Map<RelayTeam, { lastPlace: string; lastBehind: number; sort: number[] }>();
  for (let leg = 1; leg <= data.legs; leg++) {
    for (const r of data.relayresults[leg - 1]?.results ?? []) {
      const bib = r.bib;
      let team = byBib.get(bib);
      if (!team) {
        team = {
          bib,
          club: r.club,
          place: '',
          total: r.result,
          totalStatus: r.status,
          totalBehind: 0,
          legs: [],
        };
        byBib.set(bib, team);
        progress.set(team, { lastPlace: r.place, lastBehind: num(r.timeplus), sort: [] });
      }
      const state = progress.get(team)!;
      const first = leg == 1;
      const legTime = first ? r.result : num(r.splits['999']);
      const legBehind = first ? num(r.timeplus) : num(r.splits['999_timeplus']);
      const legPlace = first ? r.place : (r.splits['999_place'] as SplitValue);
      const behind = Math.max(0, num(r.timeplus));
      const placeChange =
        r.status == 0 && num(state.lastPlace) > 0 ? num(r.place) - num(state.lastPlace) : '';
      const gained = !first && r.status == 0 ? behind - state.lastBehind : null;
      state.lastPlace = r.place;
      state.lastBehind = behind;
      team.legs.push({
        leg,
        name: r.name,
        legTime,
        legStatus: r.status,
        legBehind,
        legPlace,
        total: r.result,
        totalStatus: r.status,
        totalBehind: num(r.timeplus),
        totalPlace: r.place,
        placeChange,
        gained,
        pace: r.pace,
      });
      state.sort[leg - 1] =
        r.place == '-'
          ? 999999 + (first ? bib : 0)
          : r.place == ''
            ? 99999 + (first ? bib : 0)
            : num(r.place);
      if (leg == data.legs) {
        team.place = r.place;
        team.total = r.result;
        team.totalStatus = r.status;
        team.totalBehind = num(r.timeplus);
      }
    }
  }
  // DataTables sorts a missing value before any number.
  const sortKey = (team: RelayTeam, leg: number) => progress.get(team)!.sort[leg] ?? -Infinity;
  return [...byBib.values()]
    .sort((a, b) => a.bib - b.bib)
    .sort((a, b) => {
      for (let leg = data.legs - 1; leg >= 0; leg--) {
        const d = sortKey(a, leg) - sortKey(b, leg);
        if (d) return d;
      }
      return 0;
    });
}

export interface RelayCells {
  place: string;
  bib: string;
  totTime: string;
  totDiff: string;
  placeDiff: string;
  totGained: string;
  legTime: string;
  legDiff: string;
  kmTime: string;
}

/** HTML of the time columns of one team, one `<br>`-separated line per leg as the legacy relay table. */
export function relayCells(
  team: RelayTeam,
  legs: number,
  numberOfTeams: number,
  f: Pick<DisplayFormat, 'labels' | 'language' | 'showTenths'>,
): RelayCells {
  const time = (t: number, status = 0, showTenths = !!f.showTenths) =>
    formatTime(t, status, f.labels, f.language, { showTenths });
  const pad = (place: SplitValue) => (numberOfTeams >= 10 && num(place) < 10 ? '&numsp;' : '');
  const timeSpan = (place: SplitValue) => (place == 1 ? '<span class="time1">' : '<span>');
  const c: RelayCells = {
    place: '',
    bib: `<b>${team.bib}</b><br>`,
    totTime: '',
    totDiff: '',
    placeDiff: '<br>',
    totGained: '<br>',
    legTime: '<br>',
    legDiff: '<br>',
    kmTime: '<br>',
  };
  for (const l of team.legs) {
    const br = l.leg == 1 ? '' : '<br>';
    const ok = l.totalStatus == 0;
    const legOk = l.legStatus == 0;
    c.kmTime += br + (l.pace > 0 && legOk ? formatTime(l.pace, 0, f.labels, f.language) : '');
    c.bib += br + l.leg;
    c.totTime +=
      br +
      timeSpan(l.totalPlace) +
      time(l.total, l.totalStatus) +
      '</span>' +
      (l.totalPlace == '1' ? '<span class="place1">' : '<span class="place">') +
      (ok ? `${pad(l.totalPlace)}&numsp;&#10072;${l.totalPlace}&#10072;` : '') +
      '</span>';
    c.totDiff +=
      br + (ok ? `${timeSpan(l.totalPlace)}+${time(Math.max(0, l.totalBehind))}</span>` : '');
    const change = l.placeChange;
    c.placeDiff +=
      br +
      (l.leg == 1
        ? ''
        : (change !== '' && change < 0
            ? '<span class="gained">'
            : change !== '' && change > 0
              ? '<span class="lost">+'
              : '<span>') +
          change +
          '</span>');
    c.totGained +=
      br +
      (l.leg > 1 && legOk && l.gained != null
        ? (l.gained < 0 ? '<span class="gained">-' : '<span class="lost">+') +
          time(Math.abs(l.gained))
        : '');
    c.legTime +=
      br +
      timeSpan(l.legPlace) +
      time(l.legTime, l.legStatus) +
      '</span>' +
      (legOk
        ? pad(l.legPlace) +
          (l.legPlace == 1 ? '<span class="place1">' : '<span class="place">') +
          `&numsp;&#10072;${l.legPlace}&#10072;`
        : '') +
      '</span>';
    c.legDiff +=
      br + (legOk ? `${timeSpan(l.legPlace)}+${time(Math.max(0, l.legBehind))}</span>` : '');
    if (l.leg == legs) {
      c.place = `<b>${l.totalPlace}</b>`;
      c.totTime = `<b>${time(l.total, l.totalStatus)}</b><br>` + c.totTime;
      c.totDiff = `<b>${ok ? '+' + time(Math.max(0, l.totalBehind)) : ''}</b><br>` + c.totDiff;
    }
  }
  return c;
}
