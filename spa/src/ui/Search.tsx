import { useMemo, useState } from 'react';
import type { ClassInfo } from '../domain/model';
import { searchClasses } from '../domain/search';
import { searchController } from '../state/controllers';
import { Loading } from './common';
import { useDisplay } from './context';
import { markFound } from './found';
import { useControllerState } from './hooks';
import { namePage } from './pageNames';
import { routeHash } from './route';
import type { MenuEntry } from './tabs';

const MAX_CLASSES = 10;
const MAX_CLUBS = 10;
const MAX_RUNNERS = 20;

interface SearchProps {
  raceId: string;
  classes: ClassInfo[];
  entries: MenuEntry[];
  timeZone: string;
}

/** Search for runners, clubs and classes in the whole race. */
export function RaceSearch(props: SearchProps) {
  const { res } = useDisplay();
  const [query, setQuery] = useState('');
  const [used, setUsed] = useState(false);
  const shown = query.trim().length >= 2;
  return (
    <div className="search">
      <input
        type="search"
        value={query}
        placeholder={res._SEARCH}
        aria-label={res._SEARCH}
        onChange={(e) => {
          setQuery(e.target.value);
          setUsed(true);
        }}
        onKeyDown={(e) => e.key == 'Escape' && setQuery('')}
      />
      {used && shown && <SearchResults {...props} query={query} onPick={() => setQuery('')} />}
    </div>
  );
}

function SearchResults({
  raceId,
  classes,
  entries,
  timeZone,
  query,
  onPick,
}: SearchProps & { query: string; onPick: () => void }) {
  const { api, res } = useDisplay();
  const controller = useMemo(
    () => searchController(api, raceId, classes, { timeZone }),
    [api, raceId, classes, timeZone],
  );
  const { data: search, error } = useControllerState(controller);
  const found = useMemo(() => search?.(query), [search, query]);
  const foundClasses = useMemo(() => searchClasses(entries, query), [entries, query]);
  return (
    <div className="search-results" role="region" aria-label={res._SEARCH}>
      {foundClasses.length > 0 && (
        <>
          <h3>{res._CLASSES}</h3>
          <ul>
            {foundClasses.slice(0, MAX_CLASSES).map((e) => (
              <li key={e.hash}>
                <a href={e.hash} onClick={onPick}>
                  {e.label}
                </a>
              </li>
            ))}
          </ul>
        </>
      )}
      {!found ? (
        <Loading error={error} text={res._LOADINGRESULTS ?? ''} />
      ) : found.clubs.length + found.runners.length == 0 ? (
        foundClasses.length == 0 && <p>{res._NOMATCH}</p>
      ) : (
        <>
          {found.clubs.length > 0 && (
            <>
              <h3>{res._CLUBS}</h3>
              <ul>
                {found.clubs.slice(0, MAX_CLUBS).map((c) => (
                  <li key={c.id}>
                    <a
                      href={routeHash({ kind: 'club', clubId: String(c.id) })}
                      onClick={() => {
                        namePage(routeHash({ kind: 'club', clubId: String(c.id) }), c.name);
                        onPick();
                      }}
                    >
                      {c.name}
                    </a>{' '}
                    <span className="count">({c.runners})</span>
                  </li>
                ))}
              </ul>
            </>
          )}
          {found.runners.length > 0 && (
            <>
              <h3>{res._RUNNERS}</h3>
              <ul>
                {found.runners.slice(0, MAX_RUNNERS).map((r, i) => (
                  <li key={`${r.dbid}-${r.class}-${i}`}>
                    <a
                      href={routeHash({ kind: 'class', className: r.class })}
                      onClick={() => {
                        markFound(r);
                        onPick();
                      }}
                    >
                      {r.name}
                    </a>{' '}
                    <span className="count">
                      {r.club} · {r.class}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </div>
  );
}
