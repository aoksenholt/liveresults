import { parseHash, routeHash, type Route } from './route';

describe('hash routes', () => {
  it.each<[string, Route]>([
    ['', { kind: 'none' }],
    ['#', { kind: 'none' }],
    ['#H21', { kind: 'class', className: 'H21' }],
    ['#H%2021%20Elite', { kind: 'class', className: 'H 21 Elite' }],
    ['#Stafett-2', { kind: 'class', className: 'Stafett-2' }],
    ['#club::1234', { kind: 'club', clubId: '1234' }],
    ['#relay::H17-1', { kind: 'relay', className: 'H17-1' }],
    ['#startlist', { kind: 'startlist' }],
    ['#plainresults', { kind: 'plainresults' }],
    ['#plainresultsclass_H21 Sprint', { kind: 'sprint', key: 'H21 Sprint' }],
    ['#splits::H21::course::1', { kind: 'none' }],
    ['#50%', { kind: 'class', className: '50%' }],
  ])('parses %s', (hash, route) => {
    expect(parseHash(hash)).toEqual(route);
  });

  it.each<Route>([
    { kind: 'class', className: 'H 21 | Kvart #1' },
    { kind: 'club', clubId: '17' },
    { kind: 'relay', className: 'D 17-1' },
    { kind: 'sprint', key: 'H21 | Sprint' },
    { kind: 'startlist' },
    { kind: 'plainresults' },
  ])('round-trips %o', (route) => {
    expect(parseHash(routeHash(route))).toEqual(route);
  });
});
