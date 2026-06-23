"use client";

import { type ChangeEvent, useEffect, useMemo, useState } from "react";
import type { EvidenceContext, QuizSeed } from "@/components/QuizApp";
import { buildEvidenceContext, type DashboardBundle } from "@/lib/evidence";
import { STUDIO_ACTIVE_PACK_KEY, STUDIO_CUSTOM_PACKS_KEY } from "@/lib/studioStorage";

const QUESTION_TARGET = 10;
const WIN_THRESHOLD = 6;

type QuizQuestion = QuizSeed["questions"][number];

type StudioStoredPack = {
  evidenceContext: EvidenceContext;
  id: string;
  name: string;
  seed: QuizSeed;
  selectedQuestionIds: string[];
  sourceName?: string;
  updatedAt: string;
};

type UploadShape = {
  dashboard?: DashboardBundle;
  dashboardBundle?: DashboardBundle;
  dump?: DashboardBundle;
  evidenceContext?: EvidenceContext;
  quizSeed?: QuizSeed;
  seed?: QuizSeed;
};

const DEFAULT_RESULT_BANDS = [
  {
    min: 0,
    max: 5,
    title: "Nog niet gewonnen",
    description: "Je zat in de buurt, maar 6 van de 10 is de winstgrens.",
  },
  {
    min: 6,
    max: 8,
    title: "Gewonnen: Publieke Peiler",
    description: "Je had genoeg verrassingen te pakken. Je leest de onderstroom van de reacties scherp.",
  },
  {
    min: 9,
    max: 10,
    title: "Perfecte Peiler",
    description: "Bijna alles goed. Jij voelde precies aan waar de reacties anders waren dan je misschien verwacht.",
  },
];

function isQuizSeed(value: unknown): value is QuizSeed {
  const candidate = value as Partial<QuizSeed> | undefined;
  return Boolean(candidate?.quizTitle && Array.isArray(candidate?.questions));
}

function isDashboardBundle(value: unknown): value is DashboardBundle {
  const candidate = value as DashboardBundle | undefined;
  return Boolean(candidate?.counts || candidate?.comments || candidate?.quote_bank);
}

function extractSeed(value: unknown) {
  if (isQuizSeed(value)) return value;

  const wrapped = value as UploadShape | undefined;
  if (isQuizSeed(wrapped?.seed)) return wrapped.seed;
  if (isQuizSeed(wrapped?.quizSeed)) return wrapped.quizSeed;

  return undefined;
}

function extractDashboard(value: unknown) {
  if (isDashboardBundle(value)) return value;

  const wrapped = value as UploadShape | undefined;
  if (isDashboardBundle(wrapped?.dashboardBundle)) return wrapped.dashboardBundle;
  if (isDashboardBundle(wrapped?.dashboard)) return wrapped.dashboard;
  if (isDashboardBundle(wrapped?.dump)) return wrapped.dump;

  return undefined;
}

function getInitialSelection(seed: QuizSeed, preferredIds = seed.game?.featuredQuestionIds) {
  const validIds = new Set(seed.questions.map((question) => question.id));
  const configuredIds = preferredIds?.filter((id) => validIds.has(id)).slice(0, QUESTION_TARGET) ?? [];

  if (configuredIds.length === QUESTION_TARGET) return configuredIds;

  const fallbackIds = seed.questions
    .map((question) => question.id)
    .filter((id) => !configuredIds.includes(id))
    .slice(0, QUESTION_TARGET - configuredIds.length);

  return [...configuredIds, ...fallbackIds];
}

function normalizeSeed(seed: QuizSeed, selectedQuestionIds: string[]): QuizSeed {
  const hasTargetBands = seed.resultBands.some((band) => band.max >= QUESTION_TARGET);

  return {
    ...seed,
    game: {
      ...seed.game,
      featuredQuestionIds: selectedQuestionIds,
      questionCount: QUESTION_TARGET,
      winThreshold: WIN_THRESHOLD,
    },
    resultBands: hasTargetBands ? seed.resultBands : DEFAULT_RESULT_BANDS,
  };
}

function cloneQuestion(question: QuizQuestion): QuizQuestion {
  return {
    ...question,
    evidence: {
      ...question.evidence,
      codes: question.evidence.codes ? [...question.evidence.codes] : undefined,
      comment_ids: question.evidence.comment_ids ? [...question.evidence.comment_ids] : undefined,
      comparison: question.evidence.comparison ? { ...question.evidence.comparison } : undefined,
    },
    optionDetails: question.optionDetails ? [...question.optionDetails] : question.options.map(() => ""),
    options: [...question.options],
  };
}

function readStoredPacks() {
  try {
    const raw = window.localStorage.getItem(STUDIO_CUSTOM_PACKS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as StudioStoredPack[];
    return Array.isArray(parsed) ? parsed.filter((pack) => pack.seed?.questions?.length) : [];
  } catch {
    return [];
  }
}

function upsertPack(packs: StudioStoredPack[], nextPack: StudioStoredPack) {
  const others = packs.filter((pack) => pack.id !== nextPack.id);
  return [nextPack, ...others];
}

function questionStat(seed: QuizSeed, questionId: string) {
  const question = seed.questions.find((candidate) => candidate.id === questionId);
  if (!question?.evidence.n || !question.evidence.denominator) return "geen telling";

  const pct = question.evidence.pct !== undefined ? ` (${String(question.evidence.pct).replace(".", ",")}%)` : "";
  return `${question.evidence.n} van ${question.evidence.denominator}${pct}`;
}

export default function QuizStudio({
  defaultDashboard,
  defaultSeed,
}: {
  defaultDashboard: DashboardBundle;
  defaultSeed: QuizSeed;
}) {
  const defaultEvidenceContext = useMemo(
    () => buildEvidenceContext(defaultSeed, defaultDashboard),
    [defaultDashboard, defaultSeed],
  );
  const [currentDashboard, setCurrentDashboard] = useState(defaultDashboard);
  const [currentEvidenceContext, setCurrentEvidenceContext] = useState(defaultEvidenceContext);
  const [currentPackId, setCurrentPackId] = useState("builtin");
  const [currentSeed, setCurrentSeed] = useState(defaultSeed);
  const [customPacks, setCustomPacks] = useState<StudioStoredPack[]>([]);
  const [draftQuestion, setDraftQuestion] = useState<QuizQuestion | null>(null);
  const [notice, setNotice] = useState("Kies minimaal 10 vragen. Daarna gebruikt de publieke quiz precies die selectie.");
  const [selectedQuestionIds, setSelectedQuestionIds] = useState(() => getInitialSelection(defaultSeed));

  useEffect(() => {
    const storedPacks = readStoredPacks();
    setCustomPacks(storedPacks);

    try {
      const activeRaw = window.localStorage.getItem(STUDIO_ACTIVE_PACK_KEY);
      if (!activeRaw) return;

      const activePack = JSON.parse(activeRaw) as StudioStoredPack;
      if (!activePack.seed?.questions?.length) return;
      if ((activePack.seed.game?.questionCount ?? 0) < QUESTION_TARGET) {
        window.localStorage.removeItem(STUDIO_ACTIVE_PACK_KEY);
        setNotice("Oude 5-vragenselectie genegeerd. De studio werkt nu met minimaal 10 vragen.");
        return;
      }

      setCurrentEvidenceContext(activePack.evidenceContext ?? defaultEvidenceContext);
      setCurrentPackId(activePack.id);
      setCurrentSeed(activePack.seed);
      setSelectedQuestionIds(getInitialSelection(activePack.seed, activePack.selectedQuestionIds));
      setNotice("Actieve quizselectie geladen. Je kunt hem aanpassen en opnieuw opslaan.");
    } catch {
      setNotice("De ingebouwde dump is geladen.");
    }
  }, [defaultEvidenceContext]);

  const selectedQuestions = selectedQuestionIds
    .map((id) => currentSeed.questions.find((question) => question.id === id))
    .filter(Boolean);

  function loadBuiltInPack() {
    setCurrentDashboard(defaultDashboard);
    setCurrentEvidenceContext(defaultEvidenceContext);
    setCurrentPackId("builtin");
    setCurrentSeed(defaultSeed);
    setSelectedQuestionIds(getInitialSelection(defaultSeed));
    setDraftQuestion(null);
    setNotice("Ingebouwde dump geladen. Selecteer je favoriete 10 vragen.");
  }

  function loadStoredPack(packId: string) {
    if (packId === "builtin") {
      loadBuiltInPack();
      return;
    }

    const pack = customPacks.find((candidate) => candidate.id === packId);
    if (!pack) return;

    setCurrentEvidenceContext(pack.evidenceContext);
    setCurrentPackId(pack.id);
    setCurrentSeed(pack.seed);
    setSelectedQuestionIds(getInitialSelection(pack.seed, pack.selectedQuestionIds));
    setDraftQuestion(null);
    setNotice(`Dump geladen: ${pack.name}. Kies de 10 vragen die publiek moeten worden.`);
  }

  async function handleUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const parsed = JSON.parse(await file.text()) as UploadShape;
      const uploadedSeed = extractSeed(parsed);
      const uploadedDashboard = extractDashboard(parsed);

      if (!uploadedSeed && !uploadedDashboard) {
        setNotice("Ik herken dit JSON-bestand niet als quiz-pack of dashboard-bundle.");
        return;
      }

      const nextSeed = uploadedSeed ?? currentSeed;
      const nextDashboard = uploadedDashboard ?? currentDashboard;
      const nextEvidenceContext = parsed.evidenceContext ?? buildEvidenceContext(nextSeed, nextDashboard);
      const nextSelection = getInitialSelection(nextSeed);

      setCurrentDashboard(nextDashboard);
      setCurrentEvidenceContext(nextEvidenceContext);
      setCurrentSeed(nextSeed);
      setSelectedQuestionIds(nextSelection);
      setDraftQuestion(null);

      if (uploadedSeed) {
        const nextPack: StudioStoredPack = {
          evidenceContext: nextEvidenceContext,
          id: `custom-${Date.now()}`,
          name: nextSeed.quizTitle,
          seed: normalizeSeed(nextSeed, nextSelection),
          selectedQuestionIds: nextSelection,
          sourceName: file.name,
          updatedAt: new Date().toISOString(),
        };
        const nextPacks = upsertPack(customPacks, nextPack);

        window.localStorage.setItem(STUDIO_CUSTOM_PACKS_KEY, JSON.stringify(nextPacks));
        setCustomPacks(nextPacks);
        setCurrentPackId(nextPack.id);
        setNotice(
          nextSeed.questions.length >= QUESTION_TARGET
            ? `Quiz-pack geladen uit ${file.name}. Kies nu je favoriete 10 vragen.`
            : `Quiz-pack geladen, maar bevat maar ${nextSeed.questions.length} vragen. Maak of upload minimaal 10 vragen voordat je publiceert.`,
        );
      } else {
        setNotice(`Dashboard-bundle geladen uit ${file.name}. De huidige quizvragen gebruiken nu deze dump als bron.`);
      }
    } catch {
      setNotice("Upload mislukt. Check of het bestand geldige JSON is.");
    } finally {
      event.target.value = "";
    }
  }

  function toggleQuestion(questionId: string) {
    setSelectedQuestionIds((current) => {
      if (current.includes(questionId)) return current.filter((id) => id !== questionId);
      if (current.length >= QUESTION_TARGET) {
        setNotice("Je hebt al 10 vragen gekozen. Haal er eerst eentje uit.");
        return current;
      }

      setNotice("Selectie bijgewerkt. Sla op zodra je 10 vragen hebt.");
      return [...current, questionId];
    });
  }

  function persistActivePack(seedToSave: QuizSeed, selectionToSave: string[], successNotice: string) {
    if (seedToSave.questions.length < QUESTION_TARGET) {
      setNotice(`Deze quiz heeft maar ${seedToSave.questions.length} vragen. Maak of upload minimaal 10 vragen.`);
      return false;
    }

    if (selectionToSave.length !== QUESTION_TARGET) {
      setNotice(`Kies precies ${QUESTION_TARGET} vragen voordat je opslaat.`);
      return false;
    }

    const normalizedSeed = normalizeSeed(seedToSave, selectionToSave);
    const nextPack: StudioStoredPack = {
      evidenceContext: currentEvidenceContext,
      id: currentPackId === "builtin" ? "active-built-in" : currentPackId,
      name: normalizedSeed.quizTitle,
      seed: normalizedSeed,
      selectedQuestionIds: selectionToSave,
      sourceName: currentPackId === "builtin" ? "ingebouwde dump" : undefined,
      updatedAt: new Date().toISOString(),
    };

    window.localStorage.setItem(STUDIO_ACTIVE_PACK_KEY, JSON.stringify(nextPack));

    if (currentPackId !== "builtin" && customPacks.some((pack) => pack.id === currentPackId)) {
      const nextPacks = upsertPack(customPacks, nextPack);
      window.localStorage.setItem(STUDIO_CUSTOM_PACKS_KEY, JSON.stringify(nextPacks));
      setCustomPacks(nextPacks);
    }

    setCurrentSeed(normalizedSeed);
    setCurrentPackId(nextPack.id);
    setSelectedQuestionIds(selectionToSave);
    setNotice(successNotice);
    return true;
  }

  function saveSelection() {
    if (selectedQuestionIds.length !== QUESTION_TARGET) {
      setNotice(`Kies precies ${QUESTION_TARGET} vragen voordat je opslaat.`);
      return;
    }

    persistActivePack(currentSeed, selectedQuestionIds, "Opgeslagen. De publieke quiz gebruikt nu deze 10 vragen.");
  }

  function startEditing(questionId: string) {
    const question = currentSeed.questions.find((candidate) => candidate.id === questionId);
    if (!question) return;

    setDraftQuestion(cloneQuestion(question));
    setNotice(`Je bewerkt nu ${question.id}. Sla op om dit in de publieke quiz te gebruiken.`);
  }

  function updateDraftField<K extends keyof QuizQuestion>(field: K, value: QuizQuestion[K]) {
    setDraftQuestion((current) => (current ? { ...current, [field]: value } : current));
  }

  function updateDraftEvidence(field: keyof QuizQuestion["evidence"], value: string | number | undefined) {
    setDraftQuestion((current) =>
      current
        ? {
            ...current,
            evidence: {
              ...current.evidence,
              [field]: value,
            },
          }
        : current,
    );
  }

  function updateDraftOption(index: number, value: string) {
    setDraftQuestion((current) => {
      if (!current) return current;
      const nextOptions = [...current.options];
      nextOptions[index] = value;
      return { ...current, options: nextOptions };
    });
  }

  function updateDraftOptionDetail(index: number, value: string) {
    setDraftQuestion((current) => {
      if (!current) return current;
      const nextDetails = current.optionDetails ? [...current.optionDetails] : current.options.map(() => "");
      nextDetails[index] = value;
      return { ...current, optionDetails: nextDetails };
    });
  }

  function saveQuestionEdits() {
    if (!draftQuestion) return;

    const cleanOptions = draftQuestion.options.map((option) => option.trim());
    if (!draftQuestion.prompt.trim() || cleanOptions.some((option) => !option)) {
      setNotice("Vul minimaal de vraag en alle antwoordopties in voordat je opslaat.");
      return;
    }

    const cleanQuestion: QuizQuestion = {
      ...draftQuestion,
      context: draftQuestion.context?.trim(),
      feedbackCorrect: draftQuestion.feedbackCorrect.trim(),
      feedbackWrong: draftQuestion.feedbackWrong.trim(),
      optionDetails: (draftQuestion.optionDetails ?? draftQuestion.options.map(() => "")).map((detail) => detail.trim()),
      options: cleanOptions,
      prompt: draftQuestion.prompt.trim(),
    };
    const nextSeed = {
      ...currentSeed,
      questions: currentSeed.questions.map((question) => (question.id === cleanQuestion.id ? cleanQuestion : question)),
    };
    const nextSelection = getInitialSelection(nextSeed, selectedQuestionIds);

    if (persistActivePack(nextSeed, nextSelection, `Vraag ${cleanQuestion.id} opgeslagen. De publieke quiz gebruikt je aangepaste tekst.`)) {
      setDraftQuestion(cloneQuestion(cleanQuestion));
    }
  }

  function resetPublicQuiz() {
    window.localStorage.removeItem(STUDIO_ACTIVE_PACK_KEY);
    loadBuiltInPack();
    setNotice("Publieke quiz teruggezet naar de ingebouwde selectie.");
  }

  function downloadPack() {
    if (selectedQuestionIds.length !== QUESTION_TARGET) {
      setNotice(`Kies precies ${QUESTION_TARGET} vragen voordat je downloadt.`);
      return;
    }

    const normalizedSeed = normalizeSeed(currentSeed, selectedQuestionIds);
    const exportPack = {
      dashboardNote: "Bewaar de dashboard-bundle naast dit quiz-pack als je volledige quote-context wilt houden.",
      evidenceContext: currentEvidenceContext,
      seed: normalizedSeed,
      selectedQuestionIds,
    };
    const blob = new Blob([JSON.stringify(exportPack, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.download = `${normalizedSeed.quizTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-quiz-pack.json`;
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="page-shell studio-shell">
      <section className="studio-header">
        <p className="kicker">Achter de schermen</p>
        <h1>Quizstudio</h1>
        <p className="subtitle">
          Selecteer een dump of upload een quiz-pack met bijvoorbeeld 20 kandidaatvragen. Jij kiest minimaal 10 leuke
          vragen, past ze handmatig aan en de publieke quiz gebruikt meteen die selectie.
        </p>
      </section>

      <section className="studio-panel">
        <div className="studio-toolbar">
          <label>
            Dump kiezen
            <select value={currentPackId} onChange={(event) => loadStoredPack(event.target.value)}>
              <option value="builtin">Ingebouwde dump: korte broek op kantoor</option>
              {customPacks.map((pack) => (
                <option key={pack.id} value={pack.id}>
                  {pack.name}
                </option>
              ))}
              {currentPackId !== "builtin" && !customPacks.some((pack) => pack.id === currentPackId) ? (
                <option value={currentPackId}>Actieve studio-keuze</option>
              ) : null}
            </select>
          </label>

          <label className="upload-box">
            Upload quiz-pack of dump
            <input accept="application/json,.json" onChange={handleUpload} type="file" />
          </label>
        </div>

        <div className="studio-summary">
          <div>
            <span>Kandidaten</span>
            <strong>{currentSeed.questions.length}</strong>
          </div>
          <div>
            <span>Gekozen</span>
            <strong>
              {selectedQuestionIds.length}/{QUESTION_TARGET}
            </strong>
          </div>
          <div>
            <span>Winnen</span>
            <strong>
              {WIN_THRESHOLD}/{QUESTION_TARGET}
            </strong>
          </div>
        </div>

        <p className="studio-notice">{notice}</p>

        <div className="studio-actions">
          <button className="primary-button" disabled={selectedQuestionIds.length !== QUESTION_TARGET} onClick={saveSelection}>
            Gebruik deze 10 in de publieke quiz
          </button>
          <button
            className="secondary-button"
            disabled={!selectedQuestionIds[0]}
            onClick={() => selectedQuestionIds[0] && startEditing(selectedQuestionIds[0])}
            type="button"
          >
            Open editor
          </button>
          <a className="secondary-button" href="/">
            Bekijk publieke quiz
          </a>
          <button className="secondary-button" onClick={downloadPack} type="button">
            Download quiz-pack
          </button>
          <button className="secondary-button" onClick={resetPublicQuiz} type="button">
            Reset naar ingebouwd
          </button>
        </div>
      </section>

      {draftQuestion ? (
        <section className="studio-panel studio-editor" id="vraag-editor">
          <div className="studio-section-header">
            <div>
              <p className="kicker">Editor</p>
              <h2>Vraag {draftQuestion.id} aanpassen</h2>
            </div>
            <button className="secondary-button" onClick={() => setDraftQuestion(null)} type="button">
              Sluit editor
            </button>
          </div>

          <div className="editor-form">
            <label>
              Label
              <input
                onChange={(event) => updateDraftField("tone", event.target.value)}
                value={draftQuestion.tone}
              />
            </label>
            <label>
              Context voor de vraag
              <textarea
                onChange={(event) => updateDraftField("context", event.target.value)}
                rows={3}
                value={draftQuestion.context ?? ""}
              />
            </label>
            <label className="editor-wide">
              Vraag
              <textarea
                onChange={(event) => updateDraftField("prompt", event.target.value)}
                rows={2}
                value={draftQuestion.prompt}
              />
            </label>
          </div>

          <div className="editor-options">
            {draftQuestion.options.map((option, index) => (
              <div className={`editor-option ${draftQuestion.correctIndex === index ? "correct" : ""}`} key={`${draftQuestion.id}-${index}`}>
                <label className="editor-radio">
                  <input
                    checked={draftQuestion.correctIndex === index}
                    name="correct-answer"
                    onChange={() => updateDraftField("correctIndex", index)}
                    type="radio"
                  />
                  Goed antwoord
                </label>
                <label>
                  Antwoord {index + 1}
                  <input onChange={(event) => updateDraftOption(index, event.target.value)} value={option} />
                </label>
                <label>
                  Uitleg na keuze
                  <textarea
                    onChange={(event) => updateDraftOptionDetail(index, event.target.value)}
                    rows={2}
                    value={draftQuestion.optionDetails?.[index] ?? ""}
                  />
                </label>
              </div>
            ))}
          </div>

          <div className="editor-form editor-feedback">
            <label>
              Feedback bij goed
              <textarea
                onChange={(event) => updateDraftField("feedbackCorrect", event.target.value)}
                rows={3}
                value={draftQuestion.feedbackCorrect}
              />
            </label>
            <label>
              Feedback bij fout
              <textarea
                onChange={(event) => updateDraftField("feedbackWrong", event.target.value)}
                rows={3}
                value={draftQuestion.feedbackWrong}
              />
            </label>
            <label className="editor-wide">
              Bewijsclaim
              <textarea
                onChange={(event) => updateDraftEvidence("claim", event.target.value)}
                rows={2}
                value={draftQuestion.evidence.claim}
              />
            </label>
            <label>
              Telling
              <input
                min={0}
                onChange={(event) => updateDraftEvidence("n", event.target.value === "" ? undefined : Number(event.target.value))}
                type="number"
                value={draftQuestion.evidence.n ?? ""}
              />
            </label>
            <label>
              Noemer
              <input
                min={0}
                onChange={(event) =>
                  updateDraftEvidence("denominator", event.target.value === "" ? undefined : Number(event.target.value))
                }
                type="number"
                value={draftQuestion.evidence.denominator ?? ""}
              />
            </label>
            <label>
              Percentage
              <input
                min={0}
                onChange={(event) => updateDraftEvidence("pct", event.target.value === "" ? undefined : Number(event.target.value))}
                step="0.1"
                type="number"
                value={draftQuestion.evidence.pct ?? ""}
              />
            </label>
          </div>

          <div className="studio-actions">
            <button className="primary-button" onClick={saveQuestionEdits} type="button">
              Sla vraag op
            </button>
            <button className="secondary-button" onClick={() => startEditing(draftQuestion.id)} type="button">
              Herstel laatste opgeslagen versie
            </button>
          </div>
        </section>
      ) : null}

      <section className="studio-panel">
        <div className="studio-section-header">
          <div>
            <p className="kicker">Kandidaten</p>
            <h2>Kies de 10 leukste vragen</h2>
          </div>
          <p>
            Geselecteerd:{" "}
            {selectedQuestions.length
              ? selectedQuestions.map((question) => question?.id).join(", ")
              : "nog geen vragen"}
          </p>
        </div>

        <div className="studio-grid">
          {currentSeed.questions.map((question) => {
            const selectedOrder = selectedQuestionIds.indexOf(question.id) + 1;
            const isSelected = selectedOrder > 0;

            return (
              <article className={`studio-question ${isSelected ? "selected" : ""}`} key={question.id}>
                <div className="studio-question-top">
                  <span>{question.id}</span>
                  {isSelected ? <strong>{selectedOrder}</strong> : null}
                </div>
                <h3>{question.prompt}</h3>
                {question.context ? <p>{question.context}</p> : null}
                <dl>
                  <div>
                    <dt>Telling</dt>
                    <dd>{questionStat(currentSeed, question.id)}</dd>
                  </div>
                  <div>
                    <dt>Quotes</dt>
                    <dd>{question.evidence.comment_ids?.length ?? 0}</dd>
                  </div>
                </dl>
                <div className="studio-question-actions">
                  <button className={isSelected ? "secondary-button" : "primary-button"} onClick={() => toggleQuestion(question.id)}>
                    {isSelected ? "Haal uit selectie" : "Kies deze vraag"}
                  </button>
                  <button className="secondary-button" onClick={() => startEditing(question.id)} type="button">
                    Bewerk tekst
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}
