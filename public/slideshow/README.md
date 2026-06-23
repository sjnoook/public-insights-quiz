# Public Insights Slideshow

Fullscreen beurs-slideshow voor het tweede scherm.

## Lokaal starten

Vanaf de projectroot:

```bash
pnpm dev
```

Open daarna:

```text
http://127.0.0.1:3000/slideshow/index.html
```

Zet Chrome op fullscreen voor een 1920x1080 scherm.

## Bediening

- Pijltje rechts: volgende slide
- Pijltje links: vorige slide
- Spatie: pauze/play

De slideshow loopt automatisch door en begint na slide 8 opnieuw.

## Techniek

- Pure HTML/CSS/JS.
- GSAP wordt lokaal meegeleverd als `gsap.min.js`, dus geen internet nodig op de beursvloer.
- Tekst is echte HTML-tekst; visuals zijn CSS/SVG en blijven scherp op 1920x1080.
