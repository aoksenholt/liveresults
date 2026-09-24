# AGENTS.md

Guidance for AI coding agents (Claude Code, Codex, Cursor, …) and humans working in this repository. `CLAUDE.md` only imports this file – edit here.

## Overview

LiveRes is a client–server system for publishing live orienteering results (fork of petlof/liveresults, published at liveres.live). It has two independent halves that meet only in a shared MySQL database:

1. **Windows client** (C#/.NET Framework 4.7.2, WinForms) – reads results from a local timing system and pushes them to the MySQL server.
2. **Web frontend** (PHP + jQuery/DataTables, in `web/`) – reads the same database and serves JSON to browser views that poll for updates.

## Commands

C# (Windows / Visual Studio or MSBuild; CI uses `.github/workflows/makeclient.yml`):
```
nuget restore LiveResults.Client.sln
msbuild LiveResults.Client.sln /p:Configuration=Release
```
Tests are NUnit 2.6.4 in `LiveResults.Client.Tests` (see `.travis.yml` for the console-runner invocation). A single test can be run with the NUnit console `/run:<Namespace.Class.Method>` option or from the VS test explorer.

JavaScript lint/format (only tooling in `package.json`):
```
npx eslint web/js/liveresults.js
npx prettier --check web/js/<file>.js
```
ESLint config (`eslint.config.mjs`) only enforces 2-space indentation and warns on unused vars; cosmetic rules are off.

There is no build step for the web part – PHP and JS are served as-is. When changing a JS file, bump its `?v=YYYYMMDD` cache-busting query in the `<script>` tags of the PHP pages that include it (e.g. `web/index.php`).

## Client architecture (C#)

Projects in `LiveResults.Client.sln`: `LiveResults.Model`, `LiveResults.Client`, `LiveResults.Client.Tests`, `LiveResults.CasparClient` (CasparCG TV graphics), `H2Sharp`. `WOCEmmaClient/`, top-level `LiveResSimulator/` and `loadtester/` are legacy copies not in the solution (current tools live in `tools/`).

- **Parsers** (`LiveResults.Client/Parsers/`) implement `IExternalSystemResultParser` (or the extended `IExternalSystemResultParserEtiming`, which adds merge events for radio controls, course data and vacants). Each parser polls one timing system (eTiming, Brikkesys, OLA, MeOS, SSFTiming, OE/OS CSV, IOF XML, Racom, …) and raises `OnResult`/`OnRadioControl`/`OnDeleteID` events.
- **Wizard forms** (`New*Comp.cs`, `FrmNewCompetition.cs`) collect connection settings, construct the parser and hand it to the monitor (`FrmMonitor`), which subscribes to parser events and forwards them to one or more `EmmaMysqlClient` instances.
- **`LiveResults.Model/EmmaMysqlClient.cs`** keeps an in-memory copy of all runners for a competition (loaded on `Start()`), diffs incoming data against it, queues changed items, and a background thread writes them to MySQL with `REPLACE INTO`. Only changes are uploaded.
- eTiming and Brikkesys are the main actively developed integrations in this fork (see README feature list).

## Data model conventions

Shared by client, PHP and JS (see `Doc/createOnlineDatabase.sql.txt`; schema changes are appended to `web/dbupgrade/dbmodelupdates.txt`):
- Competition id is `tavid` (`comp` in the API). Runners are keyed by `dbid`.
- The `results` table stores one row per (runner, control). Special control codes: `100` = start time, `1000` = finish; other values are radio-control codes (configured per class in `splitcontrols`).
- Times are integers in **hundredths of a second**; start times are hundredths since midnight in the event's local time zone.
- Status codes: 0 OK, 1 DNS, 2 DNF, 3 MP, 4 DSQ, 5 OT, 9/10 not yet finished (still in forest / not started), 11 WO, 12 moved up, 13 finished (no-time/no-rank classes). See `$RunnerStatus` in `web/api/api.php`.

## Web architecture

- `web/templates/classEmma.class.php` – all DB access (the `Emma` class). DB credentials in `web/templates/config.php`.
- `web/api/api.php` – single JSON endpoint dispatched on `?method=` (`getclasses`, `getclassresults`, `getlastpassings`, `getrunners`, …). Responses carry a `hash`; clients send `last_hash` and get `NOT MODIFIED` when nothing changed. Per-method HTTP cache times are set at the top of the file. `messageapi.php` and `radioapi.php` serve the message system and radio/speaker/start views.
- `web/js/liveresults.js` – the `LiveResults.AjaxViewer` class (namespace `LiveResults.Instance`) driving all views via `setTimeout` polling loops. `liveresults.common.js` and `liveresults.radio.js` extend `AjaxViewer.prototype` with shared helpers and organizer views (radio, speaker, start, left-in-forest).
- **Time4o support**: `AjaxViewer` has an `EmmaServer` flag. When false, data comes from the Time4o API instead of `api.php`, and `liveresults.time4o.js` converts Time4o payloads into the LiveRes JSON format so the rest of the rendering code is shared. Changes to rendering must work for both sources.
- Pages: `index.php` (main results), `followfull.php`, `radio.php` (organizer views), `startlist.php`, `ecardchange.php`, `message.php`; admin in `web/adm/`.
- UI strings are in `web/templates/emmalang_<lang>.php`; `emmalang_en.php` is always loaded first as fallback, then the requested language (default `no`). New strings must be added to at least `en` and `no`.
- `web/dt/` is a vendored DataTables bundle – don't edit.

## Conventions

- Commit messages use Conventional Commits (`feat:`, `fix:`, optionally scoped like `fix(Brikkesys):`).
- User guide (Norwegian) is in `docs/guide_no.md` (GitHub Pages).

## Time4o SPA (in progress – `spa/`)

The phased plan and progress are in `spa/PLAN.md` (Norwegian); tick off steps there when they are done.

A standalone React SPA that shows live results for **Time4o races only**, inspired by [mattias242/liveresults](https://github.com/mattias242/liveresults) (which forks petlof upstream, not this repo – its code targets the old `web/api.php` and cannot be copied as-is). It talks directly to the public Time4o API from the browser; it does **not** use the C# client, MySQL or any PHP in this repo. The legacy site in `web/` is untouched and keeps working.

Stack: React + TypeScript + Vite + Vitest + Testing Library, Node 24 (`spa/.node-version`, used by CI and Cloudflare). Hosted as static files on Cloudflare Pages (root `spa`, build `npm run build`, output `dist`); response headers are in `spa/public/_headers` – extend the CSP `connect-src` if the SPA calls a new host. CI: `.github/workflows/spa.yml`.
```
cd spa
npm ci
npm run dev        # dev server
npm test           # vitest run
npx vitest run src/domain/time4o.test.ts   # single test file
npm run typecheck
npm run lint
npm run format       # prettier
npm run record-fixtures   # re-record src/api/__fixtures__ from live Time4o races
npm run build      # static output in spa/dist
```

### Time4o API (`https://center.time4o.com/api/v1/`, public, CORS `*`)
- `race` – all races (`id` is a UUID, `eventForm`: Individual/Relay, `event.timezone`).
- `race/{id}/raceClass` – classes with `intermediateControls` (keyed `"<code>-<counter>"`), relay `legs`, `startType` (Chasing = chase start), `resultListMode` (Unordered/UnorderedNoTimes = no rank / no times), `timingResolution`.
- `race/{id}/entry[?raceClassId=|?organisationId=]` – entries with `time.time` in **milliseconds**, `time.behind`, `position`, `status.status`, ISO start/finish times with offset, `intermediateTimes`, `start.bibNo`. Responses carry an `ETag`; the legacy code sends `If-None-Match`.
- The legacy converter `web/js/liveresults.time4o.js` is the reference for how these map to results (control code = `id + counter*1000`, negated for unordered classes; relay legs become `<class>-<leg>`; exchange controls are `code + 100000`). Port it with tests against recorded fixtures before changing behaviour.

### Layering (keep React out of the lower layers)
- `src/api/` – typed Time4o client with ETag handling, `fetch` injected for tests. Time4o only answers 304 when `If-None-Match` carries the ETag **unquoted**. Fixtures recorded from real races (names anonymised) live in `src/api/__fixtures__/`.
- `src/domain/` – pure logic ported from `liveresults.js` / `liveresults.common.js` / `liveresults.time4o.js`: normalization (`time4o.ts`), formatting (`format.ts`), sorting, virtual ranking, split places and qualification limits (`ranking.ts`), radio-control quality check and split estimation (`radio.ts`), running times and predicted order (`predicted.ts`), the legacy class-processing order (`pipeline.ts`), and what the legacy DataTables/HTML rendering produced: class table columns, cells and highlights (`classTable.ts`), class menu (`classList.ts`), relay teams (`relay.ts`), all-classes/start/sprint/club lists (`lists.ts`), the left-in-forest and start registration views of `liveresults.radio.js` (`organizer.ts`), the "last passings" box, which follows the legacy `getLastPassings` SQL since Time4o has no such endpoint (`passings.ts`), the classes of the scrolling `followallscroll.php` page (`scroll.ts`), and the race list (`races.ts`). Cell HTML is built from numbers only; names and clubs from the API are rendered as text by React.
- `src/i18n/` – `lang/*.json` generated from `web/templates/emmalang_*.php` with `npm run convert-lang`; strings only the SPA needs are in `index.ts`.
- `src/state/` – framework-agnostic polling controllers (one per view) exposing a `Store` for `useSyncExternalStore`.
- `src/ui/` – React components; views are chosen by the legacy hash links (`route.ts`), and the organizer views by the `code` parameter of `radio.php` (`-2` left in forest, `0` start registration); `?comp=<uuid>&scroll` is the scrolling page of `followallscroll.php`. `App.test.tsx` renders the app against a fake `fetch` serving the fixtures. Colours are CSS variables in `styles.css`. The default look (`data-look='new'`, after the beta of the new liveresultat.orientering.se) has light and dark variants (`data-theme`), following `prefers-color-scheme` unless the toggle (`ThemeToggle.tsx`) or `?theme=auto|light|dark` picks one, remembered in `localStorage`. `?theme=classic` gives the legacy look, which the new-look rules must not change.

### Rules
- Tests are required for `src/api` and `src/domain`; UI tests are optional.
- Domain tests are **parity tests** (shared fixtures, fixture variants and the legacy class setup are in `src/test/fixtures.ts`): `src/test/legacy.ts` loads the legacy viewer from `web/js/` and each ported function must give the same output on the fixtures. If a legacy file changes, the SPA tests catch drift. Intentional deviations (e.g. legacy throwing on numeric `firstStart`) must be kept out of the fixture parity cases.
- Keep old URL semantics where they map (`followfull.php?time4o&comp=<uuid>` → `spa/?comp=<uuid>`, hash links for class/club).
- Out of scope (need the LiveRes DB/C# client): split-time analysis (`getclasscoursesplits`), radio/speaker views via `radioapi.php`, messages, ecard checks and change.
