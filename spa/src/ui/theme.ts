/** `classic` is the look of the legacy site; `light` and `dark` are the new look. */
export type Theme = 'classic' | 'light' | 'dark';
/** `auto` follows the light or dark setting of the device. */
export type ThemePreference = 'auto' | Theme;

const KEY = 'liveres-theme';
const PREFERENCES: ThemePreference[] = ['auto', 'light', 'dark', 'classic'];
/** The classic look is only chosen with `?theme=classic`, so the toggle skips it. */
const TOGGLE_ORDER: ThemePreference[] = ['auto', 'light', 'dark'];

type ThemeStorage = Pick<Storage, 'getItem' | 'setItem'>;
type GetStorage = () => ThemeStorage;
const localStorage: GetStorage = () => window.localStorage;

const parse = (value: string | null): ThemePreference | null =>
  PREFERENCES.find((p) => p == value) ?? null;

// Even reading `localStorage` throws when the browser blocks it, e.g. in third-party iframes.
function read(storage: GetStorage): string | null {
  try {
    return storage().getItem(KEY);
  } catch {
    return null;
  }
}

export function savePreference(preference: ThemePreference, storage = localStorage) {
  try {
    storage().setItem(KEY, preference);
  } catch {
    // The choice then only lasts for this page.
  }
}

/** `?theme=` wins and is remembered, since links between pages do not carry it. */
export function initialPreference(param: string | null, storage = localStorage): ThemePreference {
  const fromUrl = parse(param);
  if (fromUrl) savePreference(fromUrl, storage);
  return fromUrl ?? parse(read(storage)) ?? 'auto';
}

export const effectiveTheme = (preference: ThemePreference, prefersDark: boolean): Theme =>
  preference == 'auto' ? (prefersDark ? 'dark' : 'light') : preference;

export const nextPreference = (preference: ThemePreference): ThemePreference =>
  TOGGLE_ORDER[(TOGGLE_ORDER.indexOf(preference) + 1) % TOGGLE_ORDER.length]!;
