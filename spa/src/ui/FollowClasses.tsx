import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { classGroups, type ClassListItem } from '../domain/classList';
import {
  followedNames,
  formatFollowedClasses,
  parseFollowedClasses,
  toggleFollowed,
  type FollowedClasses,
} from '../domain/passings';
import { useDisplay } from './context';
import { useDismiss } from './hooks';
import { storedPerKey } from './stored';
import { followPages, pageClasses, type FollowPage } from './tabs';

const useStoredFollowed = storedPerKey<FollowedClasses>(
  'liveres-passings-classes-',
  () => 'all',
  parseFollowedClasses,
  formatFollowedClasses,
);

const GROUP_TITLES = { women: '_WOMEN', men: '_MEN', other: '_OTHERCLASSES' } as const;

export interface Follow {
  followed: FollowedClasses;
  setFollowed: (followed: FollowedClasses) => void;
  /** The classes followed, or null for every class. */
  names: Set<string> | null;
  /** The favourite runners when only they are followed. */
  runners: Set<number> | null;
  /** Every favourite runner of the race. */
  favourites: Set<number>;
  tabClasses: string[];
  groups: { kind: keyof typeof GROUP_TITLES; pages: FollowPage[] }[];
  every: string[];
}

/** The classes the latest updates follow in a race, remembered per race. */
export function useFollow(
  raceId: string,
  items: ClassListItem[],
  sexes: Map<string, string>,
  tabs: string[],
  favourites: Set<number>,
): Follow {
  const [followed, setFollowed] = useStoredFollowed(raceId);
  const groups = useMemo(
    () =>
      classGroups(items, sexes).map((g) => ({ kind: g.kind, pages: followPages(items, g.items) })),
    [items, sexes],
  );
  const every = useMemo(() => groups.flatMap((g) => g.pages.flatMap((p) => p.classes)), [groups]);
  const tabKey = tabs.flatMap((h) => pageClasses(items, h)).join('\n');
  const tabClasses = useMemo(() => (tabKey ? tabKey.split('\n') : []), [tabKey]);
  const names = useMemo(() => followedNames(followed, tabClasses), [followed, tabClasses]);
  const runners = followed == 'favourites' ? favourites : null;
  return { followed, setFollowed, names, runners, favourites, tabClasses, groups, every };
}

/** The `funnel` icon of Lucide (ISC licence). */
export function FunnelIcon({ size = 20 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M10 20a1 1 0 0 0 .553.895l2 1A1 1 0 0 0 14 21v-7a2 2 0 0 1 .517-1.341L21.74 4.67A1 1 0 0 0 21 3H3a1 1 0 0 0-.742 1.67l7.225 7.989A2 2 0 0 1 10 14z" />
    </svg>
  );
}

function GroupBox({
  checked,
  some,
  onChange,
  children,
}: {
  checked: boolean;
  some: boolean;
  onChange: () => void;
  children: string;
}) {
  const box = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (box.current) box.current.indeterminate = some && !checked;
  }, [some, checked]);
  return (
    <label className="follow-group">
      <input ref={box} type="checkbox" checked={checked} onChange={onChange} />
      {children}
    </label>
  );
}

/** A menu of the classes to follow in the latest updates. */
export function FollowChooser({ follow }: { follow: Follow }) {
  const { res } = useDisplay();
  const { followed, setFollowed, names, tabClasses, groups, every, favourites } = follow;
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const menuId = useId();
  useDismiss(open, () => setOpen(false), root);

  const has = (c: string) => !names || names.has(c);
  const toggle = (classes: string[]) =>
    setFollowed(toggleFollowed(followed, classes, every, tabClasses));
  return (
    <div className="column-chooser follow-chooser" ref={root}>
      <button
        type="button"
        className={followed == 'all' ? 'chooser-button' : 'chooser-button changed'}
        onClick={() => setOpen((o) => !o)}
        title={res._FOLLOWCLASSES}
        aria-label={res._FOLLOWCLASSES}
        aria-expanded={open}
        aria-controls={menuId}
      >
        <FunnelIcon size={16} />
      </button>
      {open && (
        <div className="chooser-menu" id={menuId}>
          <label>
            <input type="radio" checked={followed == 'all'} onChange={() => setFollowed('all')} />
            {res._ALLCLASSES}
          </label>
          <label>
            <input type="radio" checked={followed == 'tabs'} onChange={() => setFollowed('tabs')} />
            {res._FOLLOWTABS}
          </label>
          {(favourites.size > 0 || followed == 'favourites') && (
            <label>
              <input
                type="radio"
                checked={followed == 'favourites'}
                onChange={() => setFollowed('favourites')}
              />
              {res._FOLLOWFAVOURITES}
            </label>
          )}
          {groups.map((g) => {
            const classes = g.pages.flatMap((p) => p.classes);
            return (
              <fieldset key={g.kind}>
                {groups.length > 1 && (
                  <GroupBox
                    checked={classes.every(has)}
                    some={classes.some(has)}
                    onChange={() => toggle(classes)}
                  >
                    {res[GROUP_TITLES[g.kind]] ?? ''}
                  </GroupBox>
                )}
                {g.pages.map((p) => (
                  <label key={p.hash}>
                    <input
                      type="checkbox"
                      checked={p.classes.every(has)}
                      onChange={() => toggle(p.classes)}
                    />
                    {p.label}
                  </label>
                ))}
              </fieldset>
            );
          })}
        </div>
      )}
    </div>
  );
}
