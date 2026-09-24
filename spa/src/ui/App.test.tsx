import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { Time4oApi } from '../api/client';
import type { Entry, Race } from '../api/types';
import { localDate } from '../domain/races';
import { FIXTURES, midRace } from '../test/fixtures';
import { App } from './App';

const interval = FIXTURES.interval!;
const relay = FIXTURES.relay!;
const race: Race = {
  id: 'race-1',
  date: '2020-05-01T00:00:00Z',
  title: 'Testløpet',
  event: { organisers: [{ name: 'OK Test' }], timezone: 'Europe/Oslo' },
  identifierType: 'Norway',
  identifier: '123',
};
const allEntries = [...interval.entries, ...relay.entries];

function fakeApi(entries = allEntries, raceInfo = race, races = [raceInfo]) {
  const json = (data: unknown) =>
    Promise.resolve(new Response(JSON.stringify({ data }), { status: 200 }));
  return new Time4oApi('https://t/', (url) => {
    const u = new URL(url);
    const path = u.pathname;
    if (path == '/race') return json(races);
    if (path == '/race/race-1') return json(raceInfo);
    if (path == '/race/race-1/raceClass') return json([interval.raceClass, relay.raceClass]);
    if (path == '/race/race-1/entry') {
      const classId = u.searchParams.get('raceClassId');
      const orgId = u.searchParams.get('organisationId');
      const matches = (e: Entry) =>
        classId
          ? e.raceClassId == classId || classId == `${relay.raceClass.id}.all`
          : orgId
            ? String(e.organisation?.id) == orgId
            : true;
      return json(entries.filter(matches));
    }
    return Promise.resolve(new Response('', { status: 404 }));
  });
}

function renderRace(hash: string) {
  window.location.hash = hash;
  return render(<App api={fakeApi()} search="?comp=race-1&lang=no" />);
}

afterEach(() => {
  window.location.hash = '';
  localStorage.clear();
});

describe('App', () => {
  it('lists races with links to the race page in the classic look', async () => {
    render(<App api={fakeApi()} search="?lang=no&theme=classic" />);
    const link = await screen.findByRole('link', { name: 'Testløpet' });
    expect(link).toHaveAttribute('href', '?comp=race-1&lang=no');
    expect(screen.getByText('Velg løp')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Lenke' })).toHaveAttribute(
      'href',
      'https://eventor.orientering.no/Events/Show/123',
    );
  });

  it('finds races by year or search on the front page', async () => {
    const races = [
      race,
      { ...race, id: 'race-2', title: 'Vårløpet', date: '2021-04-01T00:00:00Z' },
      { ...race, id: 'race-3', title: 'Høstløpet', date: '2021-10-01T00:00:00Z' },
    ];
    render(<App api={fakeApi(allEntries, race, races)} search="?lang=no" />);
    const all = (await screen.findByRole('heading', { name: 'Alle løp' })).closest('section')!;
    const names = () =>
      within(all)
        .queryAllByRole('link', { name: /løpet$/ })
        .map((a) => a.textContent);
    expect(names()).toEqual(['Høstløpet', 'Vårløpet']);
    expect(within(all).getByText('2 løp 2021')).toBeInTheDocument();
    fireEvent.click(within(all).getByRole('button', { name: '2020' }));
    expect(names()).toEqual(['Testløpet']);
    expect(within(all).getByRole('link', { name: 'Eventor' })).toHaveAttribute(
      'href',
      'https://eventor.orientering.no/Events/Show/123',
    );
    fireEvent.change(within(all).getByRole('searchbox'), { target: { value: 'ok test' } });
    expect(names()).toEqual(['Høstløpet', 'Vårløpet', 'Testløpet']);
    fireEvent.change(within(all).getByRole('searchbox'), { target: { value: 'zzzz' } });
    expect(within(all).getByText('Ingen treff')).toBeInTheDocument();
  });

  it("shows today's races in a card on the front page", async () => {
    const today = { ...race, date: `${localDate(Date.now())}T00:00:00Z` };
    render(<App api={fakeApi(allEntries, today)} search="?lang=no" />);
    expect(
      screen.getByRole('heading', { name: 'Liveresultater for orientering' }),
    ).toBeInTheDocument();
    const card = (await screen.findByRole('heading', { name: 'Dagens løp' })).closest('section')!;
    expect(await within(card).findByRole('link', { name: 'Testløpet' })).toBeInTheDocument();
    expect(within(card).getByText('Live')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Språk' })).toHaveValue('no');
  });

  it('shows the class menu and asks for a class', async () => {
    renderRace('');
    expect(await screen.findByRole('link', { name: interval.raceClass.name })).toHaveAttribute(
      'href',
      `#${encodeURI(interval.raceClass.name!)}`,
    );
    expect(screen.getByRole('link', { name: 'Alle klasser' })).toBeInTheDocument();
    expect(screen.getByText('Testløpet')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Velg løp' })).toHaveAttribute('href', '?lang=no');
  });

  it('shows the classes opened last above the class buttons', async () => {
    renderRace('');
    expect(await screen.findByRole('heading', { name: 'Velg klasse' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Sist åpnet' })).toBeNull();
    window.location.hash = `#${encodeURI(interval.raceClass.name!)}`;
    await screen.findByRole('combobox', { name: 'Velg klasse' });
    window.location.hash = '';
    const recent = (await screen.findByRole('heading', { name: 'Sist åpnet' })).closest('section')!;
    expect(within(recent).getByRole('link', { name: interval.raceClass.name })).toBeInTheDocument();
    expect(localStorage.getItem('liveres-recent-race-1')).toBe(
      JSON.stringify([`#${encodeURI(interval.raceClass.name!)}`]),
    );
  });

  it('finds classes in the search', async () => {
    renderRace('');
    const search = await screen.findByRole('searchbox', {
      name: 'Søk etter løper, klubb eller klasse',
    });
    fireEvent.change(search, { target: { value: interval.raceClass.name!.toLowerCase() } });
    const found = await screen.findByRole('region', {
      name: 'Søk etter løper, klubb eller klasse',
    });
    const classes = within(found).getByRole('heading', { name: 'Klasser' }).nextElementSibling!;
    expect(
      within(classes as HTMLElement).getByRole('link', { name: interval.raceClass.name }),
    ).toHaveAttribute('href', `#${encodeURI(interval.raceClass.name!)}`);
  });

  it('opens chosen classes as tabs in the new look', async () => {
    renderRace('');
    expect(await screen.findByRole('heading', { name: 'Velg klasse' })).toBeInTheDocument();
    fireEvent.click(await screen.findByRole('link', { name: interval.raceClass.name }));
    window.location.hash = `#${encodeURI(interval.raceClass.name!)}`;
    const select = await screen.findByRole('combobox', { name: 'Velg klasse' });
    fireEvent.change(select, { target: { value: '#plainresults' } });
    expect(await screen.findByRole('heading', { name: 'Alle klasser' })).toBeInTheDocument();
    const close = screen.getAllByRole('button', { name: /^Lukk / });
    expect(close.map((b) => b.getAttribute('aria-label'))).toEqual([
      `Lukk ${interval.raceClass.name}`,
      'Lukk Alle klasser',
    ]);
    fireEvent.click(close[1]!);
    expect(window.location.hash).toBe(`#${encodeURI(interval.raceClass.name!)}`);
    fireEvent.click(await screen.findByRole('button', { name: `Lukk ${interval.raceClass.name}` }));
    expect(await screen.findByRole('heading', { name: 'Velg klasse' })).toBeInTheDocument();
  });

  it('finds runners and clubs in the whole race', async () => {
    renderRace('');
    const unique = (e: Entry) =>
      allEntries.filter((o) => o.person?.name == e.person?.name).length == 1;
    const runner = relay.entries.find((e) => e.person?.name && e.organisation?.id && unique(e))!;
    const club = runner.organisation!;
    const search = await screen.findByRole('searchbox', {
      name: 'Søk etter løper, klubb eller klasse',
    });
    fireEvent.change(search, { target: { value: runner.person!.name } });
    const found = await screen.findByRole('region', {
      name: 'Søk etter løper, klubb eller klasse',
    });
    const link = await within(found).findByRole('link', { name: runner.person!.name });
    expect(link.getAttribute('href')).toMatch(/^#H17-20-\d$/);
    const href = link.getAttribute('href')!;
    fireEvent.click(link);
    expect(search).toHaveValue('');
    window.location.hash = href;
    const row = await waitFor(() => {
      const found = document.querySelector('tr.found');
      expect(found).not.toBeNull();
      return found!;
    });
    expect(row).toHaveTextContent(runner.person!.name!);
    // jsdom has no AnimationEvent, so React listens for the prefixed event.
    fireEvent(row.firstElementChild!, new Event('webkitAnimationEnd', { bubbles: true }));
    await waitFor(() => expect(document.querySelector('tr.found')).toBeNull());
    fireEvent.change(search, { target: { value: 'zzzz' } });
    expect(await screen.findByText('Ingen treff')).toBeInTheDocument();
    fireEvent.change(search, { target: { value: club.name } });
    expect(
      await within(screen.getByRole('region')).findByRole('link', { name: club.name }),
    ).toHaveAttribute('href', `#club::${club.id}`);
  });

  it('has a class picker in each column when there is more than one', async () => {
    const h16 = `#${encodeURI(interval.raceClass.name!)}`;
    renderRace(h16);
    await screen.findByRole('table');
    window.location.hash = '#plainresults';
    expect(await screen.findByRole('heading', { name: 'Alle klasser' })).toBeInTheDocument();
    const columns = screen.getByRole('group', { name: 'Klasser side om side' });
    fireEvent.click(within(columns).getByRole('button', { name: '3' }));
    const pickers = screen.getAllByRole('combobox', { name: 'Velg klasse' });
    expect(pickers.map((p) => (p as HTMLSelectElement).value)).toEqual(['#plainresults', h16, '']);
    expect(await screen.findByRole('heading', { name: /^H 16/ })).toBeInTheDocument();
    expect(screen.getByText('Ingen klasse valgt!')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Lukk / })).not.toBeInTheDocument();
    fireEvent.change(pickers[2]!, { target: { value: '#startlist' } });
    expect(screen.queryByText('Ingen klasse valgt!')).not.toBeInTheDocument();
    fireEvent.click(within(columns).getByRole('button', { name: '1' }));
    expect(screen.getAllByRole('combobox', { name: 'Velg klasse' })).toHaveLength(1);
    expect(
      screen.getAllByRole('button', { name: /^Lukk / }).map((b) => b.getAttribute('aria-label')),
    ).toEqual([`Lukk ${interval.raceClass.name}`, 'Lukk Alle klasser', 'Lukk Startliste']);
  });

  it('shows class results with club links', async () => {
    renderRace(`#${interval.raceClass.name}`);
    const table = await screen.findByRole('table');
    const rows = within(table).getAllByRole('row');
    expect(rows.length).toBe(interval.entries.length + 1);
    const clubLink = within(table).getAllByRole('link')[0]!;
    expect(clubLink.getAttribute('href')).toMatch(/^#club::\d+$/);
  });

  it('freezes place and name when the user asks for it', async () => {
    renderRace(`#${encodeURI(interval.raceClass.name!)}`);
    const table = await screen.findByRole('table');
    const name = () => within(table).getByRole('columnheader', { name: 'Navn / Klubb' });
    expect(name()).not.toHaveClass('fixed-name');
    const freeze = screen.getByRole('button', { name: 'Lås plass og navn' });
    fireEvent.click(freeze);
    expect(freeze).toHaveAttribute('aria-pressed', 'true');
    expect(name()).toHaveClass('fixed-name');
    expect(localStorage.getItem('liveres-frozen')).toBe('1');
    fireEvent.click(freeze);
    expect(name()).not.toHaveClass('fixed-name');
  });

  it('opens the club of a runner in a tab named after the club', async () => {
    renderRace(`#${encodeURI(interval.raceClass.name!)}`);
    const table = await screen.findByRole('table');
    const clubLink = within(table).getAllByRole('link')[0]!;
    const href = clubLink.getAttribute('href')!;
    fireEvent.click(clubLink);
    window.location.hash = href;
    await waitFor(() =>
      expect(
        screen.getAllByRole('button', { name: /^Lukk / }).map((b) => b.getAttribute('aria-label')),
      ).toEqual([`Lukk ${interval.raceClass.name}`, `Lukk ${clubLink.textContent}`]),
    );
    const tabs = screen.getByRole('button', {
      name: `Lukk ${clubLink.textContent}`,
    }).parentElement!;
    expect(within(tabs).getByRole('link')).toHaveAttribute('href', href);
  });

  it('shows club results', async () => {
    const org = interval.entries.find((e) => e.organisation?.id != null)!.organisation!;
    renderRace(`#club::${org.id}`);
    const table = await screen.findByRole('table');
    const expected = allEntries.filter((e) => e.organisation?.id == org.id).length;
    expect(within(table).getAllByRole('row')).toHaveLength(expected + 1);
  });

  it('shows relay teams', async () => {
    const first = relay.raceClass.name!.replace(/-?$/, '-') + '1';
    renderRace(`#relay::${first}`);
    const table = await screen.findByRole('table');
    expect(within(table).getByText('±Tet')).toBeInTheDocument();
    expect(within(table).getAllByRole('row').length).toBeGreaterThan(1);
  });

  it('shows the list of all classes', async () => {
    renderRace('#plainresults');
    expect(await screen.findByRole('heading', { name: 'Alle klasser' })).toBeInTheDocument();
    expect(screen.getAllByText(interval.raceClass.name!).length).toBeGreaterThan(1);
  });

  it('shows runners left in forest with a filter', async () => {
    const live = midRace(allEntries);
    render(<App api={fakeApi(live)} search="?comp=race-1&code=-2&lang=no" />);
    const table = await screen.findByRole('table');
    const count = within(table).getAllByRole('row').length - 1;
    expect(count).toBeGreaterThan(1);
    expect(screen.getByText(`Antall: ${count}`)).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText('filter...'), { target: { value: 'zzzz' } });
    expect(within(table).getAllByRole('row')).toHaveLength(1);
  });

  it('shows the start registration with a link to free start', async () => {
    render(<App api={fakeApi()} search="?comp=race-1&code=0&calltime=4&lang=no" />);
    expect(await screen.findByText('Startregistrering')).toBeInTheDocument();
    expect(screen.getByText('Type: Tidsstart')).toBeInTheDocument();
    expect(await screen.findByRole('table')).toBeInTheDocument();
    const link = screen.getByRole('link', { name: /Bytt starttype/ });
    expect(link.getAttribute('href')).toMatch(/calltime=4.*&openstart$/);
  });

  it('shows the latest updates on live race pages', async () => {
    const today = { ...race, date: new Date(Date.now() - 3600000).toISOString() };
    render(<App api={fakeApi(allEntries, today)} search="?comp=race-1&lang=no" />);
    expect(await screen.findByText('Siste oppdateringer')).toBeInTheDocument();
    const box = screen.getByText('Siste oppdateringer').closest('section')!;
    expect(await within(box).findAllByText(/med tiden|fikk ny status/)).toHaveLength(3);
  });

  it('lets the user fold the latest updates into one line', async () => {
    const today = { ...race, date: new Date(Date.now() - 3600000).toISOString() };
    render(<App api={fakeApi(allEntries, today)} search="?comp=race-1&lang=no" />);
    const toggle = await screen.findByRole('button', { name: /^Siste oppdateringer/ });
    const box = toggle.closest('section')!;
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(await within(box).findAllByRole('link')).toHaveLength(3);
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(within(box).queryAllByRole('link')).toHaveLength(0);
    expect(toggle).toHaveTextContent(/med tiden|fikk ny status/);
    expect(localStorage.getItem('liveres-passings-collapsed')).toBe('1');
  });

  it('shows every class without splits on the scrolling page', async () => {
    render(<App api={fakeApi()} search="?comp=race-1&lang=no&scroll" />);
    const headers = await screen.findAllByRole('heading', { level: 2 });
    expect(headers.length).toBeGreaterThan(2);
    expect(headers[0]).toHaveTextContent(interval.raceClass.name!);
    expect(screen.queryByText('Siste oppdateringer')).not.toBeInTheDocument();
    const firstTable = screen.getAllByRole('table')[0]!;
    expect(
      within(firstTable)
        .getAllByRole('columnheader')
        .map((h) => h.textContent),
    ).toEqual(['#', 'Navn / Klubb', '№', 'Start', 'Mål', 'Diff']);
  });

  it('keeps separate name and club columns in the classic look', async () => {
    render(<App api={fakeApi()} search="?comp=race-1&lang=no&scroll&theme=classic" />);
    const firstTable = (await screen.findAllByRole('table'))[0]!;
    expect(
      within(firstTable)
        .getAllByRole('columnheader')
        .map((h) => h.textContent),
    ).toEqual(['#', 'Navn', 'Klubb', '№', 'Start', 'Mål', 'Diff']);
  });

  it('follows the device theme until the toggle picks one', async () => {
    localStorage.clear();
    const matchMedia = vi.fn(() => ({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
    vi.stubGlobal('matchMedia', matchMedia);
    try {
      renderRace('');
      const toggle = await screen.findByRole('button', { name: 'Tema: som enheten' });
      const root = document.documentElement.dataset;
      expect([root.look, root.theme]).toEqual(['new', 'dark']);
      fireEvent.click(toggle);
      expect(toggle).toHaveAccessibleName('Tema: lyst');
      expect([root.look, root.theme]).toEqual(['new', 'light']);
      fireEvent.click(toggle);
      expect(root.theme).toBe('dark');
      expect(localStorage.getItem('liveres-theme')).toBe('dark');
    } finally {
      vi.unstubAllGlobals();
      localStorage.clear();
    }
  });
});
