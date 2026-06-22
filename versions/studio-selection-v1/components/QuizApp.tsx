"use client";

import { type CSSProperties, useEffect, useMemo, useState } from "react";
import { STUDIO_ACTIVE_PACK_KEY } from "@/lib/studioStorage";

type Evidence = {
  claim: string;
  n?: number;
  denominator?: number;
  pct?: number;
  codes?: string[];
  comment_ids?: string[];
  note?: string;
  comparison?: Record<string, { n: number; pct?: number }>;
};

export type EvidenceContext = {
  codeLabels: Record<string, string>;
  comments: Record<
    string,
    {
      text: string;
      likes?: number;
      themeLabels?: string[];
      stanceLabel?: string;
      emotion?: string;
      slideUse?: string;
    }
  >;
};

type EvidenceComment = EvidenceContext["comments"][string];
type ExampleComment = {
  commentId: string;
  comment: EvidenceComment;
};

type Question = {
  id: string;
  type: "multiple_choice" | "true_false";
  tone: string;
  context?: string;
  prompt: string;
  options: string[];
  optionDetails?: string[];
  correctIndex: number;
  feedbackCorrect: string;
  feedbackWrong: string;
  evidence: Evidence;
};

type ResultBand = {
  min: number;
  max: number;
  title: string;
  description: string;
};

export type QuizSeed = {
  game?: {
    featuredQuestionIds?: string[];
    questionCount?: number;
    winThreshold?: number;
  };
  quizTitle: string;
  subtitle: string;
  source: {
    analyzed_comments: number;
    article_title: string;
    publication_date: string;
    rules: string[];
  };
  questions: Question[];
  resultBands: ResultBand[];
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

const FEATURED_QUESTION_IDS = ["Q05", "Q08", "Q02", "Q07", "Q06"];
const WIN_THRESHOLD = 3;

function pickFeaturedQuestions(input: Question[], featuredIds: string[], questionCount: number) {
  const byId = new Map(input.map((question) => [question.id, question]));
  const featured = featuredIds.flatMap((id) => {
    const question = byId.get(id);
    return question ? [question] : [];
  });

  return featured.length === questionCount ? featured : input.slice(0, questionCount);
}

function formatPct(pct?: number) {
  return pct === undefined ? undefined : `${String(pct).replace(".", ",")}%`;
}

function cleanCodeLabel(code: string, evidenceContext: EvidenceContext) {
  if (code.startsWith("stance:")) {
    const stance = code.replace("stance:", "");
    if (stance === "Alternatief: ouders/platforms") return "Oplossing via ouders of platforms";
    if (stance === "Anti-/privacy-kritisch") return "Kritisch door privacyzorgen";
    if (stance === "Gemengd/ambivalent") return "Twijfelend";
    return stance;
  }

  if (code.startsWith("emotion:")) return code.replace("emotion:", "Gevoel: ");

  return evidenceContext.codeLabels[code] ?? FALLBACK_CODE_LABELS[code] ?? code;
}

function summarizeEvidence(question: Question, labels: string[]) {
  const firstLabel = labels[0]?.toLowerCase();

  if (question.evidence.codes?.includes("strategic_lenses.whize_hypotheses")) {
    return "Dit is alleen een ruwe gok. Je mag er geen harde uitspraak over mensen van maken.";
  }

  if (question.evidence.codes?.includes("gender_signal_summary")) {
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
  denominator?: number;
  pct?: number;
  resetKey: string;
  value?: number;
}) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    if (value === undefined) return;

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

  if (value === undefined || denominator === undefined) {
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

function QuoteSlideshow({ items }: { items: ExampleComment[] }) {
  const [active, setActive] = useState(0);
  const itemKey = items.map((item) => item.commentId).join("|");

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
  const quote = cleanQuoteText(current.comment.text);

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

      <figure className="quote-slide" key={current.commentId}>
        <blockquote>{quote}</blockquote>
        <figcaption>{formatCommentMeta(current.comment)}</figcaption>
      </figure>

      {items.length > 1 ? (
        <div className="quote-controls" aria-label="Blader door bronquotes">
          <button type="button" onClick={showPrevious}>
            Vorige
          </button>
          <div className="quote-dots" aria-label="Quote voortgang">
            {items.map((item, index) => (
              <button
                key={item.commentId}
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

function PartyParticles() {
  const particles = Array.from({ length: 32 }, (_, index) => index);

  return (
    <div className="party-particles" aria-hidden="true">
      {particles.map((index) => {
        const style = {
          "--x": `${(index % 8) * 13 - 45}px`,
          "--y": `${Math.floor(index / 8) * 18 + 80}px`,
          "--delay": `${(index % 10) * 80}ms`,
          "--hue": `${(index * 37) % 360}`,
          "--size": `${8 + (index % 4) * 3}px`,
        } as CSSProperties & Record<string, string>;

        return <span key={index} style={style} />;
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
  const [runtimeSeed, setRuntimeSeed] = useState(seed);
  const [runtimeEvidenceContext, setRuntimeEvidenceContext] = useState(evidenceContext);
  const [started, setStarted] = useState(false);
  const [runId, setRunId] = useState(0);
  const [current, setCurrent] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [score, setScore] = useState(0);

  useEffect(() => {
    try {
      const storedPack = window.localStorage.getItem(STUDIO_ACTIVE_PACK_KEY);

      if (!storedPack) {
        setRuntimeSeed(seed);
        setRuntimeEvidenceContext(evidenceContext);
        return;
      }

      const parsed = JSON.parse(storedPack) as {
        evidenceContext?: EvidenceContext;
        seed?: QuizSeed;
      };

      if (!parsed.seed?.questions?.length) return;

      setRuntimeSeed(parsed.seed);
      setRuntimeEvidenceContext(parsed.evidenceContext ?? evidenceContext);
    } catch {
      setRuntimeSeed(seed);
      setRuntimeEvidenceContext(evidenceContext);
    }
  }, [evidenceContext, seed]);

  const questionCount = runtimeSeed.game?.questionCount ?? 5;
  const winThreshold = runtimeSeed.game?.winThreshold ?? WIN_THRESHOLD;
  const featuredQuestionIds = runtimeSeed.game?.featuredQuestionIds ?? FEATURED_QUESTION_IDS;
  const questions = useMemo(
    () => pickFeaturedQuestions(runtimeSeed.questions, featuredQuestionIds, questionCount),
    [featuredQuestionIds, questionCount, runtimeSeed.questions, runId],
  );
  const question = questions[current];
  const isAnswered = selected !== null;
  const isCorrect = selected === question?.correctIndex;
  const progress = questions.length ? ((current + 1) / questions.length) * 100 : 0;
  const done = started && current >= questions.length;
  const hasWon = score >= winThreshold;

  function startQuiz() {
    setStarted(true);
    setCurrent(0);
    setSelected(null);
    setScore(0);
    setRunId((id) => id + 1);
  }

  function answer(index: number) {
    if (selected !== null) return;
    setSelected(index);
    if (index === question.correctIndex) setScore((value) => value + 1);
  }

  function nextQuestion() {
    setSelected(null);
    setCurrent((value) => value + 1);
  }

  const resultBand =
    runtimeSeed.resultBands.find((band) => score >= band.min && score <= band.max) ??
    runtimeSeed.resultBands[runtimeSeed.resultBands.length - 1];

  if (!started) {
    return (
      <main className="page-shell">
        <section className="hero">
          <p className="kicker">Reactiequiz</p>
          <h1>{runtimeSeed.quizTitle}</h1>
          <p className="subtitle">{runtimeSeed.subtitle}</p>

          <div className="meta-grid">
            <div className="meta-card">
              <span>Gekeken naar</span>
              <strong>{runtimeSeed.source.analyzed_comments}</strong>
              <span>reacties</span>
            </div>
            <div className="meta-card">
              <span>Bron</span>
              <strong>NUjij</strong>
              <span>{runtimeSeed.source.publication_date}</span>
            </div>
            <div className="meta-card">
              <span>Spelvorm</span>
              <strong>{questions.length}</strong>
              <span>snelle vragen</span>
            </div>
            <div className="meta-card win-rule">
              <span>Winnen</span>
              <strong>
                {winThreshold}/{questions.length}
              </strong>
              <span>goed is genoeg</span>
            </div>
          </div>

          <p className="small-note">
            Geen voorkennis nodig. Raad wat 799 reacties echt lieten zien, krijg na elk antwoord meteen de waarom, en pak bij{" "}
            {winThreshold} goede antwoorden de winstanimatie.
          </p>

          <p className="context-note">
            Waar gaat dit over? Een NUjij-discussie bij het artikel: “{runtimeSeed.source.article_title}”.
          </p>

          <div className="hero-actions">
            <button className="primary-button" onClick={startQuiz}>
              Start de quiz
            </button>
            <a className="secondary-button" href="/studio">
              Open quizstudio
            </a>
          </div>
        </section>
      </main>
    );
  }

  if (done) {
    return (
      <main className="page-shell">
        <section className={`result-card ${hasWon ? "won" : "not-yet"}`}>
          {hasWon ? <PartyParticles /> : null}
          <p className="kicker">Uitslag</p>
          <h1>{hasWon ? "Succes, je hebt gewonnen!" : resultBand.title}</h1>
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

          <button className="secondary-button" onClick={startQuiz}>
            Speel opnieuw
          </button>
        </section>
      </main>
    );
  }

  const labels = question.evidence.codes?.map((code) => cleanCodeLabel(code, runtimeEvidenceContext)) ?? [];
  const exampleComments =
    question.evidence.comment_ids
      ?.map((commentId) => ({ commentId, comment: runtimeEvidenceContext.comments[commentId] }))
      .filter(({ comment }) => Boolean(comment)) ?? [];

  return (
    <main className="page-shell">
      <section className="quiz-card">
        <div className="progress" aria-label="Voortgang">
          <div style={{ width: `${progress}%` }} />
        </div>

        <span className="tone-pill">{formatTone(question.tone)}</span>
        <p className="kicker">
          Vraag {current + 1} van {questions.length}
        </p>
        {question.context ? <p className="question-context">{question.context}</p> : null}
        <h2>{question.prompt}</h2>

        <div className="options">
          {question.options.map((option, index) => {
            const className =
              selected === null
                ? "option-button"
                : index === question.correctIndex
                  ? "option-button correct"
                  : selected === index
                    ? "option-button wrong"
                    : "option-button";

            return (
              <button key={option} className={className} onClick={() => answer(index)}>
                <span className="option-label">{option}</span>
                {question.optionDetails?.[index] ? (
                  <span className="option-detail">{question.optionDetails[index]}</span>
                ) : null}
              </button>
            );
          })}
        </div>

        {isAnswered && (
          <div className="feedback">
            <strong>{isCorrect ? "Goed gezien." : "Bijna."}</strong>{" "}
            {isCorrect ? question.feedbackCorrect : question.feedbackWrong}

            <div className="footer-actions">
              <button className="primary-button" onClick={nextQuestion}>
                {current + 1 === questions.length ? "Bekijk uitslag" : "Volgende vraag"}
              </button>
            </div>
          </div>
        )}

        {isAnswered && (
          <aside className="evidence">
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

            <QuoteSlideshow items={exampleComments} />

            {question.evidence.note ? <p className="small-note">{question.evidence.note}</p> : null}

            {(question.evidence.codes?.length || question.evidence.comment_ids?.length) ? (
              <details className="audit-trail">
                <summary>Technische check</summary>
                {question.evidence.codes?.length ? (
                  <p>
                    <strong>Interne codes:</strong>{" "}
                    {question.evidence.codes.map((code) => (
                      <code key={code}>{code}</code>
                    ))}
                  </p>
                ) : null}
                {question.evidence.comment_ids?.length ? (
                  <p>
                    <strong>Comment-ID's:</strong> {question.evidence.comment_ids.join(", ")}
                  </p>
                ) : null}
                <p className="small-note">{question.evidence.claim}</p>
              </details>
            ) : null}
          </aside>
        )}
      </section>
    </main>
  );
}
