# Verhalenverteller — PWA voor in de auto

**Verhalenverteller** voor middelbare school klas 1: de app genereert korte verhalen (biologie, aardrijkskunde, geschiedenis, etc.) via **Google Gemini 2.0 Flash**. Het verhaal wordt via **TTS** voorgelezen; er zit een verborgen antwoord in. Na een countdown (3, 2, 1, go) mag je het antwoord roepen — goed antwoord = punten. Wachtmuziek + microfoon (meerdere antwoorden in de auto).

## Stack

| Onderdeel | Gebruik |
|-----------|--------|
| **GitHub** | Repo voor code |
| **Netlify** | Hosting PWA + build (genereert `env.js` uit env vars) |
| **Supabase** | Database: `questions` + `app_config` (countdown, wachtmuziek, etc.) |

## Lokaal draaien

1. **Supabase-project** aanmaken op [supabase.com](https://supabase.com).
2. **Migratie** draaien: in Supabase Dashboard → SQL Editor: inhoud van `supabase/migrations/20250208000000_create_quiz_tables.sql` plakken en uitvoeren.
3. **Seed** (voorbeeldvragen): `supabase/seed.sql` in SQL Editor uitvoeren.
4. **Env**: kopie van `public/env.js` maken of aanpassen met je `SUPABASE_URL` en `SUPABASE_ANON_KEY` (Project Settings → API in Supabase).
5. **Static server** (bijv. `npx serve public` of Netlify CLI `netlify dev`) — open `http://localhost:3000`.

## Netlify deploy

1. Repo op **GitHub** zetten en in Netlify koppelen.
2. **Build settings**:
   - Build command: `node scripts/build-env.js`
   - Publish directory: `public`
3. **Environment variables** in Netlify:
   - **`GEMINI_API_KEY`** = je Google Gemini API-key (van [Google AI Studio](https://aistudio.google.com/app/apikey)). **Nooit in code of repo zetten** — alleen in Netlify invullen. De Netlify Function `generate-story` gebruikt deze key server-side.
4. Deploy. De build schrijft `public/env.js` (optioneel).

## Geluiden

- **Wachtmuziek**: `public/sounds/wait-music.wav`. Tijdens antwoordtijd speelt de app ~20 seconden uit een willekeurig segment, met fade-in en fade-out.
- **Countdown**: `public/sounds/countdown.mp3` — “3, 2, 1, go” (4 sec) na de vraag; daarna microfoon open.

## PWA-iconen

Plaats `icon-192.png` en `icon-512.png` in `public/icons/` voor “Add to Home Screen”. Zie `public/icons/README.md`.

## 500 vragen — random + Wikipedia

- Vragen staan in Supabase-tabel `questions` (categorieën: dieren, wiskunde, biologie, aardrijkskunde, geschiedenis, taal, algemeen).
- De app haalt tot 500 vragen op en kiest daar **random** een ronde uit (aantal per ronde via `app_config.questions_per_round`).
- **Wikipedia-vragen genereren**: `node scripts/fetch-wikipedia-questions.js` haalt ~500+ Nederlandse vragen op uit nl.wikipedia.org en schrijft `data/wikipedia-questions.json` en `data/wikipedia-questions.sql`. Voer het gegenereerde SQL uit in Supabase SQL Editor (na de eerste migratie). Optioneel: `TARGET=300 node scripts/fetch-wikipedia-questions.js` voor minder vragen.
- **Opruimen**: `node scripts/clean-questions.js` verwijdert vragen met foute antwoorden (adjectieven zoals “nationale” bij “nationele vogel”). Leest en overschrijft `public/data/questions.json`.

## Werking op de achtergrond bijschaven (WhatsApp → Cursor)

- **app_config** in Supabase: countdown-sec, wachtmuziek aan/uit, TTS-snelheid, vragen per ronde. Later kan een WhatsApp-bot of Cursor-workflow deze waarden aanpassen (schrijfrechten via service role).
- **questions**: nieuwe vragen toevoegen via Supabase Dashboard, import-script of later via WhatsApp-bot. De PWA leest altijd de nieuwste data.

## Bestandsstructuur

```
Car game/
├── public/
│   ├── index.html
│   ├── app.js          # Quiz-logica, TTS, countdown, spraakherkenning
│   ├── styles.css
│   ├── manifest.json
│   ├── sw.js           # Service worker (PWA)
│   ├── env.js          # Gegenereerd door build; lokaal handmatig vullen
│   ├── sounds/         # wait-music.mp3, countdown.mp3
│   └── icons/          # icon-192.png, icon-512.png
├── scripts/
│   └── build-env.js    # Netlify build: schrijft env.js
├── supabase/
│   ├── migrations/     # Schema questions + app_config
│   └── seed.sql        # Voorbeeldvragen
├── netlify.toml
└── README.md
```

## Licentie

Eigen gebruik; geluiden zelf royalty-vrij kiezen.
