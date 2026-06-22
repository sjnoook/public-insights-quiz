# Data contract voor de quiz

## Hoofdbron
`public/data/public_insights_dashboard_bundle.json`

Belangrijke velden:
- `metadata`
- `executive_summary`
- `counts.theme_counts`
- `counts.stance_counts`
- `counts.emotion_counts`
- `insight_cards`
- `tension_cards`
- `strategic_lenses`
- `quote_bank`
- `comments`
- `quality_gate`

## Quizbron
`data/quiz_seed.json`

Velden per vraag:
- `id`
- `type`
- `tone`
- `context`
- `prompt`
- `options`
- `optionDetails`
- `correctIndex`
- `feedbackCorrect`
- `feedbackWrong`
- `evidence`

## Evidence object
- `claim`
- `n`
- `denominator`
- `pct`
- `codes`
- `comment_ids`
- `note`
- `comparison`

## Aanbevolen extra velden voor mensentaal
Deze velden zijn optioneel, maar maken de quizlaag veel minder abstract:
- `plain_claim`: een zin voor eindgebruikers, zonder comment-ID of interne code.
- `why_correct`: korte uitleg waarom het antwoord klopt.
- `public_labels`: gewone labels zoals `Platformen, algoritmes en commercieel ontwerp`.
- `example_quotes`: lijst met `{ comment_id, quote, likes, context_label }`.
- `technical_check`: ruwe controledata zoals `{ codes, comment_ids, source_path }`.

De UI toont eerst `plain_claim`, tellingen, labels en exacte voorbeeldquotes. Interne codes en comment-ID's horen in een inklapbare technische check.

## Noob-proof quizcopy
- De app toont 5 gecureerde vragen per ronde: verrassend, kort en leuk.
- De winstregel is simpel: 3 van de 5 goede antwoorden is winnen.
- De studio mag meer kandidaatvragen tonen, bijvoorbeeld 20, maar de publieke quiz gebruikt precies de 5 gekozen vragen.
- Elke vraag moet met `context` eerst uitleggen waar de vraag over gaat.
- Antwoordopties mogen geen losse labels zijn; gebruik `optionDetails` voor een korte uitleg per optie.
- Feedback moet in 1-2 zinnen uitleggen waarom het antwoord klopt, niet alleen “goed/fout”.
- Na een antwoord verschijnt de uitleg meteen; de belangrijkste telling mag als count-up animatie worden getoond.
- Als er `comment_ids` zijn, toont de UI de bijbehorende exacte bronquotes als een kleine slideshow in het bewijsblok.
- Bij 3 of meer goede antwoorden toont de uitslag een feestelijke winststaat met particles.
- Voorkom vaktaal in zichtbare UI. Zet technische termen alleen in `technical_check`.

## Niet doen
- Geen raw usernames in UI.
- Geen Whize als feitelijke segmentclassificatie.
- Geen gender als feitelijke registratie.
- Geen nieuwe claims zonder evidence.

## Studioflow
- Upload bij voorkeur een quiz-pack met `seed` en `dashboardBundle`, of een seed met kandidaatvragen plus een losse dashboard-bundle.
- Een losse raw dump bevat nog geen quizvragen; de dump-kant moet daarvoor eerst kandidaatvragen maken.
- De huidige prototype-studio bewaart actieve keuzes in browser-`localStorage`. Voor productie met veel dumps is serveropslag nodig.
