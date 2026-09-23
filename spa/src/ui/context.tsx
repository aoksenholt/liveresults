import { createContext, useContext } from 'react';
import type { Time4oApi } from '../api/client';
import { textLimits, type DisplayFormat } from '../domain/format';
import { resources, timeLabels, type Resources } from '../i18n';

export interface Display {
  lang: string;
  res: Resources;
  format: DisplayFormat;
  api: Time4oApi;
}

/** Legacy `isMobile`, which decides how much names and clubs are shortened. */
export function deviceType(): 'mobile' | 'tablet' | 'desktop' {
  if (
    navigator.userAgent.match(/iPad/i) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  )
    return 'tablet';
  if (navigator.userAgent.match(/Mobi/)) return 'mobile';
  if (window.screen.width < 1366) return 'mobile';
  return 'desktop';
}

export function createDisplay(lang: string, api: Time4oApi): Display {
  const res = resources(lang);
  return {
    lang,
    res,
    api,
    format: { labels: timeLabels(res), language: lang, ...textLimits(deviceType()) },
  };
}

export const DisplayContext = createContext<Display | null>(null);

export function useDisplay(): Display {
  const display = useContext(DisplayContext);
  if (!display) throw new Error('useDisplay outside DisplayContext');
  return display;
}
