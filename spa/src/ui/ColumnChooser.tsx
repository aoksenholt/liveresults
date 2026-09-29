import { useId, useRef, useState } from 'react';
import type { ColumnChoice } from '../domain/columns';
import { useDisplay } from './context';
import { useDismiss } from './hooks';

/** The `columns-3-cog` icon of Lucide (ISC licence). */
function ColumnsCogIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M10.6 21H5a2 2 0 01-2-2V5a2 2 0 012-2h14a2 2 0 012 2v5.6" />
      <path d="m14.305 19.53.923-.382" />
      <path d="M15 3v7.6" />
      <path d="m15.229 16.852-.924-.383" />
      <path d="m16.852 15.228-.383-.923" />
      <path d="m16.852 20.772-.383.924" />
      <path d="m19.148 15.228.383-.923" />
      <path d="m19.53 21.696-.382-.924" />
      <path d="m20.773 16.852.922-.383" />
      <path d="m20.773 19.148.922.383" />
      <path d="M9 3v18" />
      <circle cx="18" cy="18" r="3" />
    </svg>
  );
}

/** The legacy DataTables column picker: a menu of the columns to show. */
export function ColumnChooser({
  choices,
  hidden,
  onToggle,
  onShowAll,
}: {
  choices: ColumnChoice[];
  hidden: ReadonlySet<string>;
  onToggle: (key: string) => void;
  onShowAll: () => void;
}) {
  const { res } = useDisplay();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useDismiss(open, () => setOpen(false), root);

  const anyHidden = choices.some((c) => hidden.has(c.key));
  return (
    <div className="column-chooser" ref={root}>
      <button
        className={anyHidden ? 'chooser-button changed' : 'chooser-button'}
        onClick={() => setOpen((o) => !o)}
        title={res._CHOOSECOLUMNS}
        aria-label={res._CHOOSECOLUMNS}
        aria-expanded={open}
        aria-controls={menuId}
      >
        <ColumnsCogIcon />
      </button>
      {open && (
        <div className="chooser-menu" id={menuId}>
          {choices.map((c) => (
            <label key={c.key}>
              <input
                type="checkbox"
                checked={!hidden.has(c.key)}
                onChange={() => onToggle(c.key)}
              />
              {c.title}
            </label>
          ))}
          <button className="show-all" onClick={onShowAll} disabled={!anyHidden}>
            {res._SHOWALL}
          </button>
        </div>
      )}
    </div>
  );
}
