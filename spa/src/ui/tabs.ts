import type { ClassListItem } from '../domain/classList';
import { parseHash, routeHash, type Route } from './route';

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

/** Pages from the menu, clubs and the favourites get a tab when they are opened; other pages do not. */
export function openTab(tabs: string[], hash: string, entries: MenuEntry[]): string[] {
  const kind = parseHash(hash).kind;
  const tabbed = entries.some((e) => e.hash == hash) || kind == 'club' || kind == 'favourites';
  if (tabs.includes(hash) || !tabbed) return tabs;
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

/**
 * The pages of the columns after the first, which follows the hash. Going from one column to
 * more fills them with the other open tabs, and the rest start empty.
 */
export function otherColumns(
  others: string[],
  tabs: string[],
  current: string,
  columns: number,
): string[] {
  const pages = others.length > 0 ? others : tabs.filter((t) => t != current);
  return Array.from({ length: columns - 1 }, (_, i) => pages[i] ?? '');
}

export const MAX_RECENT = 6;

/** The classes opened last come first; other pages, such as the lists for all classes, are left out. */
export function rememberPage(recent: string[], hash: string, entries: MenuEntry[]): string[] {
  const kind = parseHash(hash).kind;
  if (!['class', 'relay', 'sprint'].includes(kind) || !entries.some((e) => e.hash == hash))
    return recent;
  if (recent[0] == hash) return recent;
  return [hash, ...recent.filter((h) => h != hash)].slice(0, MAX_RECENT);
}

const sprintKey = (plainKey: string) => plainKey.replace(/^plainresultsclass_/, '');

/** The classes of a menu page: a class, or every leg or heat under a relay or sprint title. */
export function pageClasses(items: ClassListItem[], hash: string): string[] {
  const route = parseHash(hash);
  if (route.kind == 'class') return [route.className];
  const at = items.findIndex((i) =>
    i.kind == 'relay'
      ? route.kind == 'relay' && i.className == route.className
      : i.kind == 'sprint' && route.kind == 'sprint' && sprintKey(i.plainKey) == route.key,
  );
  if (at < 0) return [];
  const names: string[] = [];
  for (const item of items.slice(at + 1)) {
    if (item.kind == 'leg' || item.kind == 'heat') names.push(item.className);
    else if (item.kind == 'relay' || item.kind == 'sprint' || item.kind == 'class') break;
  }
  return names;
}

export interface FollowPage extends MenuEntry {
  classes: string[];
}

/** The pages to follow in the latest updates, one per class, relay or sprint title. */
export function followPages(items: ClassListItem[], group: ClassListItem[]): FollowPage[] {
  const titles = group.filter((i) => i.kind == 'relay' || i.kind == 'sprint' || i.kind == 'class');
  return menuEntries(titles, { allClasses: '', startList: '' })
    .slice(0, -2)
    .map((e) => ({ ...e, classes: pageClasses(items, e.hash) }))
    .filter((p) => p.classes.length > 0);
}
