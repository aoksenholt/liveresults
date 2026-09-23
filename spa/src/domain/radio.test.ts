import { createLegacyViewer } from '../test/legacy';
import type { ResultRow, SplitControl } from './model';
import { medianFrac, refSplit, splitRef, updateClassSplitsBest } from './radio';

const legacy = createLegacyViewer();

describe('medianFrac', () => {
  it.each([
    [[], 0],
    [[0.4], 0.25],
    [[0.5, 0.1, 0.3, 0.2], 0],
    [[0.5, 0.1, 0.3, 0.2, 0.9], 0],
    [[0.5, 0.1, 0.3, 0.2, 0.9, 0.35, 0.42, 0.61], 0.25],
    [[0.05, 0.02, 0.11, 0.07, 0.01, 0.03], 0.1],
    [[0.2, 0.3], 1],
    [[0.2, 0.3], 1.5],
  ])('matches legacy for %j with fraction %d', (values, fraction) => {
    expect(medianFrac([...values], fraction)).toBe(legacy.medianFrac([...values], fraction));
  });
});

describe('splitRef / refSplit', () => {
  it.each([
    { isRelay: true, lapTimes: false },
    { isRelay: false, lapTimes: true },
    { isRelay: false, lapTimes: false },
  ])('matches legacy for %o', (flags) => {
    const viewer = createLegacyViewer({
      curClassIsRelay: flags.isRelay,
      curClassLapTimes: flags.lapTimes,
    });
    for (let i = -1; i < 8; i++) {
      expect(splitRef(i, flags)).toBe(viewer.splitRef(i));
      expect(refSplit(i, flags)).toBe(viewer.refSplit(i));
    }
  });
});

describe('updateClassSplitsBest', () => {
  const row = (start: number, place: string, leg: number, pass: number, legPlace: number) =>
    ({
      place,
      start,
      result: leg,
      status: 0,
      splits: { 0: 0, 999: leg, 1031: pass, '1031_place': legPlace, 101031: pass - start },
    }) as unknown as ResultRow;
  const splits: SplitControl[] = [0, 100000, 1031, 101031, 999].map((code, order) => ({
    code,
    order,
    name: String(code),
    updated: false,
  }));

  it('uses pass time stamps for relays and adds 24 h to starts before 06:00', () => {
    const results = [
      row(23 * 3600 * 100, '1', 360000, 23 * 3600 * 100 + 180000, 1),
      row(2 * 3600 * 100, '2', 300000, 2 * 3600 * 100 + 150000, 2),
      row(2 * 3600 * 100, '', 0, '' as unknown as number, 0),
    ];
    const flags = { isRelay: true, lapTimes: false, numSplits: 1 };
    const viewer = createLegacyViewer({
      curClassIsRelay: true,
      curClassLapTimes: false,
      curClassNumSplits: 1,
    });
    viewer.updateClassSplitsBest({ status: 'OK', splitcontrols: splits, results });
    const best = updateClassSplitsBest(results, splits, flags);
    expect(best).toEqual(viewer.curClassSplitsBests);
    expect(best[1]![1]).toBe(26 * 3600 * 100 + 300000);
  });

  it('skips zero split times like the legacy loose comparison', () => {
    const results = [
      { place: '1', result: 5000, splits: { 31: 0, '31_place': 1 } },
      { place: '2', result: 6000, splits: { 31: 2000, '31_place': 2 } },
    ] as unknown as ResultRow[];
    const single = [{ code: 31, order: 0, name: '31', updated: false }];
    const viewer = createLegacyViewer({ curClassNumSplits: 1 });
    viewer.updateClassSplitsBest({ status: 'OK', splitcontrols: single, results });
    const best = updateClassSplitsBest(results, single, {
      isRelay: false,
      lapTimes: false,
      numSplits: 1,
    });
    expect(best).toEqual(viewer.curClassSplitsBests);
    expect(best[0]).toEqual([2000]);
  });
});
