import { FIXTURES } from '../test/fixtures';
import { buildClassView } from './pipeline';
import { scrollClasses, scrollDelay, scrollOptions, scrollViews } from './scroll';
import { sortClasses } from './sorting';
import { normalizeClasses } from './time4o';

const all = Object.values(FIXTURES);
const classes = normalizeClasses(all.map((f) => f.raceClass));
const entries = all.flatMap((f) => f.entries);
const opts = { timeZone: 'Europe/Oslo' };

describe('scrollOptions', () => {
  it('reads first, last and speed like followallscroll.php', () => {
    expect(scrollOptions(new URLSearchParams('scroll'))).toEqual({ first: 1, last: 999, speed: 5 });
    expect(scrollOptions(new URLSearchParams('first=3&last=5&speed=10'))).toEqual({
      first: 3,
      last: 5,
      speed: 10,
    });
    expect(scrollOptions(new URLSearchParams('speed=0')).speed).toBe(5);
  });

  it('scrolls one pixel every 25 ms at the default speed', () => {
    expect(scrollDelay(5)).toBe(25);
    expect(scrollDelay(10)).toBe(12.5);
  });
});

describe('scrollClasses', () => {
  it('keeps the classes from first to last in the class menu order', () => {
    const sorted = sortClasses(classes);
    expect(scrollClasses(classes, { first: 1, last: 999, speed: 5 })).toEqual(sorted);
    expect(scrollClasses(classes, { first: 2, last: 3, speed: 5 })).toEqual(sorted.slice(1, 3));
  });
});

describe('scrollViews', () => {
  it('shows every class without splits', () => {
    const views = scrollViews(entries, classes, opts);
    expect(views.map((v) => v.className)).toEqual(classes.map((c) => c.className));
    expect(views.every((v) => v.splitcontrols.length == 0 && v.numSplits == 0)).toBe(true);
    for (const [i, cls] of classes.entries()) {
      const own = entries.filter((e) => e.raceClassId == cls.id);
      const withSplits = buildClassView(cls, own, opts);
      expect(views[i]!.results.map((r) => [r.dbid, r.place, r.result, r.status])).toEqual(
        withSplits.results.map((r) => [r.dbid, r.place, r.result, r.status]),
      );
    }
  });
});
