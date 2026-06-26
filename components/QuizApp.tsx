"use client";

import { type CSSProperties, useEffect, useMemo, useRef, useState } from "react";
import {
  normalizeQuizPack,
  type NormalizedComment,
  type NormalizedEvidence,
  type NormalizedEvidenceContext,
  type NormalizedPostQuizSlide,
  type NormalizedPostQuizSlideItem,
  type NormalizedQuestion,
  type NormalizedQuizSeed,
  type NormalizedQuote,
  type QuizPackValidation,
} from "@/lib/quizNormalizer";
import { STUDIO_ACTIVE_PACK_KEY, STUDIO_CUSTOM_PACKS_KEY, STUDIO_FALLBACK_PACK_KEY } from "@/lib/studioStorage";
import {
  ACTIVE_TOPIC_STATUS,
  DEFAULT_TOPICS,
  PUBLIC_INSIGHTS_DELETED_TOPICS_KEY,
  PUBLIC_INSIGHTS_TOPICS_KEY,
  mergeStoredTopics,
  parseTopicStorageValue,
  type PublicInsightTopic,
} from "@/lib/topics";

export type EvidenceContext = NormalizedEvidenceContext;
export type QuizSeed = NormalizedQuizSeed;
type Evidence = NormalizedEvidence;
type EvidenceComment = NormalizedComment;
type Question = NormalizedQuestion;

type SoundCue =
  | "type"
  | "option"
  | "correct"
  | "wrong"
  | "transition"
  | "toggle"
  | "radar"
  | "radar-final"
  | "intro-word"
  | "intro-reveal"
  | "insight"
  | "start-ready";
type WindowWithWebAudio = Window &
  typeof globalThis & {
    webkitAudioContext?: typeof AudioContext;
  };

type ResultBand = {
  min: number;
  max: number;
  title: string;
  description: string;
};

type StoredQuizPack = {
  evidenceContext?: EvidenceContext;
  id?: string;
  name?: string;
  seed?: QuizSeed;
  selectedQuestionIds?: string[];
  validation?: QuizPackValidation;
};

const FALLBACK_CODE_LABELS: Record<string, string> = {
  T01_PRIVACY_ID_CONTROLE: "Privacy, ID en online controle",
  T02_SCHADE_BESCHERMING: "Schade, verslaving en bescherming van jongeren",
  T03_EFFECTIVITEIT_HANDHAVING: "Of het verbod werkt en te handhaven is",
  T04_OUDERS_OPVOEDING: "Ouders, opvoeding en thuisregels",
  T05_PLATFORM_ALGORITME: "Platforms en algoritmes",
  T06_VRIJHEID_PROPORTIONALITEIT: "Vrijheid en rechten",
  T07_BEWIJS_WETENSCHAP: "Wetenschappelijk bewijs",
  T08_POSITIEVE_FUNCTIES: "Positieve functies: contact, identiteit, informatie",
  T09_GENERATIE_OFFLINE: "Offline leven en telefooncultuur",
  T10_SCHOOL_PRAKTIJK: "School, apps en praktische uitvoering",
  CEP01: "Kinderen beschermen zonder alles bij ouders te leggen",
  "strategic_lenses.whize_hypotheses": "Ruwe doelgroep-gok: voorzichtig gebruiken",
  gender_signal_summary: "Man/vrouw-inschatting: veel onbekend",
};

const TONE_LABELS: Record<string, string> = {
  "raad-de-onderstroom": "Wat viel op?",
  "publieke-peiler": "Wat vonden mensen?",
  "quote-detective": "Quote raden",
  "onderbuik-bingo": "Schatten",
  "mythe-of-datapunt": "Waar of niet waar",
  "spanning-spotter": "Botsing raden",
  "botsing-raden": "Botsing raden",
  "raad-het-frame": "Wat leeft er?",
  "wat-leeft-er": "Wat leeft er?",
  "emotie-meter": "Gevoel raden",
  "whize-wijsneus": "Voorzichtig lezen",
  "gender-gong": "Voorzichtig lezen",
  "voorzichtig-lezen": "Voorzichtig lezen",
  oplossingsradar: "Beste middenweg",
};

const FEATURED_QUESTION_IDS: string[] = [];
const MIN_QUESTION_COUNT = 3;
const MAX_QUESTION_COUNT = 10;

function getWinThreshold(questionCount: number) {
  return Math.floor(questionCount / 2) + 1;
}

function clampQuestionCount(seed: QuizSeed, questionCount: number) {
  const maxAllowed = Math.min(MAX_QUESTION_COUNT, Math.max(MIN_QUESTION_COUNT, seed.questions.length));
  const numericCount = Number.isFinite(questionCount) ? Math.trunc(questionCount) : MAX_QUESTION_COUNT;

  return Math.min(Math.max(numericCount, MIN_QUESTION_COUNT), maxAllowed);
}

function getQuestionCount(seed: QuizSeed) {
  return clampQuestionCount(seed, seed.game?.questionCount ?? MAX_QUESTION_COUNT);
}

function makeResultBands(questionCount: number) {
  const winThreshold = getWinThreshold(questionCount);

  return [
    {
      min: 0,
      max: winThreshold - 1,
      title: "Nog niet gewonnen",
      description: `Je zat in de buurt, maar ${winThreshold} van de ${questionCount} is de winstgrens.`,
    },
    {
      min: winThreshold,
      max: Math.max(winThreshold, questionCount - 1),
      title: "Gewonnen: Publieke Peiler",
      description: "Je had genoeg verrassingen te pakken. Je leest de onderstroom van de reacties scherp.",
    },
    {
      min: questionCount,
      max: questionCount,
      title: "Perfecte Peiler",
      description: "Alles goed. Jij voelde precies aan waar de reacties anders waren dan je misschien verwacht.",
    },
  ];
}

function getInitialQuestionIds(seed: QuizSeed, preferredIds: string[] | undefined, questionCount: number) {
  const validIds = new Set(seed.questions.map((question) => question.id));
  const configuredIds = preferredIds?.filter((id) => validIds.has(id)).slice(0, questionCount) ?? [];

  if (configuredIds.length === questionCount) return configuredIds;

  const fallbackIds = seed.questions
    .map((question) => question.id)
    .filter((id) => !configuredIds.includes(id))
    .slice(0, questionCount - configuredIds.length);

  return [...configuredIds, ...fallbackIds];
}

function normalizeSeedQuestionConfig(seed: QuizSeed, preferredIds: string[], questionCount: number): QuizSeed {
  const target = clampQuestionCount(seed, questionCount);
  const featuredQuestionIds = getInitialQuestionIds(seed, preferredIds, target);

  return {
    ...seed,
    game: {
      ...seed.game,
      featuredQuestionIds,
      questionCount: target,
      winThreshold: getWinThreshold(target),
    },
    resultBands: makeResultBands(target),
  };
}

function pickFeaturedQuestions(input: Question[], featuredIds: string[], questionCount: number) {
  const byId = new Map(input.map((question) => [question.id, question]));
  const featured = featuredIds.flatMap((id) => {
    const question = byId.get(id);
    return question ? [question] : [];
  });

  return featured.length === questionCount ? featured : input.slice(0, questionCount);
}

function formatPct(pct?: number | null) {
  return pct === undefined || pct === null ? undefined : `${String(pct).replace(".", ",")}%`;
}

function cleanCodeLabel(code: string, evidenceContext?: EvidenceContext | null) {
  if (!code) return "";

  if (code.startsWith("theme:")) return code.replace("theme:", "");
  if (code.startsWith("source:")) return code.replace("source:", "");

  if (code.startsWith("stance:")) {
    const stance = code.replace("stance:", "");
    if (stance === "Alternatief: ouders/platforms") return "Oplossing via ouders of platforms";
    if (stance === "Anti-/privacy-kritisch") return "Kritisch door privacyzorgen";
    if (stance === "Gemengd/ambivalent") return "Twijfelend";
    return stance;
  }

  if (code.startsWith("emotion:")) return code.replace("emotion:", "Gevoel: ");

  const codeLabels = evidenceContext?.codeLabels ?? {};

  return (
    codeLabels[code] ??
    FALLBACK_CODE_LABELS?.[code] ??
    code
      .replace(/^theme_/, "Thema ")
      .replace(/^stance_/, "Stance ")
      .replace(/^emotion_/, "Emotie ")
      .replace(/^source_/, "Bron ")
      .replaceAll("_", " ")
  );
}

function summarizeEvidence(question: Question, labels: string[]) {
  const firstLabel = labels[0]?.toLowerCase();

  if (question.evidence.codes.includes("strategic_lenses.whize_hypotheses")) {
    return "Dit is alleen een ruwe gok. Je mag er geen harde uitspraak over mensen van maken.";
  }

  if (question.evidence.codes.includes("gender_signal_summary")) {
    return "Deze telling gaat over bruikbare hints in gebruikersnamen. Bij de meeste mensen weten we het niet.";
  }

  if (question.tone === "quote-detective") {
    return firstLabel
      ? `De gekozen quote past bij: ${firstLabel}.`
      : "De gekozen quote is een herkenbaar voorbeeld uit de reacties.";
  }

  if (question.evidence.comparison) {
    return firstLabel
      ? "Dit antwoord kwam vaker terug dan de vergelijking in de vraag."
      : "Dit antwoord wint door de telling erachter.";
  }

  return firstLabel
    ? `Dit antwoord hoort bij het onderwerp: ${firstLabel}.`
    : question.evidence.claim;
}

function formatTone(tone: string) {
  return TONE_LABELS[tone] ?? tone.replaceAll("-", " ");
}

function cleanQuoteText(text: string) {
  return text.replaceAll("_", "").replace(/\s+/g, " ").trim();
}

function cleanStanceLabel(label?: string) {
  if (!label || label === "Geen expliciete stance") return undefined;
  if (label === "Alternatief: ouders/platforms") return "houding: oplossing via ouders/platforms";
  if (label === "Anti-/privacy-kritisch") return "houding: kritisch door privacyzorgen";
  if (label === "Gemengd/ambivalent") return "houding: twijfelend";
  if (label === "Pro-verbod") return "houding: voor verbod";
  return `houding: ${label.toLowerCase()}`;
}

function cleanEmotionLabel(label?: string) {
  if (!label) return undefined;
  if (label === "Pragmatiek") return "toon: praktisch";
  return `toon: ${label.toLowerCase()}`;
}

function formatCommentMeta(comment: EvidenceComment) {
  return [
    comment.likes !== undefined ? `${comment.likes} likes` : "reactie uit de bron",
    cleanStanceLabel(comment.stanceLabel),
    cleanEmotionLabel(comment.emotion),
  ]
    .filter(Boolean)
    .join(" · ");
}

function CountUpStat({
  denominator,
  pct,
  resetKey,
  value,
}: {
  denominator?: number | null;
  pct?: number | null;
  resetKey: string;
  value?: number | null;
}) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    if (value === undefined || value === null) return;

    const targetValue = value;
    let frameId = 0;
    const duration = 850;
    const startedAt = performance.now();

    function tick(now: number) {
      const progress = Math.min((now - startedAt) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(Math.round(targetValue * eased));

      if (progress < 1) {
        frameId = requestAnimationFrame(tick);
      }
    }

    setDisplayValue(0);
    frameId = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(frameId);
  }, [resetKey, value]);

  if (value === undefined || value === null || denominator === undefined || denominator === null) {
    return <p>Geen telling beschikbaar.</p>;
  }

  const pctLabel = formatPct(pct);

  return (
    <div className="count-up-card" aria-label={`${value} van ${denominator} reacties`}>
      <strong>{displayValue}</strong>
      <span>van {denominator} reacties</span>
      {pctLabel ? <em>{pctLabel}</em> : null}
    </div>
  );
}

function formatQuoteMeta(quote: NormalizedQuote) {
  return [
    quote.likes !== null ? `${quote.likes} likes` : "reactie uit de bron",
    quote.source,
  ]
    .filter(Boolean)
    .join(" · ");
}

function QuoteSlideshow({ items }: { items: NormalizedQuote[] }) {
  const [active, setActive] = useState(0);
  const itemKey = items.map((item) => item.id).join("|");

  useEffect(() => {
    setActive(0);
  }, [itemKey]);

  useEffect(() => {
    if (items.length <= 1) return;

    const intervalId = window.setInterval(() => {
      setActive((value) => (value + 1) % items.length);
    }, 6500);

    return () => window.clearInterval(intervalId);
  }, [items.length]);

  if (!items.length) return null;

  const current = items[active] ?? items[0];
  const quote = cleanQuoteText(current.text);

  function showPrevious() {
    setActive((value) => (value - 1 + items.length) % items.length);
  }

  function showNext() {
    setActive((value) => (value + 1) % items.length);
  }

  return (
    <div className="quote-slideshow" aria-live="polite">
      <div className="quote-slideshow-header">
        <h4>Exacte reacties uit de bron</h4>
        <span>
          Quote {active + 1} van {items.length}
        </span>
      </div>

      <figure className="quote-slide" key={current.id}>
        <blockquote>{quote}</blockquote>
        <figcaption>{formatQuoteMeta(current)}</figcaption>
      </figure>

      {items.length > 1 ? (
        <div className="quote-controls" aria-label="Blader door bronquotes">
          <button type="button" onClick={showPrevious}>
            Vorige
          </button>
          <div className="quote-dots" aria-label="Quote voortgang">
            {items.map((item, index) => (
              <button
                key={item.id}
                aria-label={`Toon quote ${index + 1}`}
                className={index === active ? "active" : ""}
                onClick={() => setActive(index)}
                type="button"
              />
            ))}
          </div>
          <button type="button" onClick={showNext}>
            Volgende
          </button>
        </div>
      ) : null}
    </div>
  );
}

function formatStatValue(value?: number | null) {
  if (value === undefined || value === null) return "geen telling";
  return new Intl.NumberFormat("nl-NL").format(value);
}

function getItemPercent(item: NormalizedPostQuizSlideItem, maxValue: number) {
  if (item.pct !== null && item.pct !== undefined) return Math.max(4, Math.min(item.pct, 100));
  if (item.n !== null && item.n !== undefined && maxValue > 0) return Math.max(4, Math.min((item.n / maxValue) * 100, 100));
  return 18;
}

function itemStatLine(item: NormalizedPostQuizSlideItem) {
  const pct = formatPct(item.pct);
  if (item.n !== null && item.denominator !== null) {
    return `${formatStatValue(item.n)} van ${formatStatValue(item.denominator)} reacties${pct ? ` · ${pct}` : ""}`;
  }

  if (item.n !== null) return `${formatStatValue(item.n)} signalen${pct ? ` · ${pct}` : ""}`;
  if (pct) return pct;
  return "Publiek signaal";
}

function buildPieGradient(items: NormalizedPostQuizSlideItem[]) {
  const palette = ["#b6ff19", "#18d5ff", "#9b5cff", "#ff8f3d", "#37f07b"];
  const values = items.map((item) => item.pct ?? item.n ?? 1);
  const total = values.reduce((sum, value) => sum + Math.max(value, 0), 0) || 1;
  let cursor = 0;

  const parts = values.map((value, index) => {
    const size = (Math.max(value, 0) / total) * 100;
    const start = cursor;
    const end = cursor + size;
    cursor = end;
    return `${palette[index % palette.length]} ${start}% ${end}%`;
  });

  return `conic-gradient(${parts.join(", ")})`;
}

function InsightQuote({ quote }: { quote: NormalizedQuote | null }) {
  if (!quote?.text) return null;

  return (
    <figure className="insight-quote">
      <blockquote>{cleanQuoteText(quote.text)}</blockquote>
      <figcaption>{formatQuoteMeta(quote)}</figcaption>
    </figure>
  );
}

function InsightBars({ slide }: { slide: NormalizedPostQuizSlide }) {
  const maxValue = Math.max(...slide.items.map((item) => item.n ?? item.pct ?? 1), 1);

  return (
    <div className="insight-bars">
      {slide.items.map((item, index) => {
        const width = getItemPercent(item, maxValue);

        return (
          <article className="insight-bar-card" key={`${slide.id}-${item.title}-${index}`}>
            <div className="insight-bar-head">
              <span>{item.rank ?? index + 1}</span>
              <strong>{item.title}</strong>
              <em>{formatPct(item.pct) ?? ""}</em>
            </div>
            <p>{item.summary}</p>
            <div className="insight-bar-track" aria-hidden="true">
              <span style={{ "--bar-width": `${width}%`, "--bar-delay": `${index * 90}ms` } as CSSProperties} />
            </div>
            <small>{itemStatLine(item)}</small>
          </article>
        );
      })}
    </div>
  );
}

function InsightPie({ slide }: { slide: NormalizedPostQuizSlide }) {
  const gradient = buildPieGradient(slide.items);

  return (
    <div className="insight-pie-layout">
      <div className="insight-pie-wrap">
        <div className="insight-pie" style={{ "--pie-gradient": gradient } as CSSProperties}>
          <span />
          <div className="insight-pie-core">
            <strong>{slide.items.length}</strong>
            <em>signalen</em>
          </div>
        </div>
      </div>

      <div className="insight-pie-list">
        {slide.items.map((item, index) => (
          <article className="insight-pie-item" key={`${slide.id}-${item.title}-${index}`}>
            <span style={{ "--dot-index": index } as CSSProperties} />
            <div>
              <strong>{item.title}</strong>
              <p>{item.summary}</p>
              <small>{itemStatLine(item)}</small>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

function InsightTakeaways({ slide }: { slide: NormalizedPostQuizSlide }) {
  return (
    <div className="insight-takeaways">
      {slide.items.slice(0, 4).map((item, index) => (
        <article className="insight-takeaway-card" key={`${slide.id}-${item.title}-${index}`}>
          <span>0{index + 1}</span>
          <strong>{item.title}</strong>
          <p>{item.summary}</p>
          <small>{itemStatLine(item)}</small>
          <InsightQuote quote={item.quote} />
        </article>
      ))}
    </div>
  );
}

function InsightMiniDeck({
  activeIndex,
  onBackToScore,
  onNext,
  onPrevious,
  onRestart,
  onTopics,
  slides,
}: {
  activeIndex: number;
  onBackToScore: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onRestart: () => void;
  onTopics: () => void;
  slides: NormalizedPostQuizSlide[];
}) {
  const slide = slides[activeIndex] ?? slides[0];
  const primaryQuote = slide.items.find((item) => item.quote)?.quote ?? null;
  const visualType = slide.visual_type || slide.type;

  return (
    <main className="page-shell insight-deck-shell">
      <section className="insight-deck-card" key={slide.id}>
        <div className="insight-grid" aria-hidden="true" />
        <header className="insight-deck-header">
          <div>
            <p className="kicker">Public Insights na de quiz</p>
            <h1>{slide.title}</h1>
            <p>{slide.subtitle}</p>
          </div>
          <button className="secondary-button compact-button" onClick={onBackToScore} type="button">
            Terug naar score
          </button>
        </header>

        <div className="insight-deck-body">
          <div className="insight-visual-panel">
            {visualType.includes("sentiment") || visualType.includes("emotion") ? (
              <InsightPie slide={slide} />
            ) : visualType.includes("takeaway") ? (
              <InsightTakeaways slide={slide} />
            ) : (
              <InsightBars slide={slide} />
            )}
          </div>

          <aside className="insight-side-panel">
            <div className="insight-slide-counter">
              <span>
                {activeIndex + 1}/{slides.length}
              </span>
              <div>
                {slides.map((candidate, index) => (
                  <i className={index === activeIndex ? "active" : ""} key={candidate.id} />
                ))}
              </div>
            </div>

            <InsightQuote quote={primaryQuote} />

            {slide.note ? <p className="small-note">{slide.note}</p> : null}

            <div className="insight-actions">
              <button className="secondary-button" onClick={onPrevious} type="button">
                Vorige
              </button>
              <button className="primary-button" onClick={onNext} type="button">
                {activeIndex + 1 === slides.length ? "Opnieuw tonen" : "Volgende inzicht"}
              </button>
            </div>

            <div className="insight-secondary-actions">
              <button type="button" onClick={onRestart}>
                Speel quiz opnieuw
              </button>
              <button type="button" onClick={onTopics}>
                Kies ander topic
              </button>
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}

function PartyParticles() {
  const particles = Array.from({ length: 84 }, (_, index) => index);
  const beams = Array.from({ length: 12 }, (_, index) => index);

  return (
    <div className="party-particles" aria-hidden="true">
      <div className="party-rings">
        <span />
        <span />
        <span />
      </div>
      {beams.map((index) => {
        const style = {
          "--beam-delay": `${index * 80}ms`,
          "--beam-rotate": `${index * 30}deg`,
        } as CSSProperties & Record<string, string>;

        return <i className="party-beam" key={`beam-${index}`} style={style} />;
      })}
      {particles.map((index) => {
        const style = {
          "--x": `${(index % 14) * 34 - 222}px`,
          "--y": `${Math.floor(index / 14) * 42 + 150}px`,
          "--delay": `${(index % 18) * 58}ms`,
          "--hue": `${(index * 37) % 360}`,
          "--size": `${7 + (index % 5) * 4}px`,
          "--spin": `${index % 2 === 0 ? 360 : -360}deg`,
        } as CSSProperties & Record<string, string>;

        return <span className={`party-bit shape-${index % 4}`} key={index} style={style} />;
      })}
    </div>
  );
}

export default function QuizApp({
  seed,
  evidenceContext,
}: {
  seed: QuizSeed;
  evidenceContext: EvidenceContext;
}) {
  const defaultPack = useMemo(() => normalizeQuizPack({ seed, evidenceContext }), [evidenceContext, seed]);
  const [runtimeSeed, setRuntimeSeed] = useState(defaultPack.seed);
  const [runtimeEvidenceContext, setRuntimeEvidenceContext] = useState(defaultPack.evidenceContext);
  const [runtimeValidation, setRuntimeValidation] = useState(defaultPack.validation);
  const [topics, setTopics] = useState<PublicInsightTopic[]>([]);
  const [started, setStarted] = useState(false);
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);
  const [spotlightTopicId, setSpotlightTopicId] = useState("korte-broek");
  const [isDrawingTopic, setIsDrawingTopic] = useState(false);
  const [topicNotice, setTopicNotice] = useState("Kies een onderwerp of laat de radar spannend bepalen.");
  const [runId, setRunId] = useState(0);
  const [current, setCurrent] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [displayedPrompt, setDisplayedPrompt] = useState("");
  const [isPromptTyping, setIsPromptTyping] = useState(false);
  const [visibleOptionCount, setVisibleOptionCount] = useState(0);
  const [lockedTopicId, setLockedTopicId] = useState<string | null>(null);
  const [visibleIntroWords, setVisibleIntroWords] = useState(0);
  const [showIntroDetails, setShowIntroDetails] = useState(false);
  const [showStartAction, setShowStartAction] = useState(false);
  const [showInsightDeck, setShowInsightDeck] = useState(false);
  const [activeInsightSlide, setActiveInsightSlide] = useState(0);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const soundEnabledRef = useRef(false);

  useEffect(() => {
    try {
      const storedTopics = window.localStorage.getItem(PUBLIC_INSIGHTS_TOPICS_KEY);
      const deletedTopics = window.localStorage.getItem(PUBLIC_INSIGHTS_DELETED_TOPICS_KEY);
      const storedTopicInput = parseTopicStorageValue(storedTopics, DEFAULT_TOPICS);
      const deletedTopicInput = parseTopicStorageValue(deletedTopics, []);

      setTopics(mergeStoredTopics(storedTopicInput, deletedTopicInput));
    } catch {
      setTopics([]);
    }
  }, []);

  useEffect(() => {
    try {
      const storedPack = window.localStorage.getItem(STUDIO_ACTIVE_PACK_KEY);

      if (!storedPack) {
        applyFallbackOrDefaultPack();
        return;
      }

      const parsed = JSON.parse(storedPack) as StoredQuizPack;
      const normalizedPack = normalizeStoredPack(parsed);

      if (!normalizedPack) return;
      if ((normalizedPack.seed.game?.questionCount ?? 0) < MIN_QUESTION_COUNT) {
        window.localStorage.removeItem(STUDIO_ACTIVE_PACK_KEY);
        applyFallbackOrDefaultPack();
        return;
      }
      if (
        parsed.id === "active-built-in" &&
        normalizedPack.seed.source.dataset === defaultPack.seed.source.dataset &&
        normalizedPack.seed.questions.length < defaultPack.seed.questions.length
      ) {
        window.localStorage.removeItem(STUDIO_ACTIVE_PACK_KEY);
        applyFallbackOrDefaultPack();
        return;
      }

      setRuntimeSeed(normalizedPack.seed);
      setRuntimeEvidenceContext(normalizedPack.evidenceContext);
      setRuntimeValidation(normalizedPack.validation);
    } catch {
      applyFallbackOrDefaultPack();
    }
  }, [defaultPack]);

  function applyDefaultPack() {
    setRuntimeSeed(defaultPack.seed);
    setRuntimeEvidenceContext(defaultPack.evidenceContext);
    setRuntimeValidation(defaultPack.validation);
  }

  function readFallbackPack() {
    try {
      const raw = window.localStorage.getItem(STUDIO_FALLBACK_PACK_KEY);
      if (!raw) return undefined;

      const parsed = JSON.parse(raw) as StoredQuizPack;
      return normalizeStoredPack(parsed);
    } catch {
      return undefined;
    }
  }

  function applyFallbackOrDefaultPack() {
    const fallbackPack = readFallbackPack();

    if (fallbackPack) {
      applyRuntimePack(fallbackPack);
      return;
    }

    applyDefaultPack();
  }

  function normalizeStoredPack(pack: StoredQuizPack | null | undefined) {
    if (!pack) return undefined;

    const normalized = normalizeQuizPack(pack);
    if (!normalized.seed.questions.length) return undefined;
    if ((normalized.seed.game?.questionCount ?? MIN_QUESTION_COUNT) < MIN_QUESTION_COUNT) return undefined;
    const explicitSelection = normalized.selectedQuestionIds.length
      ? normalized.selectedQuestionIds
      : Array.isArray(pack.selectedQuestionIds)
        ? pack.selectedQuestionIds
        : [];
    const repairedQuestionCount =
      explicitSelection.length >= MIN_QUESTION_COUNT && explicitSelection.length <= MAX_QUESTION_COUNT
        ? explicitSelection.length
        : getQuestionCount(normalized.seed);
    const selectedQuestionIds = getInitialQuestionIds(normalized.seed, explicitSelection, repairedQuestionCount);
    const seed = normalizeSeedQuestionConfig(normalized.seed, selectedQuestionIds, repairedQuestionCount);

    return {
      ...pack,
      evidenceContext: normalized.evidenceContext,
      seed,
      selectedQuestionIds,
      validation: normalized.validation,
    } satisfies StoredQuizPack & { evidenceContext: EvidenceContext; seed: QuizSeed };
  }

  function readStoredPacks() {
    try {
      const raw = window.localStorage.getItem(STUDIO_CUSTOM_PACKS_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as StoredQuizPack[];
      return Array.isArray(parsed)
        ? parsed.flatMap((pack) => {
            const normalizedPack = normalizeStoredPack(pack);
            return normalizedPack ? [normalizedPack] : [];
          })
        : [];
    } catch {
      return [];
    }
  }

  function readActivePack() {
    try {
      const raw = window.localStorage.getItem(STUDIO_ACTIVE_PACK_KEY);
      if (!raw) return undefined;
      const parsed = JSON.parse(raw) as StoredQuizPack;
      return normalizeStoredPack(parsed);
    } catch {
      return undefined;
    }
  }

  function applyRuntimePack(pack: StoredQuizPack & { evidenceContext: EvidenceContext; seed: QuizSeed }) {
    setRuntimeSeed(pack.seed);
    setRuntimeEvidenceContext(pack.evidenceContext);
    setRuntimeValidation(pack.validation ?? normalizeQuizPack(pack).validation);
  }

  function loadTopicPack(topic: PublicInsightTopic) {
    if (!topic.packId) {
      if (topic.id === "korte-broek") {
        applyFallbackOrDefaultPack();
        return true;
      }

      setTopicNotice(`${topic.label} is actief, maar mist nog een gekoppelde dump. Koppel hem in de editor.`);
      return false;
    }

    if (topic.packId === "builtin") {
      applyFallbackOrDefaultPack();
      return true;
    }

    const customPack = readStoredPacks().find((pack) => pack.id === topic.packId);
    if (customPack) {
      applyRuntimePack(customPack);
      return true;
    }

    const activePack = readActivePack();
    if (activePack?.id === topic.packId) {
      applyRuntimePack(activePack);
      return true;
    }

    setTopicNotice(
      `${topic.label} staat actief, maar de gekoppelde dump is niet gevonden. Upload of koppel hem opnieuw in de editor.`,
    );
    return false;
  }

  const questionCount = getQuestionCount(runtimeSeed);
  const winThreshold = getWinThreshold(questionCount);
  const resultBands = makeResultBands(questionCount);
  const featuredQuestionIds = runtimeSeed.game?.featuredQuestionIds ?? FEATURED_QUESTION_IDS;
  const questions = useMemo(
    () => pickFeaturedQuestions(runtimeSeed.questions, featuredQuestionIds, questionCount),
    [featuredQuestionIds, questionCount, runtimeSeed.questions, runId],
  );
  const activeTopics = useMemo(
    () => topics.filter((topic) => topic.status === ACTIVE_TOPIC_STATUS),
    [topics],
  );
  const selectedTopic = topics.find((topic) => topic.id === selectedTopicId);
  const question = questions[current];
  const isAnswered = selected !== null;
  const isCorrect = selected === question?.correctIndex;
  const progress = questions.length ? ((current + 1) / questions.length) * 100 : 0;
  const done = started && current >= questions.length;
  const hasWon = score >= winThreshold;
  const introWords = selectedTopic?.label.split(" ") ?? [];
  const gameLine = `Speel ${questions.length} vragen · win vanaf ${winThreshold} goed`;

  useEffect(() => {
    soundEnabledRef.current = soundEnabled;
  }, [soundEnabled]);

  useEffect(() => {
    if (!started || !question || done) {
      setDisplayedPrompt("");
      setIsPromptTyping(false);
      setVisibleOptionCount(0);
      return;
    }

    setDisplayedPrompt("");
    setVisibleOptionCount(0);
    setIsPromptTyping(true);

    let characterIndex = 0;
    let revealIntervalId: number | undefined;

    const typingIntervalId = window.setInterval(() => {
      characterIndex += 1;
      setDisplayedPrompt(question.prompt.slice(0, characterIndex));

      if (characterIndex % 3 === 0 || characterIndex === question.prompt.length) {
        playSound("type");
      }

      if (characterIndex >= question.prompt.length) {
        window.clearInterval(typingIntervalId);
        setIsPromptTyping(false);

        let optionIndex = 0;
        revealIntervalId = window.setInterval(() => {
          optionIndex += 1;
          setVisibleOptionCount(optionIndex);
          playSound("option");

          if (optionIndex >= question.options.length) {
            if (revealIntervalId) window.clearInterval(revealIntervalId);
          }
        }, 170);
      }
    }, 14);

    return () => {
      window.clearInterval(typingIntervalId);
      if (revealIntervalId) window.clearInterval(revealIntervalId);
    };
  }, [current, done, question, runId, started]);

  useEffect(() => {
    if (!selectedTopic || started) {
      setVisibleIntroWords(0);
      setShowIntroDetails(false);
      setShowStartAction(false);
      return;
    }

    setVisibleIntroWords(0);
    setShowIntroDetails(false);
    setShowStartAction(false);

    const timeouts: number[] = [];
    const words = selectedTopic.label.split(" ");

    words.forEach((_, index) => {
      timeouts.push(
        window.setTimeout(() => {
          setVisibleIntroWords(index + 1);
          playSound("intro-word");
        }, 170 + index * 155),
      );
    });

    timeouts.push(
      window.setTimeout(() => {
        setShowIntroDetails(true);
        playSound("intro-reveal");
      }, 260 + words.length * 155),
    );

    timeouts.push(
      window.setTimeout(() => {
        setShowStartAction(true);
        playSound("start-ready");
      }, 680 + words.length * 155),
    );

    return () => {
      timeouts.forEach((timeoutId) => window.clearTimeout(timeoutId));
    };
  }, [selectedTopic, started]);

  function getAudioContext() {
    if (typeof window === "undefined") return null;

    const audioWindow = window as WindowWithWebAudio;
    const AudioContextCtor = audioWindow.AudioContext ?? audioWindow.webkitAudioContext;
    if (!AudioContextCtor) return null;

    if (!audioContextRef.current) {
      try {
        audioContextRef.current = new AudioContextCtor();
      } catch {
        return null;
      }
    }

    return audioContextRef.current;
  }

  function unlockAudio(playConfirmation = false) {
    const context = getAudioContext();
    if (!context) return;

    if (context.state === "suspended") {
      void context.resume().catch(() => {
        soundEnabledRef.current = false;
        setSoundEnabled(false);
      });
    }

    soundEnabledRef.current = true;
    setSoundEnabled(true);

    if (playConfirmation) {
      window.setTimeout(() => playTone(740, 0.05, "triangle", 0.035), 30);
    }
  }

  function playTone(frequency: number, duration: number, type: OscillatorType = "sine", volume = 0.025) {
    const context = audioContextRef.current;
    if (!context || !soundEnabledRef.current) return;

    try {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const now = context.currentTime;

      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, now);
      gain.gain.setValueAtTime(volume, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(now);
      oscillator.stop(now + duration + 0.02);
    } catch {
      soundEnabledRef.current = false;
      setSoundEnabled(false);
    }
  }

  function playSound(cue: SoundCue) {
    if (!soundEnabledRef.current || !audioContextRef.current) return;

    if (cue === "type") {
      playTone(880 + Math.random() * 120, 0.018, "square", 0.008);
      return;
    }

    if (cue === "option") {
      playTone(360, 0.07, "triangle", 0.034);
      window.setTimeout(() => playTone(560, 0.07, "triangle", 0.03), 48);
      window.setTimeout(() => playTone(760, 0.05, "sine", 0.022), 92);
      return;
    }

    if (cue === "radar") {
      playTone(300 + Math.random() * 80, 0.035, "square", 0.014);
      return;
    }

    if (cue === "radar-final") {
      playTone(520, 0.08, "triangle", 0.04);
      window.setTimeout(() => playTone(780, 0.1, "sine", 0.038), 86);
      window.setTimeout(() => playTone(1040, 0.12, "sine", 0.03), 180);
      return;
    }

    if (cue === "intro-word") {
      playTone(150, 0.055, "triangle", 0.034);
      window.setTimeout(() => playTone(420, 0.05, "sine", 0.024), 42);
      return;
    }

    if (cue === "intro-reveal") {
      playTone(460, 0.08, "triangle", 0.03);
      window.setTimeout(() => playTone(690, 0.11, "triangle", 0.026), 78);
      return;
    }

    if (cue === "insight") {
      playTone(540, 0.09, "triangle", 0.03);
      window.setTimeout(() => playTone(760, 0.1, "sine", 0.028), 70);
      window.setTimeout(() => playTone(1040, 0.12, "sine", 0.022), 145);
      return;
    }

    if (cue === "start-ready") {
      playTone(620, 0.08, "sine", 0.034);
      window.setTimeout(() => playTone(900, 0.12, "sine", 0.032), 92);
      return;
    }

    if (cue === "correct") {
      playTone(640, 0.08, "sine", 0.035);
      window.setTimeout(() => playTone(860, 0.12, "sine", 0.035), 85);
      return;
    }

    if (cue === "wrong") {
      playTone(170, 0.12, "sawtooth", 0.02);
      window.setTimeout(() => playTone(130, 0.12, "sawtooth", 0.016), 90);
      return;
    }

    if (cue === "toggle") {
      playTone(740, 0.06, "triangle", 0.026);
      return;
    }

    playTone(520, 0.06, "triangle", 0.024);
  }

  function toggleSound() {
    if (soundEnabled) {
      soundEnabledRef.current = false;
      setSoundEnabled(false);
      return;
    }

    unlockAudio(true);
  }

  function startQuiz() {
    unlockAudio(true);
    if (!selectedTopicId) {
      const fallbackTopic = activeTopics[0];
      if (!fallbackTopic || !loadTopicPack(fallbackTopic)) return;
      setSelectedTopicId(fallbackTopic.id);
    }
    setStarted(true);
    setCurrent(0);
    setSelected(null);
    setScore(0);
    setShowInsightDeck(false);
    setActiveInsightSlide(0);
    setRunId((id) => id + 1);
  }

  function answer(index: number) {
    if (selected !== null || !question) return;
    setSelected(index);
    playSound(index === question.correctIndex ? "correct" : "wrong");
    if (index === question.correctIndex) setScore((value) => value + 1);
  }

  function nextQuestion() {
    playSound("transition");
    setSelected(null);
    setCurrent((value) => value + 1);
  }

  function chooseTopic(topicId: string) {
    const topic = topics.find((candidate) => candidate.id === topicId);
    if (!topic) return;

    unlockAudio(false);
    setSpotlightTopicId(topic.id);

    if (topic.status !== ACTIVE_TOPIC_STATUS) {
      playSound("wrong");
      setTopicNotice(`${topic.label} staat nog niet actief. Zet dit onderwerp eerst live in de editor.`);
      return;
    }

    if (!loadTopicPack(topic)) {
      playSound("wrong");
      return;
    }

    setLockedTopicId(topic.id);
    playSound("radar-final");
    setTopicNotice(`${topic.label} is gekozen. Klaar voor de intro...`);

    window.setTimeout(() => {
      setSelectedTopicId(topic.id);
      setLockedTopicId(null);
    }, 780);
  }

  function drawTopic() {
    if (isDrawingTopic) return;

    unlockAudio(false);
    setIsDrawingTopic(true);
    setTopicNotice("De opinie-radar scant waar Nederland vandaag het meest over wil stemmen...");

    let steps = 0;
    const maxSteps = 26;
    const radarTopics = activeTopics;
    if (!radarTopics.length) {
      setIsDrawingTopic(false);
      setTopicNotice("Er staan nog geen actieve onderwerpen klaar. Zet er eentje actief in de editor.");
      return;
    }

    const spin = () => {
      const nextTopic = radarTopics[steps % radarTopics.length];
      setSpotlightTopicId(nextTopic.id);
      playSound("radar");
      steps += 1;

      if (steps >= maxSteps) {
        const pickedTopic = radarTopics[Math.floor(Math.random() * radarTopics.length)];
        setSpotlightTopicId(pickedTopic.id);
        setIsDrawingTopic(false);

        if (!loadTopicPack(pickedTopic)) {
          playSound("wrong");
          return;
        }

        setLockedTopicId(pickedTopic.id);
        playSound("radar-final");

        setTopicNotice(`De radar kiest: ${pickedTopic.label}. Even locken en dan door naar de intro.`);
        window.setTimeout(() => {
          setSelectedTopicId(pickedTopic.id);
          setLockedTopicId(null);
        }, 900);
        return;
      }

      const progress = steps / maxSteps;
      const nextDelay = Math.max(34, 175 - progress * 150);
      window.setTimeout(spin, nextDelay);
    };

    spin();
  }

  function backToTopics() {
    setSelectedTopicId(null);
    setStarted(false);
    setCurrent(0);
    setSelected(null);
    setScore(0);
    setLockedTopicId(null);
    setVisibleIntroWords(0);
    setShowIntroDetails(false);
    setShowStartAction(false);
    setShowInsightDeck(false);
    setActiveInsightSlide(0);
    setTopicNotice("Kies een onderwerp of laat de radar spannend bepalen.");
  }

  function openInsightDeck() {
    unlockAudio(false);
    setActiveInsightSlide(0);
    setShowInsightDeck(true);
    playSound("insight");
  }

  function nextInsightSlide() {
    setActiveInsightSlide((value) => (value + 1) % runtimeSeed.postQuizSlides.length);
    playSound("transition");
  }

  function previousInsightSlide() {
    setActiveInsightSlide((value) => (value - 1 + runtimeSeed.postQuizSlides.length) % runtimeSeed.postQuizSlides.length);
    playSound("toggle");
  }

  const resultBand = resultBands.find((band) => score >= band.min && score <= band.max) ?? resultBands[resultBands.length - 1];

  if (!started) {
    if (!selectedTopic) {
      return (
        <main className="page-shell kiosk-shell quiz-landing-shell">
          <section className={`public-quiz-stage ${isDrawingTopic ? "spinning" : ""}`}>
            <div className="public-quiz-orb orb-one" aria-hidden="true" />
            <div className="public-quiz-orb orb-two" aria-hidden="true" />

            <header className="public-quiz-header">
              <div className="public-quiz-brand">
                <span>PUBLIC</span>
                <strong>INSIGHTS</strong>
              </div>
              <p>{gameLine}</p>
            </header>

            <div className="public-quiz-title-row">
              <div>
                <p className="kicker">Publieke Peiler</p>
                <h1>Kies je onderwerp</h1>
                <p className="public-quiz-rule">
                  Speel {questionCount} vragen en win vanaf {winThreshold} goed
                </p>
              </div>
              <button className="radar-button" disabled={isDrawingTopic || !activeTopics.length} onClick={drawTopic} type="button">
                <span aria-hidden="true" />
                {isDrawingTopic ? "Radar draait..." : "Laat radar kiezen"}
              </button>
            </div>

            {activeTopics.length ? (
              <div className="public-topic-grid">
                {activeTopics.map((topic) => (
                  <button
                    className={`topic-card public-topic-card ${topic.accent} ${spotlightTopicId === topic.id ? "spotlight" : ""} ${lockedTopicId === topic.id ? "locked" : ""}`}
                    key={topic.id}
                    onClick={() => chooseTopic(topic.id)}
                    type="button"
                  >
                    <span className="topic-status">Actief</span>
                    <strong>{topic.label}</strong>
                    <span>{topic.prompt}</span>
                    <span className={`topic-visual ${topic.icon}`} aria-hidden="true" />
                  </button>
                ))}
              </div>
            ) : (
              <div className="empty-topic-state">
                <strong>Nog geen actieve onderwerpen</strong>
                <span>Zet in de editor minstens één onderwerp op actief.</span>
              </div>
            )}

            <footer className="public-quiz-footer">
              <span>{topicNotice}</span>
              <span>Na elk antwoord zie je kort waarom, met echte reacties als bewijs.</span>
            </footer>
          </section>
        </main>
      );
    }

    return (
      <main className="page-shell kiosk-shell">
        <section className="topic-start-card topic-intro-card">
          <button className="back-button" onClick={backToTopics} type="button">
            Terug naar topics
          </button>
          <p className="kicker topic-intro-kicker">Onderwerp gekozen</p>
          <h1 aria-label={selectedTopic.label} className="topic-intro-title">
            {introWords.slice(0, visibleIntroWords).map((word, index) => (
              <span key={`${word}-${index}`}>{word}</span>
            ))}
          </h1>

          {showIntroDetails ? (
            <div className="topic-intro-details">
              <p className="subtitle">{runtimeSeed.subtitle}</p>
              <div className="article-card">
                <p className="article-eyebrow">Gebaseerd op de dump</p>
                <h2>“{runtimeSeed.source.article_title}”</h2>
                <p>
                  Publieke reacties · {runtimeSeed.source.publication_date} · {runtimeSeed.source.analyzed_comments}{" "}
                  reacties geanalyseerd
                </p>
              </div>

              <div className="intro-stats">
                <div>
                  <span>Spelvorm</span>
                  <strong>{questions.length} vragen</strong>
                </div>
                <div>
                  <span>Winnen</span>
                  <strong>
                    {winThreshold}/{questions.length} goed
                  </strong>
                </div>
                <div>
                  <span>Na elk antwoord</span>
                  <strong>Waarom + echte quotes</strong>
                </div>
              </div>
            </div>
          ) : null}

          {showStartAction ? (
            <div className="hero-actions intro-actions">
              <button className="primary-button intro-start-button" onClick={startQuiz}>
                Start quiz!
              </button>
            </div>
          ) : null}
        </section>
      </main>
    );
  }

  if (done) {
    if (showInsightDeck && runtimeSeed.postQuizSlides.length) {
      return (
        <InsightMiniDeck
          activeIndex={activeInsightSlide}
          onBackToScore={() => setShowInsightDeck(false)}
          onNext={nextInsightSlide}
          onPrevious={previousInsightSlide}
          onRestart={startQuiz}
          onTopics={backToTopics}
          slides={runtimeSeed.postQuizSlides}
        />
      );
    }

    return (
      <main className="page-shell">
        <section className={`result-card ${hasWon ? "won" : "not-yet"}`}>
          {hasWon ? <PartyParticles /> : null}
          <p className="kicker">Uitslag</p>
          <h1>{hasWon ? "Succes, je hebt gewonnen!" : resultBand.title}</h1>
          {hasWon ? (
            <div className="victory-badge">
              <span>Winst gehaald</span>
              <strong>
                {score}/{questions.length}
              </strong>
              <span>publieke patronen gezien</span>
            </div>
          ) : null}
          <p className="subtitle">
            Je score: {score} van {questions.length}. {resultBand.description}
          </p>

          <p className="result-message">
            {hasWon
              ? `Winstregel gehaald: vanaf ${winThreshold} goede antwoorden win je. Jij zag genoeg patronen om de valkuilen in de reacties te doorzien.`
              : `Nog net niet: vanaf ${winThreshold} goede antwoorden win je. Speel nog een keer en let vooral op de uitleg na elk antwoord.`}
          </p>

          <div className="score-grid">
            <div className="score-card">
              <span>Goed</span>
              <strong>{score}</strong>
              <span>van {questions.length}</span>
            </div>
            <div className="score-card">
              <span>Bronbasis</span>
              <strong>{runtimeSeed.source.analyzed_comments}</strong>
              <span>reacties</span>
            </div>
          </div>

          <p className="small-note">
            Gebruik deze quiz als gesprekstarter. Voor serieus rapporteren blijft de brondata leidend.
          </p>

          <div className="hero-actions">
            {runtimeSeed.postQuizSlides.length ? (
              <button className="primary-button" onClick={openInsightDeck} type="button">
                Bekijk inzichten
              </button>
            ) : null}
            <button className="secondary-button" onClick={startQuiz}>
              Speel opnieuw
            </button>
            <button className="secondary-button" onClick={backToTopics}>
              Speel nog een topic
            </button>
          </div>
        </section>
      </main>
    );
  }

  const labels = question.evidence.codes.map((code) => cleanCodeLabel(code, runtimeEvidenceContext));
  const exampleQuotes = question.evidence.quotes;

  return (
    <main className="page-shell quiz-play-shell">
      <section className={`quiz-card ${isAnswered ? "answered" : ""}`}>
        <div className="progress" aria-label="Voortgang">
          <div style={{ width: `${progress}%` }} />
        </div>

        <div className="quiz-stage-grid">
          <div className="quiz-question-panel">
            <div className="quiz-topline">
              <span className="tone-pill">{formatTone(question.tone)}</span>
              <button
                className={`sound-toggle ${soundEnabled ? "active" : ""}`}
                onClick={toggleSound}
                type="button"
              >
                {soundEnabled ? "Geluid aan" : "Geluid uit"}
              </button>
            </div>
            <p className="kicker">
              Vraag {current + 1} van {questions.length}
            </p>
            {question.context ? <p className="question-context">{question.context}</p> : null}
            <h2 aria-label={question.prompt} className="typing-question">
              {displayedPrompt}
              {isPromptTyping ? <span className="type-cursor" aria-hidden="true">|</span> : null}
            </h2>

            <div className="options">
              {question.options.slice(0, visibleOptionCount).map((option, index) => {
                const className =
                  selected === null
                    ? "option-button staged-option"
                    : index === question.correctIndex
                      ? "option-button staged-option correct"
                      : selected === index
                        ? "option-button staged-option wrong"
                        : "option-button staged-option";

                return (
                  <button
                    key={option}
                    className={className}
                    onClick={() => answer(index)}
                    style={{ "--option-delay": `${index * 55}ms` } as CSSProperties}
                  >
                    <span className="option-label">{option}</span>
                    {isAnswered && question.optionDetails[index] ? (
                      <span className="option-detail">{question.optionDetails[index]}</span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>

          {isAnswered && (
            <aside className="answer-panel">
              <div className="feedback">
                <p>
                  <strong>{isCorrect ? "Goed gezien." : "Bijna."}</strong>{" "}
                  {isCorrect ? question.feedbackCorrect : question.feedbackWrong}
                </p>

                <button className="primary-button" onClick={nextQuestion}>
                  {current + 1 === questions.length ? "Bekijk uitslag" : "Volgende vraag"}
                </button>
              </div>

              <div className="evidence">
                <p className="evidence-eyebrow">Uitleg</p>
                <h3>Waarom dit het antwoord is</h3>
                <p>{summarizeEvidence(question, labels)}</p>

                <CountUpStat
                  denominator={question.evidence.denominator}
                  pct={question.evidence.pct}
                  resetKey={`${question.id}-${selected}`}
                  value={question.evidence.n}
                />

                {question.evidence.comparison ? (
                  <dl className="evidence-facts">
                    <div>
                      <dt>Ter vergelijking</dt>
                      <dd>
                        {Object.entries(question.evidence.comparison)
                          .map(([label, value]) => {
                            const pct = value.pct !== undefined ? ` (${value.pct}%)` : "";
                            return `${cleanCodeLabel(label, runtimeEvidenceContext)}: ${value.n}${pct}`;
                          })
                          .join(", ")}
                      </dd>
                    </div>
                  </dl>
                ) : null}

                {labels.length ? (
                  <div className="theme-list" aria-label="Onderwerpen">
                    {labels.map((label) => (
                      <span key={label}>{label}</span>
                    ))}
                  </div>
                ) : null}

                <QuoteSlideshow items={exampleQuotes} />

                {question.evidence.note ? <p className="small-note">{question.evidence.note}</p> : null}

                {(question.evidence.codes.length || question.evidence.comment_ids.length) ? (
                  <details className="audit-trail">
                    <summary>Technische check</summary>
                    {question.evidence.codes.length ? (
                      <p>
                        <strong>Interne codes:</strong>{" "}
                        {question.evidence.codes.map((code) => (
                          <code key={code}>{code}</code>
                        ))}
                      </p>
                    ) : null}
                    {question.evidence.comment_ids.length ? (
                      <p>
                        <strong>Comment-ID's:</strong> {question.evidence.comment_ids.join(", ")}
                      </p>
                    ) : null}
                    <p className="small-note">{question.evidence.claim}</p>
                  </details>
                ) : null}
              </div>
            </aside>
          )}
        </div>
      </section>
    </main>
  );
}
