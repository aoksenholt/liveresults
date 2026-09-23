import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { resolveLanguage, resources, runnerStatus, timeLabels } from '.';

describe('i18n', () => {
  it('defaults to Norwegian and ignores unknown languages', () => {
    expect(resolveLanguage(null)).toBe('no');
    expect(resolveLanguage('xx')).toBe('no');
    expect(resolveLanguage('sv')).toBe('sv');
  });

  it('falls back to English for strings missing in a translation', () => {
    expect(resources('no')._FIRSTPAGELIVE).toBe('Live');
    expect(resources('no')._NAME).toBe('Navn');
    expect(resources('de')._ALLCLASSES).toBe('All classes');
  });

  it('maps status codes like followfull.php', () => {
    const src = readFileSync(resolve(process.cwd(), '../web/followfull.php'), 'utf8');
    const res = resources('no');
    const expected = Object.fromEntries(
      [...src.matchAll(/runnerStatus\[(\d+)\] = "(?:<\?= \$(\w+) \?>)?";/g)].map(
        ([, code, key]) => [Number(code), key ? res[key] : ''],
      ),
    );
    expect(Object.keys(expected)).toHaveLength(12);
    expect(runnerStatus(res)).toEqual(expected);
  });

  it('builds time labels', () => {
    expect(timeLabels(resources('no'))).toMatchObject({ freeStart: 'fristart', notShown: 'OK' });
  });
});
