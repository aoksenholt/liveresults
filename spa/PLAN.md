# Plan for Time4o-SPA

En frittstående React-SPA i `spa/` som viser liveresultater for Time4o-løp direkte fra
Time4o-API-et. Den bruker ikke C#-klienten, MySQL eller PHP, og den gamle siden i `web/`
fortsetter å virke. Se `AGENTS.md` for arkitektur og regler.

Kryss av (`[x]`) etter hvert som steg blir fullført.

## Fase 0 – Oppsett ✅

- [x] `spa/` med Vite, React, TypeScript, Vitest og Testing Library (Node 24)
- [x] ESLint og Prettier
- [x] CI i `.github/workflows/spa.yml` som kjører format-sjekk, lint, typecheck, tester og bygg på alle brancher
- [x] Fork (`aoksenholt/liveresults`) med `upstream` = `palkitt/liveresults`

## Fase 1 – API og domenelogikk ✅

- [x] Typet Time4o-klient med ETag-håndtering (ETag sendes uten anførselstegn)
- [x] Testdata tatt opp fra ekte løp (`npm run record-fixtures`): intervallstart, fellesstart, jaktstart, stafett, rundetider og klasser uten plassering eller tider
- [x] Paritetstester som laster den gamle visningskoden fra `web/js/`
- [x] Portering av `liveresults.time4o.js` (normalisering), tidsformat, sortering, plassering underveis og plass på mellomtider

## Fase 2 – Visninger for publikum ✅

- [x] Gjenstående portering med paritetstester: `checkRadioControls`, beregnede tider for løpere som er ute, `updateClassSplitsBest` og kvalifiseringsgrenser
- [x] Portering av det den gamle siden tegnet: kolonner, celler og markeringer i klassetabellen, klassemenyen, stafettlag, lister (alle klasser, startliste, sprint, klubb) og løpslisten
- [x] Polling-kontrollere i `src/state/` som bare henter det som er endret
- [x] Språk: `emmalang_*.php` konvertert til JSON (`npm run convert-lang`)
- [x] Løpsliste som `index.php`
- [x] Løpsside med klassemeny og de gamle hash-lenkene (`#<klasse>`, `#club::<id>`, `#relay::<etappe>`, `#startlist`, `#plainresults`, `#plainresultsclass_<nøkkel>`)
- [x] Klasseresultater med mellomtider, løpende tider, markering av nye resultater og kvalifiseringsgrense
- [x] Klubb, stafett, alle klasser, startliste og sprint
- [x] Stil hentet fra `web/css/style-liveres.css`, klassemenyen lukket som standard på mobil
- [x] App-test mot en falsk `fetch` med testdataene

## Fase 3 – Visninger mens løpet pågår

- [ ] Siste passeringer, utledet fra `updated`-tidspunktene i deltakerdataene (Time4o har ikke et eget endepunkt for dette)
- [ ] Løpere som fortsatt er i skogen (startet, ikke i mål)
- [ ] Startvisning ut fra starttider
- [ ] Rullende målvisning

## Fase 4 – Utseende som mattias242 sitt UI

Få SPA-en til å se ut som [mattias242/liveresults](https://github.com/mattias242/liveresults)
(`web/spa/src/ui/styles.css`), men behold innholdet og tallene fra den gamle visningen, som
paritetstestene dekker.

- [ ] Mørkt tema med CSS-variabler (`--bg`, `--panel`, `--panel-alt`, `--text`, `--muted`, `--accent` blå, `--border`) og `color-scheme: dark`
- [ ] Systemfont, enkel topplinje (`app-header`) og layout med sidekolonne til venstre fra 720 px og stablet på mobil
- [ ] Klassemeny som «piller» (avrundede knapper) med blå markering av valgt klasse
- [ ] Resultattabeller med linjer mellom radene, annenhver rad i `--panel-alt`, og tabeller som scroller vannrett på smale skjermer
- [ ] Tilpasse fargene for markeringer (nye resultater, beste tid, plass 1, kvalifiseringsgrense, estimater) så de er lesbare på mørk bakgrunn
- [ ] Vurdere en bryter for lyst og mørkt tema, eller følge `prefers-color-scheme`

## Fase 5 – Publisering

- [ ] Cloudflare Pages koblet til forken: `main` publiseres automatisk og hver PR får en forhåndsvisning
- [ ] Eget domene (valgfritt)
- [ ] Test under et ekte løp, side om side med den gamle siden

## Synk med upstream

Paritetstestene laster den gamle visningskoden fra `web/js/`, og språkfilene genereres fra
`web/templates/emmalang_*.php`. Endringer i upstream som påvirker SPA-en, gir derfor røde tester.

- [ ] Planlagt GitHub Actions-workflow som henter `upstream/master` og åpner en PR fra `upstream-sync` mot `main` når det finnes nye commits, med liste over endrede filer i `web/js/liveresults*.js` og `emmalang_*.php`. Workflowen stopper ved merge-konflikter
- [ ] Workflowen kjører `npm run convert-lang` og legger oppdaterte `lang/*.json` inn i PR-en
- [ ] (Valgfritt) Claude Code GitHub Action som foreslår portering til `src/domain/` når paritetstestene feiler. Krever API-nøkkel som secret og koster litt per kjøring

## Løse tråder

- [ ] Spørre Time4o om grenser for antall forespørsler og vilkår for å bruke API-et
- [ ] Vurdere å flytte Node-typene til en egen tsconfig for tester, så nettleserkoden ikke ser dem
- [ ] PR fra `feat/time4o-spa-ui` til `main` i forken

## Utenfor scope

Dette krever LiveRes-databasen og C#-klienten: strekkanalyse (`getclasscoursesplits`),
radio- og speakervisninger via `radioapi.php`, meldinger og brikkebytte.

Vi lenker ikke til og videresender ikke fra palkitt sin versjon (`liveres.live`). SPA-en
lanseres på egen adresse.
