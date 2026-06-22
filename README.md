# Public Insights Next.js Quiz Starter

Dit pakket bevat een starter voor een korte, luchtige quiz-app op basis van de Modus 3 Dashboard Bundle / Codex Dump. De voorkant is bewust noob-proof: vijf verrassende vragen, gewone taal eerst, meteen uitleg na elk antwoord. Drie van de vijf goed is winnen.

## Inhoud

- `CODEX_PROMPT_NEXTJS_QUIZ.md` — prompt om in Codex te plakken.
- `public/data/public_insights_dashboard_bundle.json` — volledige dashboard-bundle als bron.
- `data/quiz_seed.json` — set quizvragen op basis van tellingen en exacte bronquotes; de app toont de 5 leukste aha-vragen.
- `/studio` — scherm achter de schermen om een quiz-pack te uploaden, een dump te selecteren en 5 vragen te kiezen.
- `app/`, `components/`, `lib/` — simpele Next.js App Router skeleton.

## Lokaal draaien

```bash
pnpm install
pnpm dev
```

Open daarna de lokale Next.js URL.

## Online zetten

De makkelijkste routes zijn Netlify of Vercel. Netlify past goed als je eerder al zo'n publieke link had.

### Optie 1: via Netlify

1. Maak een GitHub-repository voor deze projectmap.
2. Upload deze projectmap, maar niet `node_modules`, `.next` of `.pnpm-store`.
3. Ga naar Netlify en kies `Add new site` > `Import an existing project`.
4. Koppel de GitHub-repository.
5. Netlify gebruikt `netlify.toml`:
   - build command: `pnpm build`
   - publish directory: `.next`
   - Next.js plugin: `@netlify/plugin-nextjs`
6. Klik `Deploy site`.

Als je de oude Netlify-site nog in je account hebt, kun je dezelfde repository daar opnieuw aan koppelen of via `Site settings` de build opnieuw laten deployen. Dan kun je vaak dezelfde hoofdlink blijven gebruiken.

### Optie 2: via GitHub + Vercel

1. Maak een nieuwe GitHub-repository.
2. Upload deze projectmap, maar niet `node_modules`, `.next` of `.pnpm-store`.
3. Ga naar Vercel en kies `Add New Project`.
4. Koppel de GitHub-repository.
5. Vercel herkent Next.js automatisch. De belangrijke instellingen staan al in `vercel.json`:
   - install command: `pnpm install`
   - build command: `pnpm build`
   - dev command: `pnpm dev`
6. Klik `Deploy`.

Daarna krijg je een publieke URL die je met anderen kunt delen.

### Optie 3: direct met Vercel CLI

```bash
pnpm dlx vercel
pnpm dlx vercel --prod
```

Je moet dan inloggen met je Vercel-account. De eerste command maakt meestal een preview-link; de tweede zet hem live als productieversie.

### Belangrijk voor quizstudio/uploads

De publieke app gebruikt standaard `data/quiz_seed.json` en `public/data/public_insights_dashboard_bundle.json`.
Alles wat je lokaal in `/studio` kiest of uploadt, staat in je browser-`localStorage` en gaat niet automatisch mee naar bezoekers.

Wil je een gekozen studio-versie online delen, zet die selectie dan eerst vast in de projectdata of exporteer/upload dezelfde quiz-pack als standaarddata.

## Regels

- Geen percentages zonder totaal aantal reacties.
- Geen usernames tonen.
- Toon 5 vragen per ronde; 3 van de 5 goed is winnen.
- Studio kan uit kandidaatvragen een publieke selectie van 5 opslaan in `localStorage`.
- Toon meteen simpele uitleg na elk antwoord.
- Animeer de belangrijkste telling als oplopend getal.
- Toon bij winst een feestelijke result-state met particles.
- Laat beschikbare bronquotes als kleine slideshow voorbij komen in het bewijsblok.
- Doelgroep-inschattingen = voorzichtig lezen, geen harde waarheid.
- Man/vrouw-inschattingen uit usernames = voorzichtig lezen, geen feitelijke registratie.
- De app mag niet opnieuw inhoudelijk analyseren; alleen quizzen, tonen, filteren en visualiseren.
