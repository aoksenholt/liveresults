import type { ClassListItem } from '../domain/classList';
import { routeHash, type Route } from './route';

export interface MenuEntry {
  hash: string;
  label: string;
}

/** Every page of the class menu, for the class picker of the new look. */
export function menuEntries(
  items: ClassListItem[],
  labels: { allClasses: string; startList: string },
): MenuEntry[] {
  const entry = (route: Route, label: string) => ({ hash: routeHash(route), label: label.trim() });
  const entries: MenuEntry[] = [];
  for (const item of items) {
    switch (item.kind) {
      case 'relay':
        entries.push(entry({ kind: 'relay', className: item.className }, item.title));
        break;
      case 'sprint':
        entries.push(
          entry(
            { kind: 'sprint', key: item.plainKey.replace(/^plainresultsclass_/, '') },
            item.title,
          ),
        );
        break;
      case 'leg':
      case 'heat':
        entries.push(entry({ kind: 'class', className: item.className }, item.className));
        break;
      case 'class':
        entries.push(entry({ kind: 'class', className: item.className }, item.label));
        break;
    }
  }
  entries.push(entry({ kind: 'plainresults' }, labels.allClasses));
  entries.push(entry({ kind: 'startlist' }, labels.startList));
  return entries;
}

/** Pages from the menu get a tab when they are opened; other pages, such as clubs, do not. */
export function openTab(tabs: string[], hash: string, entries: MenuEntry[]): string[] {
  if (tabs.includes(hash) || !entries.some((e) => e.hash == hash)) return tabs;
  return [...tabs, hash];
}

/** Closing the open tab moves to the tab after it, or before it when it was the last. */
export function closeTab(
  tabs: string[],
  hash: string,
  current: string,
): { tabs: string[]; next: string | null } {
  const index = tabs.indexOf(hash);
  const rest = tabs.filter((t) => t != hash);
  if (hash != current) return { tabs: rest, next: null };
  return { tabs: rest, next: rest[Math.min(index, rest.length - 1)] ?? '#' };
}
