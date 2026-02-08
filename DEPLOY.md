# Snel online: Netlify + GitHub

**Live site:** https://car-quiz-pwa.netlify.app  
**GitHub repo:** https://github.com/brennyz/auto-quiz

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
6. **Environment variables** (Settings → Environment variables):
   - **`GEMINI_API_KEY`** = je Google Gemini API-key (voor verhalen genereren). **Nooit in code of repo zetten** — alleen in Netlify invullen.
   - Optioneel: `SUPABASE_URL`, `SUPABASE_ANON_KEY` (als je Supabase later weer gebruikt)
7. **Deploy site**.

### Optie B: Via Netlify CLI

```powershell
cd "c:\Users\bzijf\Car game"
netlify login
netlify init
```

Kies **Create & configure a new site**, koppel aan je Netlify-account en aan de bestaande GitHub-repo (of **Link to existing site** als de site al bestaat).

Env vars instellen:

```powershell
netlify env:set SUPABASE_URL "https://xxx.supabase.co"
netlify env:set SUPABASE_ANON_KEY "jouw-anon-key"
```

Deploy:

```powershell
netlify deploy --prod
```

Bij **Publish directory** invullen: `public`.

## 3. Na deploy

- De site draait op `https://jouw-site.netlify.app`.
- Microfoon werkt alleen via **https** (niet op `file://`).
- Supabase-vragen laden als de env vars goed staan; anders gebruikt de app de ingebouwde voorbeeldvragen.
