"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";

type SlideCopy = {
  kicker: string;
  title: string;
  subline: string;
  supportline: string;
  tags: string[];
  visual: Record<string, string>;
};

const STORAGE_KEY = "public-insights-slideshow-copy-v1";

const DEFAULT_SLIDES: SlideCopy[] = [
  {
    kicker: "PUBLIC INSIGHTS",
    title: "Wat mensen echt zeggen",
    subline: "Als niemand ze iets vraagt.",
    supportline: "",
    tags: ["PUBLIEKE REACTIES", "ECHTE TAAL", "STRATEGISCHE RICHTING"],
    visual: {},
  },
  {
    kicker: "PUBLIEKE REACTIES",
    title: "Waardevol. Maar rommelig.",
    subline: "De signalen zijn er al. Alleen staan ze verspreid door losse comments.",
    supportline: "Public Insights maakt die taal analyseerbaar.",
    tags: ["RUIS", "CONTEXT", "SIGNALEN"],
    visual: {
      signal1: "Ruis",
      signal1Meta: "wat afleidt",
      signal2: "Context",
      signal2Meta: "waarom iemand reageert",
      signal3: "Signaal",
      signal3Meta: "wat vaker terugkomt",
      stream1: "“Dit speelt al weken.”",
      stream1Meta: "comment",
      stream2: "“Eindelijk zegt iemand het.”",
      stream2Meta: "discussie",
      stream3: "“Waarom wordt dit niet uitgelegd?”",
      stream3Meta: "reactie",
    },
  },
  {
    kicker: "AI-ONDERSTEUND",
    title: "AI maakt het analyseerbaar",
    subline: "AI helpt reacties ordenen, coderen en tellen.",
    supportline: "Niet als black box. Maar gekoppeld aan echte comments.",
    tags: ["ORDENEN", "CODEREN", "TELLEN"],
    visual: {
      source1: "Comment",
      source2: "Emotie",
      source3: "Betekenis",
      source4: "Context",
    },
  },
  {
    kicker: "CODEREN",
    title: "Van losse comments naar bakjes",
    subline: "Reacties worden gegroepeerd op betekenis.",
    supportline: "Thema’s, emoties, argumenten, drivers en barrières.",
    tags: ["THEMA’S", "EMOTIES", "ARGUMENTEN"],
    visual: {
      aiLabel: "AI-codeert",
      bucket1: "Prijs",
      bucket2: "Vertrouwen",
      bucket3: "Onbegrip",
      bucket4: "Gemak",
      bucket5: "Emotie",
      bucket6: "Argument",
      comment1: "“Ik snap dit niet.”",
      comment2: "“Waarom zo duur?”",
      comment3: "“Dit voelt gedoe.”",
    },
  },
  {
    kicker: "EVIDENCE-FIRST",
    title: "Niet verzonnen. Terug te vinden.",
    subline: "Elk inzicht blijft gekoppeld aan echte reacties.",
    supportline: "Met quotes, aantallen, noemers en context.",
    tags: ["QUOTES", "TELLINGEN", "COMMENT-ID’S"],
    visual: {
      evidenceLabel: "INZICHT",
      insight: "Mensen vinden het niet alleen duur.",
      insightDetail: "Ze missen de logica achter de prijs.",
      proofLabel: "BEWIJS",
      proof: "Terug te leiden naar echte comments en quotes.",
    },
  },
  {
    kicker: "PATRONEN",
    title: "Wat komt steeds terug?",
    subline: "We zien frictie, twijfel, verlangen en weerstand.",
    supportline: "Plus de taal die mensen zelf gebruiken.",
    tags: ["FRICTIE", "NUANCE", "TAALGEBRUIK"],
    visual: {
      pattern1: "twijfel",
      pattern2: "frictie",
      pattern3: "verlangen",
      pattern4: "weerstand",
    },
  },
  {
    kicker: "STRATEGISCHE LENZEN",
    title: "Van patroon naar hypothese",
    subline: "Voor wie lijkt dit relevant? En wanneer speelt het?",
    supportline: "Segment-hints en CEP-hints helpen richting geven.",
    tags: ["SEGMENT-HINTS", "CEP-HINTS", "CONTEXT"],
    visual: {
      cepLabel: "CEP-HINT",
      cepMoments: "bij kiezen • bij twijfelen • bij vergelijken • bij afhaken",
      cepQuestion: "Wanneer wordt dit belangrijk?",
      segmentLabel: "SEGMENT-HINT",
      segmentNote: "Hypothese, te valideren met klant- of segmentdata.",
      segmentQuestion: "Voor wie lijkt dit patroon relevant?",
    },
  },
  {
    kicker: "VAN DATA NAAR KEUZE",
    title: "Minder aannames. Meer richting.",
    subline: "Betere keuzes voor strategie, creatie, media en propositie.",
    supportline: "REACTIES → CODES → PATRONEN → INZICHTEN → ACTIE",
    tags: ["REACTIES", "PATRONEN", "ACTIE"],
    visual: {
      flow1: "Reacties",
      flow2: "AI-codeert",
      flow3: "Bakjes",
      flow4: "Tellingen",
      flow5: "Quotes",
      flow6: "Inzichten",
      flow7: "Keuzes",
    },
  },
];

const VISUAL_LABELS: Record<string, string> = {
  aiLabel: "AI-label",
  bucket1: "Bakje 1",
  bucket2: "Bakje 2",
  bucket3: "Bakje 3",
  bucket4: "Bakje 4",
  bucket5: "Bakje 5",
  bucket6: "Bakje 6",
  cepLabel: "CEP-label",
  cepMoments: "CEP-momenten",
  cepQuestion: "CEP-vraag",
  comment1: "Losse comment 1",
  comment2: "Losse comment 2",
  comment3: "Losse comment 3",
  evidenceLabel: "Evidence label",
  flow1: "Flow 1",
  flow2: "Flow 2",
  flow3: "Flow 3",
  flow4: "Flow 4",
  flow5: "Flow 5",
  flow6: "Flow 6",
  flow7: "Flow 7",
  insight: "Insight zin",
  insightDetail: "Insight toelichting",
  pattern1: "Patroon 1",
  pattern2: "Patroon 2",
  pattern3: "Patroon 3",
  pattern4: "Patroon 4",
  proof: "Bewijsregel",
  proofLabel: "Bewijs label",
  segmentLabel: "Segment-label",
  segmentNote: "Segment-noot",
  segmentQuestion: "Segment-vraag",
  signal1: "Scan label 1",
  signal1Meta: "Scan uitleg 1",
  signal2: "Scan label 2",
  signal2Meta: "Scan uitleg 2",
  signal3: "Scan label 3",
  signal3Meta: "Scan uitleg 3",
  source1: "Proceskaart 1",
  source2: "Proceskaart 2",
  source3: "Proceskaart 3",
  source4: "Proceskaart 4",
  stream1: "Commentkaart 1",
  stream1Meta: "Commentmeta 1",
  stream2: "Commentkaart 2",
  stream2Meta: "Commentmeta 2",
  stream3: "Commentkaart 3",
  stream3Meta: "Commentmeta 3",
};

function mergeSlides(stored: unknown): SlideCopy[] {
  const storedSlides = Array.isArray((stored as { slides?: unknown[] } | null)?.slides)
    ? ((stored as { slides: Partial<SlideCopy>[] }).slides)
    : [];

  return DEFAULT_SLIDES.map((fallback, index) => {
    const incoming = storedSlides[index] || {};

    return {
      kicker: incoming.kicker || fallback.kicker,
      title: incoming.title || fallback.title,
      subline: incoming.subline || fallback.subline,
      supportline: incoming.supportline ?? fallback.supportline,
      tags: [0, 1, 2].map((tagIndex) => incoming.tags?.[tagIndex] || fallback.tags[tagIndex] || ""),
      visual: {
        ...fallback.visual,
        ...(incoming.visual || {}),
      },
    };
  });
}

function playSaveSound() {
  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;

    const context = new AudioContextClass();
    const gain = context.createGain();
    const osc = context.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(720, context.currentTime);
    osc.frequency.exponentialRampToValueAtTime(980, context.currentTime + 0.08);
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.08, context.currentTime + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.18);
    osc.connect(gain);
    gain.connect(context.destination);
    osc.start();
    osc.stop(context.currentTime + 0.2);
    window.setTimeout(() => void context.close(), 260);
  } catch {
    // The visual save confirmation should still work if audio is blocked.
  }
}

export default function SlideshowTextEditor() {
  const [slides, setSlides] = useState<SlideCopy[]>(DEFAULT_SLIDES);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [toast, setToast] = useState("");
  const [previewVersion, setPreviewVersion] = useState(0);
  const selectedSlide = slides[selectedIndex];

  const visualKeys = useMemo(() => Object.keys(selectedSlide.visual), [selectedSlide.visual]);

  useEffect(() => {
    try {
      setSlides(mergeSlides(JSON.parse(localStorage.getItem(STORAGE_KEY) || "null")));
    } catch {
      setSlides(DEFAULT_SLIDES);
    }
  }, []);

  function updateSlide(patch: Partial<SlideCopy>) {
    setSlides((current) =>
      current.map((slide, index) => (index === selectedIndex ? { ...slide, ...patch } : slide)),
    );
  }

  function updateTag(tagIndex: number, value: string) {
    updateSlide({
      tags: selectedSlide.tags.map((tag, index) => (index === tagIndex ? value : tag)),
    });
  }

  function updateVisual(key: string, value: string) {
    updateSlide({
      visual: {
        ...selectedSlide.visual,
        [key]: value,
      },
    });
  }

  function showSavedToast(message = "Opgeslagen") {
    playSaveSound();
    setToast(message);
    window.setTimeout(() => setToast(""), 4200);
  }

  function saveSlides() {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        slides,
        updatedAt: new Date().toISOString(),
        version: 1,
      }),
    );
    setPreviewVersion(Date.now());
    showSavedToast("Opgeslagen");
  }

  function resetSlides() {
    localStorage.removeItem(STORAGE_KEY);
    setSlides(DEFAULT_SLIDES);
    setPreviewVersion(Date.now());
    showSavedToast("Standaardtekst teruggezet");
  }

  function downloadJson() {
    const blob = new Blob([JSON.stringify({ slides, version: 1 }, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "public-insights-slideshow-tekst.json";
    link.click();
    URL.revokeObjectURL(url);
  }

  function uploadJson(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result || "{}"));
        setSlides(mergeSlides(parsed));
        showSavedToast("Tekstbestand geladen");
      } catch {
        setToast("JSON kon niet gelezen worden");
      }
    };
    reader.readAsText(file);
    event.target.value = "";
  }

  return (
    <main className="page-shell studio-shell slideshow-text-shell">
      <section className="studio-header slideshow-text-header">
        <div>
          <p className="eyebrow">SLIDESHOW TEKST</p>
          <h1>Pas de uitlegshow live aan</h1>
          <p>
            Alleen copy. Layout, animaties en glow blijven vast zodat de beursversie niet uit elkaar
            loopt.
          </p>
        </div>
        <div className="studio-actions">
          <button className="secondary-button" onClick={downloadJson} type="button">
            Download JSON
          </button>
          <label className="secondary-button slideshow-upload-button">
            Upload JSON
            <input accept="application/json" onChange={uploadJson} type="file" />
          </label>
          <button className="secondary-button" onClick={resetSlides} type="button">
            Reset
          </button>
          <button className="primary-button" onClick={saveSlides} type="button">
            Save
          </button>
        </div>
        {toast ? <div className="studio-save-toast">{toast}</div> : null}
      </section>

      <section className="studio-panel slideshow-text-grid">
        <aside className="topic-list slideshow-slide-list" aria-label="Slides">
          {slides.map((slide, index) => (
            <button
              className={selectedIndex === index ? "active" : ""}
              key={`${slide.kicker}-${index}`}
              onClick={() => setSelectedIndex(index)}
              type="button"
            >
              <span>Slide {index + 1}</span>
              <strong>{slide.title}</strong>
            </button>
          ))}
        </aside>

        <form className="topic-edit-form slideshow-copy-form" onSubmit={(event) => event.preventDefault()}>
          <label>
            Bovenlabel
            <input
              onChange={(event) => updateSlide({ kicker: event.target.value })}
              value={selectedSlide.kicker}
            />
          </label>

          <label>
            Grote titel
            <textarea
              onChange={(event) => updateSlide({ title: event.target.value })}
              rows={2}
              value={selectedSlide.title}
            />
          </label>

          <label>
            Groene hoofdregel
            <textarea
              onChange={(event) => updateSlide({ subline: event.target.value })}
              rows={2}
              value={selectedSlide.subline}
            />
          </label>

          <label>
            Kleine steunregel
            <textarea
              onChange={(event) => updateSlide({ supportline: event.target.value })}
              rows={2}
              value={selectedSlide.supportline}
            />
          </label>

          <div className="slideshow-tag-editor">
            {selectedSlide.tags.map((tag, index) => (
              <label key={index}>
                Tag {index + 1}
                <input onChange={(event) => updateTag(index, event.target.value)} value={tag} />
              </label>
            ))}
          </div>

          {visualKeys.length ? (
            <section className="slideshow-visual-fields">
              <h2>Tekst in de visual</h2>
              <div>
                {visualKeys.map((key) => (
                  <label key={key}>
                    {VISUAL_LABELS[key] || key}
                    <input
                      onChange={(event) => updateVisual(key, event.target.value)}
                      value={selectedSlide.visual[key]}
                    />
                  </label>
                ))}
              </div>
            </section>
          ) : null}
        </form>

        <aside className="slideshow-preview-panel">
          <div>
            <p>Preview</p>
            <strong>Slide {selectedIndex + 1}</strong>
          </div>
          <iframe
            key={`${selectedIndex}-${previewVersion}`}
            src={`/slideshow/index.html?slide=${selectedIndex + 1}&preview=${previewVersion}`}
            title={`Preview slide ${selectedIndex + 1}`}
          />
          <p className="slideshow-preview-note">
            Na Save wordt de preview herladen. Open de publieke slideshow om hem fullscreen te zien.
          </p>
        </aside>
      </section>
    </main>
  );
}
