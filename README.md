# Mans saraksts

Personīgā skolas stundu saraksta PWA (v1). Īsas latviešu etiķetes, dati **tikai ierīcē** (`localStorage`) — bez konta, bez servera API un bez sinhronizācijas.

Šis projekts ir **atsevišķs** no `skola-demo` un citiem skolas portāliem: šeit ir manuāli ievadīts personīgais saraksts, nevis skolas sistēmas dati.

## Funkcijas

- **Tumšais dizains** (noklusējums) — labs kontrasts, skaidrs «Tagad» izcelums
- **Fona attēls** (Iestatījumi ⚙): izvēlies foto no telefona; tiek saspiests un saglabāts ierīcē; regulējams tumšais pārklājums lasāmībai

- Skati: **Šodien** un **Nedēļa** (pirmdiena–piektdiena)
- Pašreizējā stunda / statusa rinda pēc **Europe/Riga** pulksteņa (atjaunojas ~ik pēc 45 s)
- Stundu pievienošana, rediģēšana, dzēšana
- Lauki: diena, laiks no–līdz, priekšmets; pēc izvēles klase, kabinets, skolotājs
- JSON eksportes / imports (rezerves kopija)
- Instalējama PWA (manifest + service worker) offlaina apvalkam

## Palaišana lokāli

```bash
npm i
npm run dev
```

Tad atver pārlūkā adresi, ko rāda Vite (parasti `http://localhost:5173`).

Produkcijas būve:

```bash
npm run build
npm run preview
```

Statiskie faili nonāk mapē `dist/`.

## Izvietošana (Vercel)

1. Importē šo GitHub repozitoriju Vercel projektā
2. Framework: Vite (vai Other), build → `dist`
3. Deploy

Nav nepieciešamas vides mainīgās — aplikācija nestrādā ar backend.

## Dati un privātums

- Viss saraksts un fona attēls glabājas pārlūka `localStorage`
- Dzēšot vietnes datus / notīrot kešu, saraksts un fons pazūd — izmanto **eksportu** stundām
- Nav pieteikšanās un nav mākoņa sinhronizācijas

## Tehnoloģijas

- Vite + vanilla JS (bez smaga framework)
- PWA: `public/manifest.json`, `public/sw.js`, ikonas `public/icons/`
