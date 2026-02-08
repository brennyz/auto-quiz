# PWA-status en ideeën voor de app

## Is het al een PWA? Ja.

De app **is al een PWA**:

- **manifest.json** – naam, start_url, display: standalone, theme_color, icons
- **Service worker** (sw.js) – cache van o.a. index, styles, app.js, bg.png
- **HTTPS** (op Netlify) – vereist voor installeren en voor microfoon

Op je telefoon: open de site in Chrome/Safari → **“Add to Home Screen”** / **“Toevoegen aan startscherm”** → dan opent de app als een eigen icoon, zonder adresbalk (standalone).

---

## Heeft PWA voordelen voor microfoon?

**Ja, indirect:**

1. **Standaard als “app”** – Een geïnstalleerde PWA wordt vaker als app behandeld; sommige browsers onthouden permissies (zoals microfoon) beter per “app” dan per tab.
2. **Stabielere context** – Minder kans dat de pagina wordt weggegooid bij tab-wisselen, wat helpt om microfoon-permissie te behouden.
3. **HTTPS** – Microfoon werkt alleen via **https** (of localhost). Op Netlify staat je site op https, dus dat is in orde.

De microfoon-permissie zelf komt nog steeds van de browser; een PWA verandert de regels niet, maar kan wel helpen om dezelfde “sessie” en permissie langer te behouden.

---

## Ideeën om de app en het spel leuker / handiger te maken

### Snel te bouwen

- **Aantal verhalen per ronde kiezen** – Bij start: “5 / 10 / 15 verhalen” (grote knoppen).
- **Categorie kiezen** – “Alleen biologie” of “Mix van alles” (één keuze per ronde).
- **Sla TTS over** – Knop “Naar countdown” om het verhaal niet af te laten spreken als je al weet wat komt (sneller door de ronde).
- **Geluiden bij goed/fout** – Kort vrolijk geluid bij goed, ander geluid bij fout (naast de stem).
- **Grotere “Volgende”-knop** – Extra grote tap-target voor in de auto.

### Iets meer werk

- **Hint-knop** – Na de countdown: “Geef een hint” (bijv. eerste letter of een extra zin), eventueel met -1 punt.
- **Persoonlijk record** – Aan het eind: “Je record is X van Y” en eventueel lokaal opslaan (localStorage).
- **Dag-/nachtmodus** – Donker thema (nu) vs lichter thema voor overdag (minder fel scherm).
- **Score delen** – “Deel je score” → deeltekst of link (bijv. “Ik had 8 van 10 goed in Verhalenverteller!”).

### Later / groter

- **Moeilijkheid** – Klas 1 / 2 / 3 door in de prompt naar de API aan te passen.
- **Stemcommando om te starten** – “Start verhalen” om de ronde te beginnen zonder te tikken (handig onderweg).
- **Timer-modus** – Bijv. “10 verhalen in 15 minuten” voor extra spanning.

---

## PWA-iconen (optioneel)

Als je **icon-192.png** en **icon-512.png** in `public/icons/` zet, krijgt de geïnstalleerde app jouw icoon. Zonder die bestanden gebruikt de browser een standaard icoon; de PWA werkt dan nog steeds.
