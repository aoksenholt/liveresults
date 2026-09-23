// Records anonymised Time4o API responses used as test fixtures.
// Usage: npm run record-fixtures
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = 'https://center.time4o.com/api/v1/';
const OUT = join(dirname(fileURLToPath(import.meta.url)), '../src/api/__fixtures__');
const MAX_ENTRIES = 25;

const FIXTURES = [
  { name: 'interval', race: 'a2a5f649-6852-496e-affc-4255b7daeac8', className: 'H 16' },
  { name: 'mass-start', race: 'a1fb87a3-4d5d-4936-9570-add1e64ab13b', className: 'D/H-16 (3 km)' },
  { name: 'chase', race: 'a2a5faf3-b4ad-4a3b-9a81-303021d04239', className: 'H 21-' },
  { name: 'unordered', race: 'a273d43e-e99a-4abd-84c5-e1bc73198883', className: 'H 9-10' },
  {
    name: 'unordered-no-times',
    race: 'a2be8026-147e-4f2b-8299-1580c37a1320',
    className: 'Nybegynner',
  },
  { name: 'lap-times', race: 'a2b0e4f8-a5dd-4d38-8351-fca52d62d2ad', className: 'H 11-12' },
  { name: 'relay', race: 'a2a5f738-8332-4ea1-ae2b-2a85ccf1d7ac', className: 'H17-20', relay: true },
];

async function get(path) {
  const resp = await fetch(BASE + path);
  if (!resp.ok) throw new Error(`${resp.status} ${path}`);
  return resp.json();
}

// Names and card numbers are personal data; replace them deterministically so tests stay stable.
function anonymise(entries) {
  const names = new Map();
  return entries.map((e) => {
    const copy = structuredClone(e);
    if (copy.person) {
      const key = copy.person.id ?? copy.person.name;
      if (!names.has(key)) names.set(key, `Løper ${names.size + 1}`);
      copy.person.name = names.get(key);
    }
    for (const card of Object.values(copy.cards ?? {})) {
      if (card && card.cardNo) card.cardNo = String(1000000 + names.size);
    }
    return copy;
  });
}

// Keep the best finishers plus a few runners still on course or not started,
// so every status branch is represented without committing huge files.
function trim(entries) {
  const finished = entries
    .filter((e) => e.position != null || e.overallResult?.position != null)
    .sort(
      (a, b) => (a.position ?? a.overallResult.position) - (b.position ?? b.overallResult.position),
    );
  const rest = entries.filter((e) => !finished.includes(e));
  return [...finished.slice(0, MAX_ENTRIES), ...rest.slice(0, 5)];
}

function trimTeams(entries) {
  const teams = [...new Set(entries.filter((e) => e.team).map((e) => e.team.id))].slice(0, 12);
  return entries.filter((e) => teams.includes(e.team?.id));
}

await mkdir(OUT, { recursive: true });
for (const f of FIXTURES) {
  const race = (await get(`race/${f.race}`)).data;
  const classes = (await get(`race/${f.race}/raceClass`)).data;
  const cls = classes.find((c) => c.name === f.className);
  if (!cls) throw new Error(`Class ${f.className} not found in ${f.race}`);
  const classId = f.relay ? `${cls.id}.all` : cls.id;
  const entries = (await get(`race/${f.race}/entry?raceClassId=${classId}`)).data;
  const kept = f.relay ? trimTeams(entries) : trim(entries);
  const fixture = { race, raceClass: cls, entries: anonymise(kept) };
  await writeFile(join(OUT, `${f.name}.json`), JSON.stringify(fixture, null, 1) + '\n');
  console.log(`${f.name}: ${kept.length}/${entries.length} entries`);
}
