import type { ClassListItem } from '../domain/classList';
import { closeTab, menuEntries, openTab, visibleTabs } from './tabs';

const items: ClassListItem[] = [
  { kind: 'class', label: 'H 21', className: 'H 21' },
  { kind: 'break' },
  { kind: 'relay', title: ' H17-20', className: 'H17-20-1' },
  { kind: 'indent' },
  { kind: 'leg', label: '①', className: 'H17-20-1' },
  { kind: 'sprint', title: 'Sprint ', plainKey: 'plainresultsclass_H21' },
  { kind: 'heat', label: 'KV1', className: 'H21 KV1' },
  { kind: 'rule' },
];
const labels = { allClasses: 'Alle klasser', startList: 'Startliste' };

describe('menuEntries', () => {
  it('lists every page of the class menu', () => {
    expect(menuEntries(items, labels)).toEqual([
      { hash: '#H%2021', label: 'H 21' },
      { hash: '#relay::H17-20-1', label: 'H17-20' },
      { hash: '#H17-20-1', label: 'H17-20-1' },
      { hash: '#plainresultsclass_H21', label: 'Sprint' },
      { hash: '#H21%20KV1', label: 'H21 KV1' },
      { hash: '#plainresults', label: 'Alle klasser' },
      { hash: '#startlist', label: 'Startliste' },
    ]);
  });
});

describe('tabs', () => {
  const entries = menuEntries(items, labels);

  it('opens a tab once for pages in the menu', () => {
    const tabs = openTab([], '#H%2021', entries);
    expect(tabs).toEqual(['#H%2021']);
    expect(openTab(tabs, '#H%2021', entries)).toBe(tabs);
    expect(openTab(tabs, '#club::12', entries)).toBe(tabs);
    expect(openTab(tabs, '#startlist', entries)).toEqual(['#H%2021', '#startlist']);
  });

  it('moves to a neighbour when the open tab is closed', () => {
    const tabs = ['#a', '#b', '#c'];
    expect(closeTab(tabs, '#b', '#b')).toEqual({ tabs: ['#a', '#c'], next: '#c' });
    expect(closeTab(tabs, '#c', '#c')).toEqual({ tabs: ['#a', '#b'], next: '#b' });
    expect(closeTab(tabs, '#a', '#c')).toEqual({ tabs: ['#b', '#c'], next: null });
    expect(closeTab(['#a'], '#a', '#a')).toEqual({ tabs: [], next: '#' });
  });

  it('shows the open tab and the ones after it, or before it at the end', () => {
    const tabs = ['#a', '#b', '#c', '#d', '#e'];
    expect(visibleTabs(tabs, '#b', 1)).toEqual(['#b']);
    expect(visibleTabs(tabs, '#b', 3)).toEqual(['#b', '#c', '#d']);
    expect(visibleTabs(tabs, '#e', 3)).toEqual(['#c', '#d', '#e']);
    expect(visibleTabs(tabs.slice(0, 2), '#b', 4)).toEqual(['#a', '#b']);
    expect(visibleTabs(tabs, '#club::1', 3)).toEqual(['#club::1']);
  });
});
