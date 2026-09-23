import { clubShort, formatTime, nameShort, type TimeLabels } from './format';
import type { ResultRow, SplitEntry } from './model';
import type { ClassView } from './pipeline';
import type { Predictions } from './predicted';
import { refSplit, splitRef } from './radio';

export type RunnerLayout = 'name' | 'club' | 'nameClub' | 'clubName';

export type ColumnKind =
  'place' | 'runner' | 'bib' | 'start' | 'split' | 'finish' | 'diff' | 'diff2' | 'hidden';

export interface Column {
  kind: ColumnKind;
  title: string;
  visible: boolean;
  /** Split control code for `split` columns. */
  code?: number;
  layout?: RunnerLayout;
}

export interface TableOptions {
  labels: TimeLabels;
  language: string;
  titles: { name: string; club: string; start: string; finish: string };
  /** Legs of a relay as listed in the class menu, including the first leg without exchange control. */
  isRelayClass: boolean;
  isSprintHeat: boolean;
  showTimesInSprint?: boolean;
  showTenths?: boolean;
}

export interface ClassTable {
  view: ClassView;
  options: TableOptions;
  /** Same order and indices as the legacy DataTable columns, hidden ones included. */
  columns: Column[];
  compactView: boolean;
  fullView: boolean;
  haveSplits: boolean;
  /** Column of the first displayed split. */
  offset: number;
  finishColumn: number;
  numRunners: number;
}

const num = (v: SplitEntry) => Number(v);
const isNumeric = (v: SplitEntry) => !isNaN(parseInt(String(v)));

/** The columns of the legacy class result table for a Time4o race (not multi-day, not fixed). */
export function classTable(view: ClassView, options: TableOptions): ClassTable {
  const { titles, isRelayClass } = options;
  const haveSplits = view.splitcontrols.length > 0;
  const compactView = !(view.isRelay || view.lapTimes);
  const fullView = !compactView;
  const columns: Column[] = [{ kind: 'place', title: '#', visible: true }];
  const runner = (layout: RunnerLayout, title: string) =>
    columns.push({ kind: 'runner', title, visible: true, layout });

  if (isRelayClass) {
    const clubFirst = haveSplits && fullView;
    if (!clubFirst) runner('club', titles.club);
    runner(
      clubFirst ? 'clubName' : 'name',
      clubFirst ? `${titles.club} / ${titles.name}` : titles.name,
    );
  } else {
    const combined = haveSplits && !view.isUnranked && (fullView || view.lapTimes);
    if (!combined) runner('name', titles.name);
    runner(
      combined ? 'nameClub' : 'club',
      combined ? `${titles.name} / ${titles.club}` : titles.club,
    );
  }
  if (view.hasBibs) columns.push({ kind: 'bib', title: '№', visible: true });
  columns.push({ kind: 'start', title: titles.start, visible: true });

  view.splitcontrols.forEach((split, key) => {
    const code = split.code;
    if (code == 0 || code == 999 || ((view.isRelay || view.lapTimes) && code > 100000)) return;
    columns.push({
      kind: 'split',
      title: split.name.length >= 10 ? split.name.replace('Mellomtid', 'M.tid') : split.name,
      visible: view.splitsStatus[refSplit(key, view)]! > 0,
      code,
    });
    columns.push({ kind: 'hidden', title: '', visible: false });
  });

  const finishColumn = columns.length;
  columns.push({ kind: 'finish', title: titles.finish, visible: true });
  columns.push({ kind: 'hidden', title: '', visible: false });
  if (!haveSplits || !fullView || view.lapTimes)
    columns.push({
      kind: 'diff',
      title: 'Diff',
      visible: (!options.isSprintHeat || !!options.showTimesInSprint) && !view.isUnranked,
    });
  else if (view.isRelay && fullView) columns.push({ kind: 'diff2', title: 'Diff', visible: true });
  columns.push({ kind: 'hidden', title: '', visible: false });

  const offset =
    3 + (view.hasBibs ? 1 : 0) + (view.isUnranked || (compactView && !view.lapTimes) ? 1 : 0);
  return {
    view,
    options,
    columns,
    compactView,
    fullView,
    haveSplits,
    offset,
    finishColumn,
    numRunners: view.results.length,
  };
}

export function runnerName(row: ResultRow, maxNameLength: number): string {
  return row.name.length > maxNameLength ? nameShort(row.name, maxNameLength) : row.name;
}

export function runnerClub(row: ResultRow, maxClubLength: number): string {
  return clubShort(row.club, maxClubLength);
}

/** Cell HTML for every column but `runner`, ported from the legacy column renderers. */
export function cellHtml(table: ClassTable, column: Column, row: ResultRow): string {
  const r = renderer(table);
  switch (column.kind) {
    case 'place':
      return String(row.place);
    case 'bib':
      return r.bib(row.bib);
    case 'start':
      return r.start(row);
    case 'split':
      return r.split(row, column.code!);
    case 'finish':
      return r.finish(row);
    case 'diff':
      return r.diff(row);
    case 'diff2':
      return r.diff2(row);
    default:
      return '';
  }
}

function renderer(table: ClassTable) {
  const { view, options, fullView, haveSplits } = table;
  const { labels, language } = options;
  const many = table.numRunners >= 10;
  const time = (t: SplitEntry, status = 0, showTenths = !!options.showTenths) =>
    formatTime(Number(t), status, labels, language, { showTenths });
  const clock = (t: number) =>
    formatTime(t, 0, labels, language, { showHours: true, padZeros: true, clockTime: true });
  const hidePlace = `<span class="hideplace"> ${many ? '&numsp;' : ''}<i>&#10072;..&#10072;</i></span>`;
  const placeTag = (place: SplitEntry, best: boolean, pad: boolean, trail = '') =>
    `<span class="${best ? 'bestplace' : 'place'}"> ${pad ? '&numsp;' : ''}&#10072;${place}&#10072;${trail}</span>`;
  const padPlace = (place: SplitEntry) => many && (num(place) < 10 || place == '-' || place == '=');

  return {
    bib(bib: number) {
      if (bib < 0) return `<span class="bib">${(-bib / 100) | 0}</span>`;
      if (bib > 0) return `<span class="bib">${bib}</span>`;
      return '';
    },

    start(row: ResultRow) {
      if (!row.start) return '';
      const p0 = row.splits['0_place'];
      if (!(num(p0) >= 1)) return clock(row.start);
      const place = placeTag(p0, num(p0) == 1, num(p0) < 10 && many, ' ');
      let txt = '';
      if (fullView)
        txt += `<span${num(p0) == 1 ? ' class="besttime"' : ''}>+${time(Math.max(0, num(row.splits['0_timeplus'])))}${place}</span><br>`;
      return txt + `<span>${fullView ? '' : place}${clock(row.start)}</span>`;
    },

    split(row: ResultRow, code: number) {
      const s = row.splits;
      const value = s[code];
      if (!isNumeric(value)) return String(value ?? '');
      const pl = s[code + '_place'];
      if (!pl) return '';
      const estimate = !!s[code + '_estimate'];
      const place = placeTag(pl, !estimate && num(pl) == 1, padPlace(pl));
      let txt = '';

      if (
        (!fullView || view.isRelay) &&
        num(pl) != 1 &&
        !view.isUnranked &&
        !view.lapTimes &&
        code > 0
      ) {
        txt += `<div class="${estimate ? 'estimate ' : ''}tooltip">+${time(s[code + '_timeplus'])}${place}<span class="tooltiptext">${time(value)}</span></div>`;
      } else {
        const best = num(pl) == 1 && code > 0;
        const cls = estimate ? (best ? 'estimatebest' : 'estimate') : best ? 'besttime' : '';
        txt += `<span${cls ? ` class="${cls}"` : ''}>${time(value)}${code > 0 ? place : ''}</span>`;
      }

      const leg = code + 100000;
      if (((fullView && view.isRelay) || view.lapTimes) && s[leg + '_timeplus'] != undefined) {
        const legPl = s[leg + '_place'];
        const legBest = num(legPl) == 1;
        const cls = s[leg + '_estimate']
          ? legBest
            ? 'estimatebest'
            : 'estimate'
          : legBest
            ? 'besttime'
            : 'legtime';
        const legPlace = placeTag(
          legPl,
          !s[leg + '_estimate'] && legBest,
          many && (num(legPl) < 10 || legPl == '-'),
        );
        txt += `<br><span class="${cls}">${time(s[leg])}${legPlace}</span>`;
      } else if (
        s[code + '_timeplus'] != undefined &&
        fullView &&
        !view.isRelay &&
        code > 0 &&
        num(pl) > 1
      ) {
        txt += `<br><span class="${estimate ? 'estimate' : 'plustime'}">+${time(Math.abs(num(s[code + '_timeplus'])))}</span>${hidePlace}`;
      }
      return txt;
    },

    finish(row: ResultRow) {
      if (!isNumeric(row.result)) return String(row.result);
      let res = '';
      if (row.place == '-' || row.place == '' || row.place == 'F') {
        res += time(row.result, row.status);
      } else {
        const best = haveSplits && num(row.place) == 1;
        res += best ? '<span class="besttime">' : '<span>';
        if (!options.isSprintHeat || options.showTimesInSprint) res += time(row.result, row.status);
        res += placeTag(row.place, best, padPlace(row.place)) + '</span>';
        if (
          haveSplits &&
          fullView &&
          !view.isRelay &&
          !view.lapTimes &&
          row.status == 0 &&
          num(row.place) > 1
        )
          res += `<br><span class="plustime">+${time(row.timeplus, row.status)}</span>${hidePlace}`;
      }
      const legPlace = row.splits['999_place'];
      if (
        haveSplits &&
        ((fullView && view.isRelay) || view.lapTimes) &&
        legPlace != undefined &&
        num(row.splits['999']) > 0
      ) {
        const best = num(legPlace) == 1;
        const place = placeTag(legPlace, best, many && (num(legPlace) < 10 || legPlace == '-'));
        res += `<br><span class="${best ? 'besttime' : 'legtime'}">${time(row.splits['999'])}${place}</span>`;
      }
      return res;
    },

    diff(row: ResultRow) {
      if (!isNumeric(row.timeplus)) return String(row.timeplus);
      if (row.status != 0) return '';
      return `<span class="plustime">+${time(Math.max(0, num(row.timeplus)), row.status)}</span>`;
    },

    diff2(row: ResultRow) {
      const legPlace = row.splits['999_place'];
      if (!isNumeric(row.timeplus) && !isNumeric(legPlace)) return String(row.timeplus);
      let res = '<span>';
      if (row.status == 0 && num(row.place) > 0)
        res += '+' + time(Math.max(0, num(row.timeplus)), row.status);
      res += '</span><br>';
      if (num(legPlace) > 0)
        res += `<span class="legtime">+${time(Math.max(0, num(row.splits['999_timeplus'])), 0)}</span>`;
      return res;
    },
  };
}

/**
 * Cells replaced by running times for runners on course, keyed by column index,
 * ported from the rendering part of the legacy `updatePredictedTimes`.
 */
export function predictedCells(
  table: ClassTable,
  pred: Predictions,
): (Map<number, string> | null)[] {
  const { view, offset, compactView } = table;
  const { labels, language } = table.options;
  const many = table.numRunners >= 10;
  const numSplits = view.numSplits;
  const bibs = view.hasBibs ? 1 : 0;
  const time = (t: number) => formatTime(t, 0, labels, language);
  const noRank = '<i>&#10072;..&#10072;</i></span>';
  const extraSpace = `<span class="hideplace"> ${many ? '&numsp;' : ''}<i>&#10072;..&#10072;</i></span>`;
  const signed = (d: number) => `<i>${d < 0 ? '-' : '+'}${time(Math.abs(d))}</i>`;

  return pred.running.map((run) => {
    if (!run) return null;
    const cells = new Map<number, string>([[0, '<span class="pulsing">◉</span>']]);
    let elapsedStr = `<i>${time(run.elapsed)}</i>`;

    if (view.splitcontrols.length == 0) {
      if (!view.isUnranked) {
        let timeDiffStr: string;
        if (run.timeDiff != null) {
          const rank = run.rank ?? 1;
          elapsedStr +=
            '<span class="place"> ' +
            (many && rank < 10 ? '&numsp;' : '') +
            (rank > 1 ? `<i>&#10072;${rank}&#10072;</i></span>` : noRank);
          timeDiffStr = signed(run.timeDiff);
        } else {
          timeDiffStr = `<span class="place">${noRank}`;
        }
        cells.set(6 + bibs, timeDiffStr);
      }
      cells.set(4 + bibs, elapsedStr);
      return cells;
    }

    const next = run.nextSplit;
    const finish = offset + numSplits * 2;
    if (view.isUnranked) {
      cells.set(offset + next * 2, elapsedStr);
      cells.set(finish, `<span class="place">${noRank}`);
      return cells;
    }

    let timeDiffStr = '';
    let rankStr: string;
    let rank: number;
    if (run.timeDiff == null) {
      rank = 0;
      rankStr = noRank;
      if (next != numSplits && !view.isRelay) timeDiffStr = elapsedStr;
    } else {
      rank = run.rank!;
      rankStr = `<i>&#10072;${rank}&#10072;</i></span>`;
      timeDiffStr = signed(run.timeDiff);
    }
    rankStr = '<span class="place"> ' + (many && rank < 10 ? '&numsp;' : '') + rankStr;

    if (view.isRelay) {
      elapsedStr += extraSpace;
      if (!compactView) {
        timeDiffStr += rankStr;
        if (next == numSplits) {
          elapsedStr = timeDiffStr + '<br>' + elapsedStr;
          timeDiffStr = '';
        } else {
          timeDiffStr = timeDiffStr + '<br>' + elapsedStr;
          elapsedStr = '';
        }
      } else if (next != numSplits) timeDiffStr += rankStr;
    } else if (next == numSplits) {
      elapsedStr += rankStr;
    } else {
      timeDiffStr += rankStr;
      elapsedStr += extraSpace;
    }

    if (compactView || next != numSplits || view.lapTimes)
      cells.set(offset + next * 2 + (next == numSplits ? 2 : 0), timeDiffStr);
    if (!compactView && !view.isRelay && !view.lapTimes && next == numSplits)
      elapsedStr += '<br>' + timeDiffStr + extraSpace;
    cells.set(finish, elapsedStr);
    return cells;
  });
}

export interface Highlight {
  row: 'red_row' | 'new_fnq' | null;
  cells: Map<number, 'red_cell' | 'red_cell_sqr'>;
}

/**
 * Results and splits that changed less than `highTime` seconds ago, as the
 * legacy `updatePredictedTimes` marks them. `nowSeconds` is server-corrected.
 */
export function highlights(
  table: ClassTable,
  row: ResultRow,
  firstNonQualifier: boolean,
  nowSeconds: number,
  highTime = 60,
): Highlight {
  const { view, offset, compactView } = table;
  const numSplits = view.numSplits;
  const recent = (changed: SplitEntry) => num(changed) != 0 && nowSeconds - num(changed) < highTime;
  const result: Highlight = { row: null, cells: new Map() };

  if (numSplits == 0 || (view.isUnranked && numSplits == 1)) {
    if (row.progress == 100 && recent(row.changed))
      result.row = firstNonQualifier ? 'new_fnq' : 'red_row';
    return result;
  }

  const finish = offset + numSplits * 2;
  if (row.progress == 100 && recent(row.changed)) {
    if (compactView || view.isRelay || view.lapTimes) {
      result.cells.set(finish, 'red_cell_sqr');
      result.cells.set(finish + 2, 'red_cell');
    } else result.cells.set(finish, 'red_cell');
  }
  for (let sp = numSplits - 1; sp >= 0; sp--) {
    const code = view.splitcontrols[splitRef(sp, view)]!.code;
    if (recent(row.splits[code + '_changed'])) result.cells.set(offset + 2 * sp, 'red_cell');
  }
  return result;
}
