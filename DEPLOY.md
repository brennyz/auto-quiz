# Snel online: Netlify + GitHub

**Live site:** https://car-quiz-pwa.netlify.app  
**GitHub repo:** https://github.com/brennyz/auto-quiz

**Welke versie staat live?** Netlify bouwt na elke push. Op **mobiel** kan de PWA een oude gecachte versie tonen (geen unlock-scherm). Oplossing: op mobiel verschijnt dan een melding “Je ziet een oude versie” met knop **Vernieuwen** — tik daarop met wifi aan. Of: open de site in de browser (niet via home screen) met wifi, of wis site-gegevens voor car-quiz-pwa.netlify.app. De app haalt index.html en app.js *network-first* op; na één keer vernieuwen met internet zou het unlock-scherm (cijfer 2) zichtbaar moeten zijn.

De map is gekoppeld aan Netlify. Na wijzigingen: `npx netlify deploy --prod --dir=public`  
Of: push naar GitHub en zet in Netlify **Build & deploy** → **Continuous deployment** aan (koppel de repo).

---

Git config is lokaal gezet (alleen voor deze map). Als je globaal wilt instellen:

```powershell
git config --global user.email "jouw@email.nl"
git config --global user.name "Jouw Naam"
```

## 1. Eerste commit en GitHub-repo

In de projectmap (Car game):

```powershell
cd "c:\Users\bzijf\Car game"
git add .
git commit -m "Auto-Quiz PWA: quiz, TTS, microfoon, wachtmuziek, UI"
```

Maak op [github.com](https://github.com/new) een **nieuwe repository** (bijv. `auto-quiz`), **zonder** README/ .gitignore.

Daarna:

```powershell
git remote add origin https://github.com/JOUW-GEBRUIKERSNAAM/auto-quiz.git
git branch -M main
git push -u origin main
```

(Vervang `JOUW-GEBRUIKERSNAAM/auto-quiz` door je eigen repo-URL.)

## 2. Netlify koppelen

### Optie A: Via Netlify-website

1. Ga naar [app.netlify.com](https://app.netlify.com) en log in.
2. **Add new site** → **Import an existing project**.
3. Kies **GitHub** en autoriseer Netlify.
4. Selecteer de repo (bijv. `auto-quiz`).
5. **Build settings**:
   - **Build command:** `node scripts/build-env.js`
   - **Publish directory:** `public`
   - **Base directory:** (leeg)
6. **Environment variables** — zie sectie hieronder (Gemini API-key).
7. **Deploy site**.

---

## Gemini API-key instellen (verplicht voor verhalen)

Zonder deze key geeft de Netlify Function `generate-story` een 500 en gebruikt de app alleen fallbackverhalen.

### Stap 1: Key aanmaken

1. Ga naar **[Google AI Studio → API keys](https://aistudio.google.com/app/apikey)**.
2. Log in met je Google-account.
3. Klik op **Create API key** (of kies een bestaand project).
4. Kopieer de key (begint vaak met `AIza...`). **Deel deze key nooit in code of repo.**

### Stap 2: Key in Netlify zetten

1. Ga naar **[app.netlify.com](https://app.netlify.com)** en open je site (bijv. car-quiz-pwa).
2. Ga naar **Site configuration** → **Environment variables** (of: **Site settings** → **Environment variables**).
3. Klik **Add a variable** of **Add environment variable**.
4. **Key:** `GEMINI_API_KEY` (exact zo, geen spaties).
5. **Value:** plak je gekopieerde API-key.
6. **Scopes:** kies **All scopes** of in ieder geval **Functions**.
7. Klik **Save** of **Create variable**.

### Stap 3: Opnieuw deployen

Na het toevoegen of wijzigen van een env var moet de site opnieuw gedeployed worden:

- **Site configuration** → **Deploys** → **Trigger deploy** → **Deploy site**,  
  of push een commit naar GitHub (als Continuous deployment aan staat).

Daarna gebruikt de app de key alleen **server-side** in de Netlify Function; de key komt nooit in de frontend of in de repo.

### Optie B: Via Netlify CLI

```powershell
cd "c:\Users\bzijf\Car game"
netlify login
netlify init
```

Kies **Create & configure a new site**, koppel aan je Netlify-account en aan de bestaande GitHub-repo (of **Link to existing site** als de site al bestaat).

Env vars instellen (verplicht voor verhalen: GEMINI_API_KEY):

```powershell
netlify env:set GEMINI_API_KEY "AIza..." 
```

(Vervang `AIza...` door je echte key van [Google AI Studio](https://aistudio.google.com/app/apikey). Optioneel: `SUPABASE_URL`, `SUPABASE_ANON_KEY`.)

Deploy:

```powershell
netlify deploy --prod
```

Bij **Publish directory** invullen: `public`.

## 3. Na deploy

- De site draait op `https://jouw-site.netlify.app`.
- Microfoon werkt alleen via **https** (niet op `file://`).
- Supabase-vragen laden als de env vars goed staan; anders gebruikt de app de ingebouwde voorbeeldvragen.
