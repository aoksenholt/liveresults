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
  },
  no: {
    _ALLCLASSES: 'Alle klasser',
    _STARTLIST: 'Startliste',
    _NORUNNERS: 'Ingen løpere i valgt klasse',
    _LINK: 'Lenke',
    _LOADERROR: 'Klarte ikke å hente data fra Time4o',
    _RUNNERCOUNT: 'I mål / totalt',
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
