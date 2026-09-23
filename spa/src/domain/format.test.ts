import { createLegacyViewer } from '../test/legacy';
import {
  classShort,
  clubShort,
  findRank,
  formatTime,
  languageTimeStyle,
  nameShort,
  textLimits,
  type TimeLabels,
} from './format';

const labels: TimeLabels = {
  status: { 1: 'DNS', 2: 'DNF', 3: 'MP', 4: 'DSQ' },
  freeStart: 'Fri start',
  notShown: 'OK',
};

const legacyFor = (language: string, maxNameLength = 30, maxClubLength = 20) =>
  createLegacyViewer({
    language,
    maxNameLength,
    maxClubLength,
    runnerStatus: labels.status,
    resources: { _FREESTART: labels.freeStart, _STATUSNOTSHOWN: labels.notShown },
  });

const TIMES = [
  0,
  5,
  99,
  100,
  5999,
  6000,
  123456,
  359999,
  360000,
  754321,
  100 * 3600 * 100 + 123456,
];

describe('formatTime', () => {
  describe.each(['no', 'en', 'sv', 'fi'])('legacy parity (%s)', (language) => {
    const legacy = legacyFor(language);
    const { showHours, padZeros } = languageTimeStyle(language);

    it.each([false, true])('formats times like the legacy viewer (tenths: %s)', (showTenths) => {
      for (const time of TIMES) {
        expect(formatTime(time, 0, labels, language, { showTenths })).toBe(
          legacy.formatTime(time, 0, showTenths, showHours, padZeros),
        );
      }
    });

    it('formats clock times like the legacy viewer', () => {
      expect(
        formatTime(3600000 - 100, 0, labels, language, { clockTime: true, showHours: true }),
      ).toBe(legacy.formatTime(3600000 - 100, 0, false, true, padZeros, true));
    });
  });

  it('shows status text for non-OK status', () => {
    expect(formatTime(123456, 3, labels, 'no')).toBe('MP');
  });

  it('handles the special time values', () => {
    expect(formatTime(-999, 0, labels, 'no')).toBe('Fri start');
    expect(formatTime(-1, 0, labels, 'no')).toBe('');
    expect(formatTime(-10, 0, labels, 'no')).toBe('OK');
    expect(formatTime(-3, 0, labels, 'no')).toBe('*');
  });

  it('marks restarted times', () => {
    expect(formatTime(100 * 3600 * 100 + 6000, 0, labels, 'en')).toBe('01:00<small>*</small>');
  });

  it('uses Norwegian style with hours and no leading zero', () => {
    expect(formatTime(6000, 0, labels, 'no')).toBe('1:00');
    expect(formatTime(360000 + 6000, 0, labels, 'no')).toBe('1:01:00');
    expect(formatTime(360000 + 6000, 0, labels, 'en')).toBe('61:00');
  });
});

const NAMES = [
  'Ola Nordmann',
  'Kari Nordmann Hansen',
  'Per Olav Kristian Mathisen-Bergersen',
  'Anne-Marie Svendsen-Johannessen 2',
  'Madonna',
];

const CLUBS = [
  'Bækkelagets SK',
  'Nydalens Skiklub',
  'Fossum Idrettsforening',
  'Konnerud IL 1',
  'Oppsal Orienteringslag',
  'Lillomarka Orienteringslag 2',
  'Asker Skiklubb og omegn IF',
  '<del>Heming Orienteringsklubb</del>',
  'University of Oslo Sports Club Orientering',
];

describe.each(Object.entries({ mobile: textLimits('mobile'), desktop: textLimits('desktop') }))(
  'text shorteners, legacy parity (%s)',
  (_device, { maxNameLength, maxClubLength }) => {
    const legacy = legacyFor('no', maxNameLength, maxClubLength);

    it.each(NAMES)('shortens name %s like the legacy viewer', (name) => {
      expect(nameShort(name, maxNameLength)).toBe(legacy.nameShort(name));
    });

    it.each(CLUBS)('shortens club %s like the legacy viewer', (club) => {
      expect(clubShort(club, maxClubLength)).toBe(legacy.clubShort(club));
    });
  },
);

describe('classShort', () => {
  it('abbreviates Norwegian class names like the legacy viewer', () => {
    const legacy = legacyFor('no');
    for (const name of ['Menn senior', 'Damer 21', 'Gutter 13-16', 'Veteraner 60', 'Jenter Vann'])
      expect(classShort(name)).toBe(legacy.classShort(name));
  });
});

describe('findRank', () => {
  it('returns the 1-based rank in an ascending list', () => {
    expect(findRank([10, 20, 30], 5)).toBe(1);
    expect(findRank([10, 20, 30], 25)).toBe(3);
    expect(findRank([10, 20, 30], 20)).toBe(2);
  });
});
