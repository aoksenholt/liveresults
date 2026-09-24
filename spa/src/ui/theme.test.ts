import { effectiveTheme, initialPreference, nextPreference, savePreference } from './theme';

function storage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return () => ({
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
  });
}

const blocked = () => {
  throw new Error('blocked');
};

describe('initialPreference', () => {
  it('follows the device unless something else is chosen', () => {
    expect(initialPreference(null, storage())).toBe('auto');
    expect(initialPreference('pink', storage())).toBe('auto');
    expect(initialPreference('dark', storage())).toBe('dark');
    expect(initialPreference('light', storage())).toBe('light');
    expect(initialPreference('classic', storage())).toBe('classic');
  });

  it('remembers the theme from the URL and the toggle', () => {
    const s = storage();
    initialPreference('dark', s);
    expect(initialPreference(null, s)).toBe('dark');
    savePreference('classic', s);
    expect(initialPreference(null, s)).toBe('classic');
    initialPreference('auto', s);
    expect(initialPreference(null, s)).toBe('auto');
  });

  it('works when storage is blocked', () => {
    expect(initialPreference('dark', blocked)).toBe('dark');
    expect(initialPreference(null, blocked)).toBe('auto');
    expect(() => savePreference('dark', blocked)).not.toThrow();
  });
});

describe('effectiveTheme', () => {
  it('uses the device setting for auto', () => {
    expect(effectiveTheme('auto', true)).toBe('dark');
    expect(effectiveTheme('auto', false)).toBe('light');
    expect(effectiveTheme('classic', true)).toBe('classic');
    expect(effectiveTheme('light', true)).toBe('light');
    expect(effectiveTheme('dark', false)).toBe('dark');
  });
});

describe('nextPreference', () => {
  it('cycles auto, light and dark, and leaves the classic look', () => {
    expect(nextPreference('auto')).toBe('light');
    expect(nextPreference('light')).toBe('dark');
    expect(nextPreference('dark')).toBe('auto');
    expect(nextPreference('classic')).toBe('auto');
  });
});
