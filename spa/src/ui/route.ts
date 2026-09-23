export type Route =
  | { kind: 'none' }
  | { kind: 'class'; className: string }
  | { kind: 'club'; clubId: string }
  | { kind: 'relay'; className: string }
  | { kind: 'startlist' }
  | { kind: 'plainresults' }
  | { kind: 'sprint'; key: string };

const SPRINT_PREFIX = 'plainresultsclass_';

function decode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

/** Hash links of the legacy followfull.php; split time views are not supported. */
export function parseHash(hash: string): Route {
  const h = decode(hash.replace(/^#/, ''));
  if (!h) return { kind: 'none' };
  if (h == 'startlist') return { kind: 'startlist' };
  if (h == 'plainresults') return { kind: 'plainresults' };
  if (h.startsWith(SPRINT_PREFIX)) return { kind: 'sprint', key: h.slice(SPRINT_PREFIX.length) };
  if (h.startsWith('club::')) return { kind: 'club', clubId: h.slice(6) };
  if (h.startsWith('relay::')) return { kind: 'relay', className: h.slice(7) };
  if (h.startsWith('splits::')) return { kind: 'none' };
  return { kind: 'class', className: h };
}

const encode = (s: string) => '#' + encodeURI(s).replace(/#/g, '%23');

export function routeHash(route: Route): string {
  switch (route.kind) {
    case 'none':
      return '#';
    case 'class':
      return encode(route.className);
    case 'club':
      return encode(`club::${route.clubId}`);
    case 'relay':
      return encode(`relay::${route.className}`);
    case 'sprint':
      return encode(SPRINT_PREFIX + route.key);
    default:
      return encode(route.kind);
  }
}
