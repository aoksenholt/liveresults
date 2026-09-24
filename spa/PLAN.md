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

- [x] Siste passeringer, utledet fra `updated`-tidspunktene i deltakerdataene (Time4o har ikke et eget endepunkt for dette): boksen «Siste oppdateringer» øverst på løpssiden mens løpet pågår, med samme utvalg som `getLastPassings` i den gamle koden
- [x] Løpere som fortsatt er i skogen (startet, ikke i mål): `?comp=<uuid>&code=-2`, som `radio.php`
- [x] Startvisning ut fra starttider: `?comp=<uuid>&code=0[&openstart]`, med opprop, pip og samme URL-parametere som `radio.php` (uten meldinger og brikkesjekk, som krever LiveRes-databasen)
- [x] Rullende målvisning: `?comp=<uuid>&scroll[&first=&last=&speed=]`, som `followallscroll.php`, med alle klasser uten mellomtider på én side som ruller av seg selv. Henter alle deltakerne i én forespørsel hvert 15. sekund i stedet for én per klasse

## Fase 4 – Utseende som mattias242 sitt UI

Få SPA-en til å se ut som [mattias242/liveresults](https://github.com/mattias242/liveresults)
(`web/spa/src/ui/styles.css`), men behold innholdet og tallene fra den gamle visningen, som
paritetstestene dekker.

- [x] Mørkt tema med CSS-variabler (`--bg`, `--panel`, `--panel-alt`, `--text`, `--muted`, `--accent` blå, `--border`) og `color-scheme: dark`. Slås på med `?theme=dark` og huskes i nettleseren (`?theme=classic` slår av)
- [x] Systemfont, enkel topplinje (`app-header`) og layout med sidekolonne til venstre fra 720 px og stablet på mobil
- [x] Klassemeny som «piller» (avrundede knapper) med blå markering av valgt klasse
- [x] Resultattabeller med linjer mellom radene, annenhver rad i `--panel-alt`, og tabeller som scroller vannrett på smale skjermer
- [x] Tilpasse fargene for markeringer (nye resultater, beste tid, plass 1, kvalifiseringsgrense, estimater) så de er lesbare på mørk bakgrunn: dempet oransje for nye resultater, mørkegrønn kvalifisering, lysere rødt for beste tid og sen start, og mykere gult i startvisningen
- [x] Følger `prefers-color-scheme` som standard, med en bryter i topplinjen (og nederst på løpslisten og arrangørvisningene) som veksler mellom som enheten, lyst og mørkt. Valget huskes i nettleseren, og `?theme=auto|classic|dark` virker fortsatt

## Fase 4b – Utseende som den nye liveresultat-betaen

Utseendet til betaen av den nye svenske liveresultat.orientering.se (for eksempel
`live.eoc2026.lt/beta/follow/40449`). Kildekoden er ikke offentlig, så stilen er skrevet selv.
Det nye utseendet erstatter det mørke temaet fra fase 4 og har både lys og mørk variant. Det
gamle LiveRes-utseendet kan fortsatt velges med `?theme=classic`. Tallene og innholdet er de
samme som før.

- [x] Farger (papirhvit/blågrå bakgrunn, hvite kort, skogsgrønn og oransje), systemfont, svart topplinje med løpsnavn og dato, innhold i en midtstilt kolonne og tabeller som kort med runde hjørner. Bryteren veksler mellom som enheten, lyst og mørkt
- [x] Navn og klubb i samme kolonne, med klubben på en mindre linje under navnet
- [x] Klassevalg med knapper på forsiden, nedtrekksmeny når en klasse er valgt, og valgte klasser som faner som kan lukkes (klassemenyen i sidekolonnen finnes fortsatt i det klassiske utseendet)
- [ ] Søk etter løper eller klubb, og visning av 1–4 klasser side om side

## Fase 5 – Publisering

- [x] Cloudflare Pages koblet til forken: `main` publiseres automatisk og hver PR får en forhåndsvisning
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
- [x] PR fra `feat/time4o-spa-ui` til `main` i forken

## Utenfor scope

Dette krever LiveRes-databasen og C#-klienten: strekkanalyse (`getclasscoursesplits`),
radio- og speakervisninger via `radioapi.php`, meldinger og brikkebytte.

Vi lenker ikke til og videresender ikke fra palkitt sin versjon (`liveres.live`). SPA-en
lanseres på egen adresse.
