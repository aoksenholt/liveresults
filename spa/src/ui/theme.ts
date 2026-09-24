export type Theme = 'classic' | 'dark';

const KEY = 'liveres-theme';

type ThemeStorage = Pick<Storage, 'getItem' | 'setItem'>;

// Even reading `localStorage` throws when the browser blocks it, e.g. in third-party iframes.
function read(storage: () => ThemeStorage): string | null {
  try {
    return storage().getItem(KEY);
  } catch {
    return null;
  }
}

/** `?theme=` wins and is remembered, since links between pages do not carry it. */
export function resolveTheme(
  param: string | null,
  storage: () => ThemeStorage = () => window.localStorage,
): Theme {
  const theme = (param ?? read(storage)) == 'dark' ? 'dark' : 'classic';
  if (param != null) {
    try {
      storage().setItem(KEY, theme);
    } catch {
      // The theme then only lasts for this page.
    }
  }
  return theme;
}
