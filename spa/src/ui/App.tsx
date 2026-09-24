import { useEffect, useMemo } from 'react';
import { Time4oApi } from '../api/client';
import { resolveLanguage } from '../i18n';
import { createDisplay, DisplayContext } from './context';
import { LEFT_IN_FOREST, OrganizerView, START_REGISTRATION } from './Organizer';
import { RaceList } from './RaceList';
import { RaceView } from './RaceView';
import { ScrollView } from './ScrollView';
import { ThemeContext, useTheme } from './ThemeToggle';

export function App({
  api,
  search = window.location.search,
}: {
  api?: Time4oApi;
  search?: string;
}) {
  const params = new URLSearchParams(search);
  const comp = params.get('comp');
  const code = params.get('code');
  const scroll = params.has('scroll');
  const lang = resolveLanguage(params.get('lang'));
  const theme = useTheme(params.get('theme'));
  const display = useMemo(() => createDisplay(lang, api ?? new Time4oApi()), [lang, api]);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  return (
    <DisplayContext value={display}>
      <ThemeContext value={theme}>
        {comp && (code == LEFT_IN_FOREST || code == START_REGISTRATION) ? (
          <OrganizerView raceId={comp} code={code} params={params} />
        ) : comp && scroll ? (
          <ScrollView raceId={comp} search={search} />
        ) : comp ? (
          <RaceView raceId={comp} />
        ) : (
          <RaceList />
        )}
      </ThemeContext>
    </DisplayContext>
  );
}
