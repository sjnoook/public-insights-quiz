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
npm install
npm run dev
```

Open daarna de lokale Next.js URL.

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
