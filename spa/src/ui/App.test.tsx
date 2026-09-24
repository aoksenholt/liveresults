import { fireEvent, render, screen, within } from '@testing-library/react';
import { Time4oApi } from '../api/client';
import type { Entry, Race } from '../api/types';
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

function fakeApi(entries = allEntries) {
  const json = (data: unknown) =>
    Promise.resolve(new Response(JSON.stringify({ data }), { status: 200 }));
  return new Time4oApi('https://t/', (url) => {
    const u = new URL(url);
    const path = u.pathname;
    if (path == '/race') return json([race]);
    if (path == '/race/race-1') return json(race);
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
});

describe('App', () => {
  it('lists races with links to the race page', async () => {
    render(<App api={fakeApi()} search="?lang=no" />);
    const link = await screen.findByRole('link', { name: 'Testløpet' });
    expect(link).toHaveAttribute('href', '?comp=race-1&lang=no');
    expect(screen.getByText('Velg løp')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Lenke' })).toHaveAttribute(
      'href',
      'https://eventor.orientering.no/Events/Show/123',
    );
  });

  it('shows the class menu and asks for a class', async () => {
    renderRace('');
    const menu = await screen.findByRole('navigation');
    expect(
      await within(menu).findByRole('link', { name: interval.raceClass.name }),
    ).toHaveAttribute('href', `#${encodeURI(interval.raceClass.name!)}`);
    expect(within(menu).getByRole('link', { name: 'Alle klasser' })).toBeInTheDocument();
    expect(screen.getByText('Testløpet')).toBeInTheDocument();
  });

  it('shows class results with club links', async () => {
    renderRace(`#${interval.raceClass.name}`);
    const table = await screen.findByRole('table');
    const rows = within(table).getAllByRole('row');
    expect(rows.length).toBe(interval.entries.length + 1);
    const clubLink = within(table).getAllByRole('link')[0]!;
    expect(clubLink.getAttribute('href')).toMatch(/^#club::\d+$/);
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
});
