import { useEffect, useMemo } from 'react';
import { Time4oApi } from '../api/client';
import { resolveLanguage } from '../i18n';
import { createDisplay, DisplayContext } from './context';
import { RaceList } from './RaceList';
import { RaceView } from './RaceView';

export function App({
  api,
  search = window.location.search,
}: {
  api?: Time4oApi;
  search?: string;
}) {
  const params = new URLSearchParams(search);
  const comp = params.get('comp');
  const lang = resolveLanguage(params.get('lang'));
  const display = useMemo(() => createDisplay(lang, api ?? new Time4oApi()), [lang, api]);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  return (
    <DisplayContext value={display}>
      {comp ? <RaceView raceId={comp} /> : <RaceList />}
    </DisplayContext>
  );
}
