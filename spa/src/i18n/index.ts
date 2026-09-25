import type { TimeLabels } from '../domain/format';
import bg from './lang/bg.json';
import cz from './lang/cz.json';
import de from './lang/de.json';
import en from './lang/en.json';
import es from './lang/es.json';
import fi from './lang/fi.json';
import fr from './lang/fr.json';
import hu from './lang/hu.json';
import it from './lang/it.json';
import no from './lang/no.json';
import pl from './lang/pl.json';
import pt from './lang/pt.json';
import ru from './lang/ru.json';
import sv from './lang/sv.json';

export type Resources = Record<string, string>;

export const DEFAULT_LANGUAGE = 'no';

// The lang/*.json files are generated from web/templates; strings only the SPA needs live here.
const spaStrings: Record<string, Resources> = {
  en: {
    _ALLCLASSES: 'All classes',
    _STARTLIST: 'Start list',
    _NORUNNERS: 'No runners in this class',
    _LINK: 'Link',
    _LOADERROR: 'Could not load data from Time4o',
    _RUNNERCOUNT: 'Finished / total',
    _LEFTINFOREST: 'Left in forest',
    _STARTREGISTRATION: 'Start registration',
    _STARTTIME: 'Start time',
    _ECARD: 'E-card',
    _FILTER: 'Filter',
    _NOW: 'Now',
    _BEFORE: 'Before',
    _CALL: 'Call',
    _AFTER: 'After',
    _MINBIB: 'Min №',
    _MAXBIB: 'Max №',
    _STARTTYPE: 'Type',
    _TIMEDSTART: 'Timed start',
    _OPENSTART: 'Free start',
    _SWITCHSTARTTYPE: 'Switch start type',
    _SOUND: 'Sound on/off',
    _COUNT: 'Count',
    _THEME: 'Theme',
    _THEMEAUTO: 'as the device',
    _THEMELIGHT: 'light',
    _THEMEDARK: 'dark',
    _THEMECLASSIC: 'classic',
    _CLOSETAB: 'Close',
    _SEARCH: 'Search for runner, club or class',
    _NOMATCH: 'No matches',
    _CLUBS: 'Clubs',
    _RUNNERS: 'Runners',
    _COLUMNS: 'Classes side by side',
    _FREEZE: 'Freeze place and name',
    _TAGLINE: 'Live results for orienteering',
    _TODAYSRACES: "Today's races",
    _NORACESTODAY: 'No races today',
    _LIVE: 'Live',
    _STARTSAT: 'Starts',
    _LANGUAGE: 'Language',
    _RECENTRACES: 'Recent races',
    _RECENTINFO: 'Races from the last seven days',
    _UPCOMINGRACES: 'Upcoming races',
    _UPCOMINGINFO: 'Races in the next seven days',
    _ALLRACES: 'All races',
    _ALLRACESINFO: 'Search and browse races, year by year',
    _SEARCHRACE: 'Search for race or organiser',
    _YEAR: 'Year',
    _RACES: 'races',
    _PAGE: 'Page',
    _PREVIOUS: 'Previous',
    _NEXT: 'Next',
    _SHOWALL: 'Show all',
    _SHOWFEWER: 'Show fewer',
    _WOMEN: 'Women',
    _MEN: 'Men',
    _OTHERCLASSES: 'Other classes',
    _RECENTCLASSES: 'Opened recently',
    _ALLCONTROLS: 'All controls',
    _CONTROL: 'Control',
    _CLASSESCOUNT: 'classes',
    _WHERE: 'Where',
    _PASSTIME: 'Time of day',
    _NOPASSINGS: 'No passings yet',
    _CLASSES: 'Classes',
  },
  no: {
    _ALLCLASSES: 'Alle klasser',
    _STARTLIST: 'Startliste',
    _NORUNNERS: 'Ingen løpere i valgt klasse',
    _LINK: 'Lenke',
    _LOADERROR: 'Klarte ikke å hente data fra Time4o',
    _RUNNERCOUNT: 'I mål / totalt',
    _LEFTINFOREST: 'Ute i løypa',
    _STARTREGISTRATION: 'Startregistrering',
    _STARTTIME: 'Starttid',
    _ECARD: 'Brikke',
    _FILTER: 'Filter',
    _NOW: 'Nå',
    _BEFORE: 'Før',
    _CALL: 'Opprop',
    _AFTER: 'Etter',
    _MINBIB: 'Min №',
    _MAXBIB: 'Max №',
    _STARTTYPE: 'Type',
    _TIMEDSTART: 'Tidsstart',
    _OPENSTART: 'Fristart',
    _SWITCHSTARTTYPE: 'Bytt starttype',
    _SOUND: 'Lyd av/på',
    _COUNT: 'Antall',
    _THEME: 'Tema',
    _THEMEAUTO: 'som enheten',
    _THEMELIGHT: 'lyst',
    _THEMEDARK: 'mørkt',
    _THEMECLASSIC: 'klassisk',
    _CLOSETAB: 'Lukk',
    _SEARCH: 'Søk etter løper, klubb eller klasse',
    _NOMATCH: 'Ingen treff',
    _CLUBS: 'Klubber',
    _RUNNERS: 'Løpere',
    _COLUMNS: 'Klasser side om side',
    _FREEZE: 'Lås plass og navn',
    _TAGLINE: 'Liveresultater for orientering',
    _TODAYSRACES: 'Dagens løp',
    _NORACESTODAY: 'Ingen løp i dag',
    _LIVE: 'Live',
    _STARTSAT: 'Start',
    _LANGUAGE: 'Språk',
    _RECENTRACES: 'Siste løp',
    _RECENTINFO: 'Løp fra de siste sju dagene',
    _UPCOMINGRACES: 'Kommende løp',
    _UPCOMINGINFO: 'Løp de neste sju dagene',
    _ALLRACES: 'Alle løp',
    _ALLRACESINFO: 'Søk og bla i løp, år for år',
    _SEARCHRACE: 'Søk etter løp eller arrangør',
    _YEAR: 'År',
    _RACES: 'løp',
    _PAGE: 'Side',
    _PREVIOUS: 'Forrige',
    _NEXT: 'Neste',
    _SHOWALL: 'Vis alle',
    _SHOWFEWER: 'Vis færre',
    _WOMEN: 'Damer',
    _MEN: 'Herrer',
    _OTHERCLASSES: 'Andre klasser',
    _RECENTCLASSES: 'Sist åpnet',
    _ALLCONTROLS: 'Alle poster',
    _CONTROL: 'Post',
    _CLASSESCOUNT: 'klasser',
    _WHERE: 'Sted',
    _PASSTIME: 'Tidsp.',
    _NOPASSINGS: 'Ingen passeringer ennå',
    _CLASSES: 'Klasser',
  },
};

const languages: Record<string, Resources> = {
  bg,
  cz,
  de,
  en,
  es,
  fi,
  fr,
  hu,
  it,
  no,
  pl,
  pt,
  ru,
  sv,
};

export const LANGUAGES = Object.keys(languages);

/** Each language in its own words, for the language picker. */
export const LANGUAGE_NAMES: Record<string, string> = {
  bg: 'Български',
  cz: 'Čeština',
  de: 'Deutsch',
  en: 'English',
  es: 'Español',
  fi: 'Suomi',
  fr: 'Français',
  hu: 'Magyar',
  it: 'Italiano',
  no: 'Norsk',
  pl: 'Polski',
  pt: 'Português',
  ru: 'Русский',
  sv: 'Svenska',
};

export function resolveLanguage(lang: string | null | undefined): string {
  return lang && lang in languages ? lang : DEFAULT_LANGUAGE;
}

/** English is loaded first so strings missing in a translation fall back to it, like the PHP pages. */
export function resources(lang: string): Resources {
  const l = resolveLanguage(lang);
  return { ...en, ...spaStrings.en, ...languages[l], ...spaStrings[l] };
}

/** Status texts indexed by LiveRes status code, as `runnerStatus` in followfull.php. */
export function runnerStatus(res: Resources): Record<number, string> {
  return {
    0: res._STATUSOK ?? '',
    1: res._STATUSDNS ?? '',
    2: res._STATUSDNF ?? '',
    3: res._STATUSMP ?? '',
    4: res._STATUSDSQ ?? '',
    5: res._STATUSOT ?? '',
    6: res._STATUSNC ?? '',
    9: '',
    10: '',
    11: res._STATUSWO ?? '',
    12: res._STATUSMOVEDUP ?? '',
    13: res._STATUSFINISHED ?? '',
  };
}

export function timeLabels(res: Resources): TimeLabels {
  return {
    status: runnerStatus(res),
    freeStart: res._FREESTART ?? '',
    notShown: res._STATUSNOTSHOWN ?? '',
  };
}
