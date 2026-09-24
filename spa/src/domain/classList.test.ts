import type { RaceClass } from '../api/types';
import { createLegacyViewer } from '../test/legacy';
import { classGroups, classListItems, sprintStage, type ClassListItem } from './classList';
import { classSexes, normalizeClasses } from './time4o';

const esc = (s: string) => s.replace("'", "\\'");
const link = (fn: string, arg: string, body: string, plain = true) =>
  `<a href="javascript:LiveResults.Instance.${fn}('${esc(arg)}')"${plain ? ' style="text-decoration: none"' : ''}>${body}</a>`;

function toLegacyHtml(items: ClassListItem[]): string {
  return items
    .map((i) => {
      switch (i.kind) {
        case 'relay':
          return link('viewRelayResults', i.className, `<b>${i.title}</b>`);
        case 'sprint':
          return link('chooseClass', i.plainKey, `<b>${i.title}</b>`);
        case 'leg':
          return link(
            'chooseClass',
            i.className,
            ' ' +
              (i.label == 'Ⓐ'
                ? '&#9398'
                : `<span style="font-size:1.2em">&#${i.label.codePointAt(0)};</span>`),
          );
        case 'heat':
          return link('chooseClass', i.className, ' ' + i.label);
        case 'class':
          return link('chooseClass', i.className, i.label, false);
        case 'indent':
          return '<br>&nbsp;';
        case 'break':
          return '<br>';
        case 'rule':
          return '<hr>';
      }
    })
    .join('');
}

function legacyClassList(classes: RaceClass[]): string {
  let html = '';
  const jq = { html: (s: string) => ((html = s), jq), removeClass: () => jq, addClass: () => jq };
  Object.assign(globalThis, { $: () => jq });
  try {
    const viewer = createLegacyViewer({
      Time4oServer: true,
      EmmaServer: false,
      classesDiv: 'classes',
      compDate: '2000-01-01',
      resources: {},
    });
    viewer.handleUpdateClassListResponse({ status: 'OK', data: classes }, false);
  } finally {
    delete (globalThis as Record<string, unknown>).$;
  }
  const tail = html.lastIndexOf(
    `<hr><a href="javascript:LiveResults.Instance.chooseClass('plainresults')"`,
  );
  return html.slice(0, tail);
}

let nextId = 0;
const individual = (name: string, order: number | null = null): RaceClass => ({
  id: String(++nextId),
  name,
  order,
});
const relay = (name: string, legs: number): RaceClass => ({
  id: String(++nextId),
  name,
  eventForm: 'Relay',
  legs: Object.fromEntries(Array.from({ length: legs }, (_, i) => [i + 1, { number: i + 1 }])),
});

const sprintClasses = (base: string) => [
  individual(`${base} PR 1`),
  ...[1, 2, 3, 4, 5].map((h) => individual(`${base} KV ${h}`)),
  individual(`${base} SE 1`),
  individual(`${base} SE 2`),
  individual(`${base} Finale`),
  individual(`${base} NM KO Total`),
];

describe('classListItems', () => {
  it.each([
    [
      'individual classes',
      ['H21', 'D21', 'H 10', 'Åpen 1', 'D17-18', 'H50'].map((n) => individual(n)),
    ],
    [
      'elite before the rest',
      [individual('H21E'), individual('D21 Elite'), individual('NM H'), individual('H21')],
    ],
    ['relays', [relay('Stafett Herrer', 3), relay('Damer', 5), individual('Gutter 12')]],
    ['relay with long legs', [relay('H', 7)]],
    ['sprint heats', [...sprintClasses('Kvinner'), ...sprintClasses('Menn'), individual('H21')]],
    ['explicit order', [individual('B', 2), individual('A', 1), relay('R', 2)]],
    ['name with quote', [individual("O'Hare")]],
  ])('matches the legacy class list (%s)', (_name, classes) => {
    const items = classListItems(normalizeClasses(classes));
    expect(toLegacyHtml(items)).toBe(legacyClassList(classes));
  });

  it('groups relay legs under the relay', () => {
    const items = classListItems(normalizeClasses([relay('Stafett', 2)]));
    expect(items).toEqual([
      { kind: 'relay', title: ' Stafett', className: 'Stafett-1' },
      { kind: 'indent' },
      { kind: 'leg', label: '➀', className: 'Stafett-1' },
      { kind: 'leg', label: '➁', className: 'Stafett-2' },
      { kind: 'break' },
    ]);
  });
});

describe('sprintStage', () => {
  it.each(['H21 PR 1', 'H21 KV 2', 'H21 SE 1', 'H21 Finale', 'H21 | Prolog', 'H21 | Semi', 'H21'])(
    'matches legacy for %s',
    (name) => {
      expect(sprintStage(name)).toBe(createLegacyViewer().getSprintStage(name));
    },
  );
});

describe('classGroups', () => {
  const race = (...classes: [string, string?][]) => {
    const raw = classes.map(([name, sex], i) => ({ id: `c${i}`, name, sex }));
    return { items: classListItems(normalizeClasses(raw)), sexes: classSexes(raw) };
  };
  const labels = (items: ClassListItem[]) =>
    items.map((i) => ('label' in i ? i.label : 'title' in i ? i.title.trim() : i.kind));
  const groups = (...classes: [string, string?][]) => {
    const { items, sexes } = race(...classes);
    return classGroups(items, sexes).map((g) => [g.kind, labels(g.items)]);
  };

  it('splits women, men and other classes by sex, with women and men by age', () => {
    expect(
      groups(
        ['H 21-E', 'M'],
        ['D 21-E', 'F'],
        ['H 9-10', 'M'],
        ['D 35-', 'F'],
        ['D 17-18E', 'F'],
        ['N1-åpen', 'B'],
        ['H 90-', 'M'],
        ['AK-åpen', 'B'],
        ['D/H-16', 'B'],
      ),
    ).toEqual([
      ['women', ['D 17-18E', 'D 21-E', 'D 35-']],
      ['men', ['H 9-10', 'H 21-E', 'H 90-']],
      ['other', ['D/H-16', 'AK-åpen', 'N1-åpen']],
    ]);
  });

  it('trusts the sex of the class rather than its name', () => {
    expect(groups(['Lang', 'F'], ['Kort', 'M'], ['H 50', 'B'], ['D 50'])).toEqual([
      ['women', ['Lang']],
      ['men', ['Kort']],
      ['other', ['D 50', 'H 50']],
    ]);
  });

  it('keeps legs with their relay', () => {
    const relay = {
      id: 'r',
      name: 'H17-20',
      sex: 'M',
      eventForm: 'Relay',
      legs: { 1: { number: 1 }, 2: { number: 2 } },
    };
    const raw = [{ id: 'd', name: 'D 21', sex: 'F' }, relay];
    const found = classGroups(classListItems(normalizeClasses(raw)), classSexes(raw));
    expect(found.map((g) => [g.kind, labels(g.items)])).toEqual([
      ['women', ['D 21']],
      ['men', ['H17-20', '➀', '➁']],
    ]);
  });

  it('gives one group in menu order when the race does not tell women and men apart', () => {
    expect(groups(['Lang', 'B'], ['Kort'], ['H 21'])).toEqual([
      ['other', ['H 21', 'Kort', 'Lang']],
    ]);
  });
});
