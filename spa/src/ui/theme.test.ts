import { resolveTheme } from './theme';

function storage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    data,
  };
}

describe('resolveTheme', () => {
  it('is classic unless dark is asked for', () => {
    expect(resolveTheme(null, () => storage())).toBe('classic');
    expect(resolveTheme('pink', () => storage())).toBe('classic');
    expect(resolveTheme('dark', () => storage())).toBe('dark');
  });

  it('remembers the theme from the URL', () => {
    const s = storage();
    resolveTheme('dark', () => s);
    expect(resolveTheme(null, () => s)).toBe('dark');
    resolveTheme('classic', () => s);
    expect(resolveTheme(null, () => s)).toBe('classic');
  });

  it('works when storage is blocked', () => {
    const blocked = () => {
      throw new Error('blocked');
    };
    expect(resolveTheme('dark', blocked)).toBe('dark');
    expect(resolveTheme(null, blocked)).toBe('classic');
  });
});
