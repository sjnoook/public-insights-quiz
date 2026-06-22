# Codex-prompt — Next.js Public Insights Quiz

Maak een luchtige quiz-app in Next.js op basis van de meegeleverde Public Insights Dashboard Bundle. De quiz is voor mensen zonder analysekennis: voorkant in gewone taal, technische termen alleen weggeklapt.

## Context
De bron is een Modus 3 Dashboard Bundle / Codex Dump over 799 NUjij-reacties bij het artikel “Weer verbiedt een land sociale media voor jongeren: 'Onbewezen dat dit werkt'”.

Gebruik deze bestanden:
- `public/data/public_insights_dashboard_bundle.json` als volledige brondata.
- `data/quiz_seed.json` als eerste set quizvragen.
- De app mag quizvragen tonen, filteren, cureren en visueel leuk maken.
- De app mag **niet** opnieuw inhoudelijk analyseren alsof het een nieuwe Public Insights-run is.

## Doel
Bouw een lichte, deelbare quiz met de titel:

**Publieke Peiler: Social Media Verbod**

De quiz moet voelen als een vrolijke interactieve pubquiz over publieke opinie, maar iedere vraag moet een simpele uitleg hebben met:
- telling
- totaal aantal reacties
- percentage wanneer beschikbaar
- gewone thema-labels of segmentlabels
- exacte bronquotes als kleine slideshow wanneer beschikbaar
- korte uitleg waarom het antwoord klopt
- een inklapbare technische check met interne codes en comment_id’s

## Functionele eisen
1. Maak een homepage met:
   - titel
   - wervende korte uitleg
   - bronbasis: 799 reacties
   - duidelijke spelregel: 3 van de 5 goed is winnen
   - startknop
2. Toon per ronde 5 gecureerde vragen uit `quiz_seed.json`: kies de vragen die het meest verrassend en leuk zijn.
   - Elke vraag toont eerst een korte contextzin: waar gaat dit over?
   - Antwoordknoppen mogen subtekst hebben, zodat opties ook zonder voorkennis begrijpelijk zijn.
3. Vraagtypes:
   - multiple choice
   - true/false
   - quote detective
   - spanning spotter
   - mythe of datapunt
4. Na ieder antwoord:
   - toon correct/fout
   - toon speelse feedback van 1-2 zinnen met context
   - toon meteen een simpele “Waarom dit het antwoord is”-uitleg
   - animeer de belangrijkste telling als oplopend getal
   - laat gekoppelde exacte quotes automatisch voorbij komen als bewijs-slideshow
5. Na afloop:
   - score
   - vanaf 3 van de 5: duidelijke wintekst
   - bij winst: particles en happy animatie
   - luchtige resultaatstitel
   - korte uitleg
   - knop opnieuw spelen
6. Geen usernames tonen. Gebruik alleen comment_id’s.
7. Maak de UI luchtig, toegankelijk en mobielvriendelijk.
8. Voeg geen externe analytics of tracking toe.

## Evidence-regels
- Geen percentages zonder expliciete noemer.
- Een claim zonder `n`, `denominator`, code of comment_id mag niet als feit worden getoond.
- Toon interne codes en comment_id’s alleen in “Technische check”, niet als primaire uitleg.
- Whize altijd tonen als “best-guess hypothese”, nooit als feitelijke respondentclassificatie.
- Gender altijd tonen als probabilistische signaalrichting, nooit als feitelijke registratie.
- Toon bij gender expliciet de grote unknown groep wanneer de genderlaag wordt gebruikt.
- De dashboard-bundle blijft source of truth.

## Gewenste schermen/componenten
- `QuizApp`
- `QuestionCard`
- `ExplanationDrawer`
- `ResultCard`
- `ProgressBar`
- optioneel: `SourceBadge`

## Copy-tone
Luchtig, Nederlands, niet kinderachtig. Voorbeelden:
- “Onderbuik Bingo”
- “Publieke Peiler”
- “Quote Detective”
- “Goed gezien.”
- “Net niet — de aantallen wijzen ergens anders heen.”

## Technische voorkeur
- Next.js App Router
- TypeScript
- Geen backend nodig
- Static JSON import is voldoende
- Houd de app deploybaar op Vercel of lokaal via `npm run dev`

## Belangrijk
De app is een quizlaag bovenop de dump. De app mag visualiseren, cureren en uitleg tonen, maar mag de Public Insights-analyse niet opnieuw interpreteren of claims verzinnen.
