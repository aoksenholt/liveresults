import { RESTART_TIME_OFFSET } from './model';

export interface TimeLabels {
  status: Record<number, string>;
  freeStart: string;
  notShown: string;
}

export interface TimeFormat {
  showTenths?: boolean;
  showHours?: boolean;
  padZeros?: boolean;
  clockTime?: boolean;
}

export function languageTimeStyle(language: string) {
  const hoursStyle = language === 'fi' || language === 'no';
  return { showHours: hoursStyle, padZeros: !hoursStyle };
}

export function strPad(num: number | string, length: number): string {
  return String(num).padStart(length, '0');
}

/**
 * Formats hundredths of a second. Returns HTML (`<small>*</small>` marks a
 * restarted team), matching the legacy viewer.
 */
export function formatTime(
  time: number,
  status: number,
  labels: TimeLabels,
  language: string,
  format: TimeFormat = {},
): string {
  const defaults = languageTimeStyle(language);
  const showHours = format.showHours ?? defaults.showHours;
  const padZeros = format.padZeros ?? defaults.padZeros;
  const tenthSuffix = (tenth: number) => (format.showTenths ? '.' + tenth : '');

  if (status != 0) return labels.status[status] ?? '';
  if (time == -999) return labels.freeStart;
  if (time == -1) return '';
  if (time == -10) return labels.notShown;
  if (time < 0) return '*';

  let restart = '';
  if (time > RESTART_TIME_OFFSET) {
    restart = '<small>*</small>';
    time = time % RESTART_TIME_OFFSET;
  }

  if (showHours) {
    const hours = Math.floor(time / 360000);
    const minutes = Math.floor((time - hours * 360000) / 6000);
    const seconds = Math.floor((time - minutes * 6000 - hours * 360000) / 100);
    const tenth = Math.floor((time - minutes * 6000 - hours * 360000 - seconds * 100) / 10);
    if (hours > 0 || format.clockTime) {
      const h = padZeros ? strPad(hours, 2) : hours;
      return `${h}:${strPad(minutes, 2)}:${strPad(seconds, 2)}${tenthSuffix(tenth)}${restart}`;
    }
    const m = padZeros ? strPad(minutes, 2) : minutes;
    return `${m}:${strPad(seconds, 2)}${tenthSuffix(tenth)}${restart}`;
  }

  const minutes = Math.floor(time / 6000);
  const seconds = Math.floor((time - minutes * 6000) / 100);
  const tenth = Math.floor((time - minutes * 6000 - seconds * 100) / 10);
  const m = padZeros ? strPad(minutes, 2) : minutes;
  return `${m}:${strPad(seconds, 2)}${tenthSuffix(tenth)}${restart}`;
}

export function textLimits(device: 'mobile' | 'tablet' | 'desktop') {
  switch (device) {
    case 'mobile':
      return { maxNameLength: 15, maxClubLength: 12 };
    case 'tablet':
      return { maxNameLength: 22, maxClubLength: 15 };
    default:
      return { maxNameLength: 30, maxClubLength: 20 };
  }
}

export function classShort(className: string): string {
  return className
    .replace(/menn/i, 'M')
    .replace(/herrer/i, 'H')
    .replace(/kvinner/i, 'K')
    .replace(/damer/i, 'D')
    .replace(/gutter/i, 'G')
    .replace(/jenter/i, 'J')
    .replace(/veteran(er)?/i, 'Vet')
    .replace(' Vann', 'V');
}

export function nameShort(name: string, maxNameLength: number): string {
  if (!name) return '';
  const parts = name.split(' ');
  if (parts.length == 1) return name;

  let num = parts[parts.length - 1]!;
  if (/\d+/.test(num)) {
    parts.pop();
    num = ' ' + num;
  } else {
    num = '';
  }

  const last = parts[parts.length - 1]!;
  let shortName = parts[0] + ' ';
  for (let i = 1; i < parts.length - 1; i++) shortName += parts[i]!.charAt(0) + '.';
  if (shortName.length + last.length < maxNameLength) {
    shortName += ' ' + last;
  } else {
    const lastParts = last.split('-');
    const lastName =
      lastParts.length > 1
        ? lastParts[lastParts.length - 2]!.charAt(0) + '-' + lastParts[lastParts.length - 1]
        : lastParts[0];
    shortName += ' ' + lastName;
  }
  return shortName + num;
}

export function clubShort(club: string, maxClubLength: number): string {
  if (!club) return '';
  const del = /^<del>/i.test(club);
  let shortClub = club.replace(/<\/?del>/gi, '');
  if (shortClub.length <= maxClubLength) return club;

  shortClub = shortClub
    .replace(/orient[a-z]*/i, 'O.')
    .replace(/ski(?:klub|lag)[a-z]*/i, 'Sk.')
    .replace(/(?:og|&) omegn if/i, 'OIF')
    .replace(/(?:og|&) omegn il/i, 'OIL')
    .replace(/(?:og|&) omegn/i, '')
    .replace(/national team/i, 'NT')
    .replace(/sports?klubb[a-z]*/i, 'Spk.')
    .replace(/idretts?(?:forening|lag)[a-z]*/i, '')
    .replace(/skiskytt(?:e|a)r(?:forening|lag)[a-z]*/i, '')
    .replace(/university (?:of|college) /i, 'Un. ')
    .replace(/ ?- ?ski/i, '')
    .replace(/OL|OK|SK|IL/, '')
    .trim();

  const match = shortClub.match(/(-?\d+)$/);
  const suffix = match ? match[0] : '';
  const clubNameOnly = match ? shortClub.slice(0, match.index).trim() : shortClub;
  if (clubNameOnly.length > maxClubLength)
    shortClub = clubNameOnly.slice(0, maxClubLength) + '…' + suffix;
  if (del) shortClub = '<del>' + shortClub + '</del>';
  return shortClub;
}

export function findRank(sorted: number[], val: number): number {
  let rank = 1;
  for (const v of sorted) {
    if (v < val) rank++;
    else break;
  }
  return rank;
}

/** What list views need to format times and shorten names like the legacy viewer. */
export interface DisplayFormat {
  labels: TimeLabels;
  language: string;
  showTenths?: boolean;
  maxNameLength: number;
  maxClubLength: number;
}
