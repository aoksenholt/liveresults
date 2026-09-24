import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from 'react';
import { useDisplay } from './context';
import {
  effectiveTheme,
  initialPreference,
  nextPreference,
  savePreference,
  type ThemePreference,
} from './theme';

const DARK_QUERY = '(prefers-color-scheme: dark)';

const subscribeDark = (listener: () => void) => {
  const query = window.matchMedia?.(DARK_QUERY);
  query?.addEventListener('change', listener);
  return () => query?.removeEventListener('change', listener);
};
const prefersDark = () => window.matchMedia?.(DARK_QUERY).matches ?? false;

interface ThemeState {
  preference: ThemePreference;
  toggle: () => void;
}

export const ThemeContext = createContext<ThemeState | null>(null);

/** Sets `data-theme` on the page before it is painted, so it does not flash. */
export function useTheme(param: string | null): ThemeState {
  const [preference, setPreference] = useState(() => initialPreference(param));
  const dark = useSyncExternalStore(subscribeDark, prefersDark);
  const theme = effectiveTheme(preference, dark);

  useLayoutEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const toggle = useCallback(() => {
    setPreference((p) => {
      const next = nextPreference(p);
      savePreference(next);
      return next;
    });
  }, []);
  return useMemo(() => ({ preference, toggle }), [preference, toggle]);
}

const ICONS: Record<ThemePreference, string> = { auto: '🌓', classic: '☀️', dark: '🌙' };

/** An icon for the top bar, or the chosen theme as text for the page footer. */
export function ThemeToggle({ className, text }: { className?: string; text?: boolean }) {
  const { res } = useDisplay();
  const state = useContext(ThemeContext);
  if (!state) return null;
  const titles: Record<ThemePreference, string | undefined> = {
    auto: res._THEMEAUTO,
    classic: res._THEMELIGHT,
    dark: res._THEMEDARK,
  };
  const label = `${res._THEME}: ${titles[state.preference]}`;
  return (
    <button className={className} onClick={state.toggle} title={label} aria-label={label}>
      {text ? label : ICONS[state.preference]}
    </button>
  );
}
