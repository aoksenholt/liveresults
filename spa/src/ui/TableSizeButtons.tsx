import { useDisplay } from './context';
import {
  DEFAULT_TABLE_SIZE,
  MAX_TABLE_SIZE,
  MIN_TABLE_SIZE,
  stepTableSize,
  useTableSize,
} from './tableSize';
import { useNewLook } from './ThemeToggle';

/** The `a-arrow-down` and `a-arrow-up` icons of Lucide (ISC licence). */
function SizeIcon({ direction }: { direction: 1 | -1 }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3.5 13h6" />
      <path d="m2 16 4.5-9 4.5 9" />
      {direction == 1 ? (
        <>
          <path d="M18 16V7" />
          <path d="m14 11 4-4 4 4" />
        </>
      ) : (
        <>
          <path d="M18 7v9" />
          <path d="m14 12 4 4 4-4" />
        </>
      )}
    </svg>
  );
}

/** The legacy + and − buttons for the text size of the tables, with a reset in the new look. */
export function TableSizeButtons() {
  const { res } = useDisplay();
  const newLook = useNewLook();
  const [size, setSize] = useTableSize();
  const larger = (
    <button
      className="navbtn"
      onClick={() => setSize(stepTableSize(size, 1))}
      disabled={size >= MAX_TABLE_SIZE}
      title={res._LARGER}
      aria-label={res._LARGER}
    >
      {newLook ? <SizeIcon direction={1} /> : '+'}
    </button>
  );
  const smaller = (
    <button
      className="navbtn"
      onClick={() => setSize(stepTableSize(size, -1))}
      disabled={size <= MIN_TABLE_SIZE}
      title={res._SMALLER}
      aria-label={res._SMALLER}
    >
      {newLook ? <SizeIcon direction={-1} /> : '−'}
    </button>
  );
  return (
    <div className="table-size" role="group" aria-label={res._TABLESIZE}>
      {newLook ? (
        <>
          {smaller}
          <button
            className="navbtn size-reset"
            onClick={() => setSize(DEFAULT_TABLE_SIZE)}
            disabled={size == DEFAULT_TABLE_SIZE}
            title={res._TABLESIZERESET}
          >
            {size} %
          </button>
          {larger}
        </>
      ) : (
        <>
          {larger}
          {smaller}
        </>
      )}
    </div>
  );
}
