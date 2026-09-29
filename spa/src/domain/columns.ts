import type { Column } from './classTable';

/** The columns a user has hidden in a race: some for every class, the splits per class. */
export interface HiddenColumns {
  common: string[];
  classes: Record<string, string[]>;
}

export const NO_HIDDEN_COLUMNS: HiddenColumns = { common: [], classes: {} };

export interface ColumnChoice {
  key: string;
  title: string;
}

const isSplitKey = (key: string) => key.startsWith('split:');

/**
 * What the choice to hide a column is remembered as, or null for a column that always shows.
 * Place and name always show, and so does the team of a relay.
 */
export function columnKey(column: Column, isRelayClass: boolean): string | null {
  switch (column.kind) {
    case 'runner':
      return !isRelayClass && (column.layout == 'club' || column.layout == 'nameClub')
        ? 'club'
        : null;
    case 'bib':
    case 'start':
    case 'finish':
      return column.kind;
    case 'diff':
    case 'diff2':
      return 'diff';
    case 'split':
      return `split:${column.code}`;
    default:
      return null;
  }
}

/** The columns of a class table the user can hide, in table order. */
export function columnChoices(
  columns: Column[],
  isRelayClass: boolean,
  clubTitle: string,
): ColumnChoice[] {
  return columns.flatMap((column) => {
    const key = column.visible ? columnKey(column, isRelayClass) : null;
    return key ? [{ key, title: key == 'club' ? clubTitle : column.title }] : [];
  });
}

export function hiddenIn(hidden: HiddenColumns, className: string): Set<string> {
  return new Set([...hidden.common, ...(hidden.classes[className] ?? [])]);
}

/** Hides a shown column or shows a hidden one; splits only in this class. */
export function toggleColumn(hidden: HiddenColumns, className: string, key: string): HiddenColumns {
  const flip = (list: string[]) =>
    list.includes(key) ? list.filter((k) => k != key) : [...list, key];
  if (!isSplitKey(key)) return { ...hidden, common: flip(hidden.common) };
  const classes = { ...hidden.classes, [className]: flip(hidden.classes[className] ?? []) };
  if (classes[className]!.length == 0) delete classes[className];
  return { ...hidden, classes };
}

/** Shows every column of the class again, which also shows the common ones in other classes. */
export function showAllColumns(hidden: HiddenColumns, className: string): HiddenColumns {
  const classes = { ...hidden.classes };
  delete classes[className];
  return { common: [], classes };
}

/**
 * The shown columns with their indices once the hidden ones are left out. A hidden club drops
 * out of the combined name and club column too.
 */
export function withoutHidden(
  columns: Column[],
  isRelayClass: boolean,
  hidden: ReadonlySet<string>,
): (readonly [Column, number])[] {
  return columns.flatMap((column, index) => {
    if (!column.visible) return [];
    const key = columnKey(column, isRelayClass);
    if (!key || !hidden.has(key)) return [[column, index] as const];
    if (column.layout == 'nameClub') return [[{ ...column, layout: 'name' }, index] as const];
    return [];
  });
}

/** Reads what was stored, leaving out anything that does not have the expected shape. */
export function parseHiddenColumns(stored: string | null): HiddenColumns {
  try {
    const value: unknown = JSON.parse(stored ?? 'null');
    if (typeof value != 'object' || value == null) return NO_HIDDEN_COLUMNS;
    const strings = (list: unknown) =>
      Array.isArray(list) ? list.filter((s): s is string => typeof s == 'string') : [];
    const { common, classes } = value as Record<string, unknown>;
    return {
      common: strings(common),
      classes:
        typeof classes == 'object' && classes != null
          ? Object.fromEntries(
              Object.entries(classes).map(([name, list]) => [name, strings(list)] as const),
            )
          : {},
    };
  } catch {
    return NO_HIDDEN_COLUMNS;
  }
}
