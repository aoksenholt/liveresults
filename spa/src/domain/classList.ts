import { classShort } from './format';
import type { ClassInfo } from './model';
import { sortClasses } from './sorting';

export type ClassListItem =
  | { kind: 'relay'; title: string; className: string }
  | { kind: 'sprint'; title: string; plainKey: string }
  | { kind: 'leg'; label: string; className: string }
  | { kind: 'heat'; label: string; className: string }
  | { kind: 'class'; label: string; className: string }
  | { kind: 'indent' }
  | { kind: 'break' }
  | { kind: 'rule' };

const sprintRe = /\b(KV|SE)\s*\d+|Finale|NM KO Tot(al|alt)/;
const sprintCleanRe = /[\s-]+|(KV|SE)\s*\d+|Finale$|NM KO Tot(al|alt)$/g;
const sprintTitleRe = /(KV|SE)\s*\d+|Finale$|NM KO Tot(al|alt)$/g;
const sprintPrRe = /\bPR\s*\d+$/;
const sprintKvRe = /\bKV\s*\d+$/;
const sprintSeRe = /\bSE\s*\d+$/;
const sprintFiRe = /\bFinale$/;
const legSuffixRe = /-[0-9]{1,2}$/;
const eliteRe = /(-e| e|\d+e|elite|wre|nm)(\s*\d*)$/;

const legNumber = (className: string) => {
  const m = className.match(legSuffixRe);
  return m ? -Number(m[0]) : 0;
};

/**
 * The class menu as a flat sequence of links and line breaks, ported from the
 * legacy `handleUpdateClassListResponse` for Time4o races: relay legs are
 * grouped under their relay, sprint heats under their sprint class.
 */
export function classListItems(classes: ClassInfo[]): ClassListItem[] {
  const sorted = sortClasses(classes);
  const items: ClassListItem[] = [];
  const n = sorted.length;
  let relayNext = false;
  let sprintNext = false;
  let shiftHeat = false;
  let eliteLast = false;
  let leg = 0;

  for (let i = 0; i < n; i++) {
    const rawName = sorted[i]!.className;
    const nextName = i < n - 1 ? sorted[i + 1]!.className : '';
    let relay = relayNext;
    let sprint = sprintNext;
    if (!rawName) continue;

    const className = classShort(rawName);
    const cleanName = className.replace(/-[0-9]{1,2}$|-All$/, '');
    const legNo = legNumber(className);
    const cleanNext = i < n - 1 ? nextName.replace(legSuffixRe, '') : '';
    const legNoNext = i < n - 1 ? legNumber(nextName) : 0;

    if (cleanName == cleanNext && legNoNext == legNo + 1) {
      if (!relay) {
        items.push(
          { kind: 'relay', title: ' ' + cleanName, className: rawName },
          { kind: 'indent' },
        );
        leg = 0;
      }
      relay = true;
      relayNext = true;
    } else {
      relayNext = false;
      if (sprintRe.test(className) || sprintRe.test(nextName)) {
        const cleanSprint = rawName.replace(sprintCleanRe, '');
        if (!sprint)
          items.push(
            {
              kind: 'sprint',
              title: classShort(rawName.replace(sprintTitleRe, ' ')),
              plainKey: 'plainresultsclass_' + cleanSprint,
            },
            { kind: 'indent' },
          );
        sprint = true;
        sprintNext = nextName.replace(sprintCleanRe, '') == cleanSprint;
        shiftHeat =
          i < n - 1 &&
          (sprintPrRe.test(className) ||
            (!sprintKvRe.test(className) && sprintKvRe.test(nextName)) ||
            (sprintKvRe.test(className) && !sprintKvRe.test(nextName)) ||
            (sprintSeRe.test(className) && !sprintSeRe.test(nextName)));
      }
    }

    if (relay) {
      leg += 1;
      if (leg > 1 && (leg - 1) % 3 == 0) items.push({ kind: 'indent' });
      const label =
        className.replace(cleanName, '') == '-All' ? 'Ⓐ' : String.fromCodePoint(10111 + leg);
      items.push({ kind: 'leg', label, className: rawName });
      if (!relayNext) items.push({ kind: 'break' });
    } else if (sprint) {
      const isHeat = sprintRe.test(className);
      const heatMatch = className.match(/ \d+$/);
      const heat = heatMatch ? parseInt(heatMatch[0], 10) : 0;
      if (isHeat && heat > 1 && (heat - 1) % 4 == 0) items.push({ kind: 'indent' });
      const heatNo = heat > 0 ? heat : '';
      let label = 'Prolog';
      if (sprintKvRe.test(className)) label = 'K' + heatNo;
      else if (sprintSeRe.test(className)) label = 'S' + heatNo;
      else if (sprintFiRe.test(className)) label = 'Finale' + heatNo;
      else if (/NM KO Tot(?:al|alt)/.test(className)) label = 'Total';
      items.push({ kind: 'heat', label, className: rawName });
      if (!sprintNext) items.push({ kind: 'rule' });
      else if (shiftHeat) items.push({ kind: 'indent' });
    } else {
      const elite = eliteRe.test(className.toLowerCase());
      if (!elite && eliteLast) items.push({ kind: 'rule' });
      items.push({ kind: 'class', label: className, className: rawName }, { kind: 'break' });
      eliteLast = elite;
    }
  }
  return items;
}

/** Relay classes (every leg) as named in the class list, used to pick the relay column layout. */
export function relayClassNames(items: ClassListItem[]): Set<string> {
  return new Set(items.filter((i) => i.kind == 'leg').map((i) => i.className));
}

/** Legacy `getSprintStage`: 0 prolog, 1 quarter, 2 semi, 3 final, -1 not a sprint heat. */
export function sprintStage(className: string): number {
  const c = (className || '').toUpperCase();
  if (/\|\s*PROLOG/.test(c)) return 0;
  if (/(\|\s*KVART\b|\bKV\s*\d+)/.test(c)) return 1;
  if (/(\|\s*SEMI\b|\bSE\s*\d+)/.test(c)) return 2;
  if (/\s*FINALE\b|F\s*\d+/.test(c)) return 3;
  return -1;
}
