"use client";

import { type ChangeEvent, useEffect, useMemo, useState } from "react";
import type { EvidenceContext, QuizSeed } from "@/components/QuizApp";
import { buildEvidenceContext, type DashboardBundle } from "@/lib/evidence";
import { STUDIO_ACTIVE_PACK_KEY, STUDIO_CUSTOM_PACKS_KEY } from "@/lib/studioStorage";

const QUESTION_TARGET = 5;
const WIN_THRESHOLD = 3;

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
    max: 2,
    title: "Nog niet gewonnen",
    description: "Je zat in de buurt, maar 3 van de 5 is de winstgrens.",
  },
  {
    min: 3,
    max: 4,
    title: "Gewonnen: Publieke Peiler",
    description: "Je had genoeg verrassingen te pakken. Je leest de onderstroom van de reacties scherp.",
  },
  {
    min: 5,
    max: 5,
    title: "Perfecte Peiler",
    description: "Vijf uit vijf. Jij voelde precies aan waar de reacties anders waren dan je misschien verwacht.",
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

function getInitialSelection(seed: QuizSeed) {
  const validIds = new Set(seed.questions.map((question) => question.id));
  const configuredIds =
    seed.game?.featuredQuestionIds?.filter((id) => validIds.has(id)).slice(0, QUESTION_TARGET) ?? [];

  if (configuredIds.length === QUESTION_TARGET) return configuredIds;

  const fallbackIds = seed.questions
    .map((question) => question.id)
    .filter((id) => !configuredIds.includes(id))
    .slice(0, QUESTION_TARGET - configuredIds.length);

  return [...configuredIds, ...fallbackIds];
}

function normalizeSeed(seed: QuizSeed, selectedQuestionIds: string[]): QuizSeed {
  const hasFivePointBands = seed.resultBands.some((band) => band.max >= QUESTION_TARGET);

  return {
    ...seed,
    game: {
      ...seed.game,
      featuredQuestionIds: selectedQuestionIds,
      questionCount: QUESTION_TARGET,
      winThreshold: WIN_THRESHOLD,
    },
    resultBands: hasFivePointBands ? seed.resultBands : DEFAULT_RESULT_BANDS,
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
  const [notice, setNotice] = useState("Kies 5 vragen. Daarna gebruikt de publieke quiz precies die selectie.");
  const [selectedQuestionIds, setSelectedQuestionIds] = useState(() => getInitialSelection(defaultSeed));

  useEffect(() => {
    const storedPacks = readStoredPacks();
    setCustomPacks(storedPacks);

    try {
      const activeRaw = window.localStorage.getItem(STUDIO_ACTIVE_PACK_KEY);
      if (!activeRaw) return;

      const activePack = JSON.parse(activeRaw) as StudioStoredPack;
      if (!activePack.seed?.questions?.length) return;

      setCurrentEvidenceContext(activePack.evidenceContext ?? defaultEvidenceContext);
      setCurrentPackId(activePack.id);
      setCurrentSeed(activePack.seed);
      setSelectedQuestionIds(activePack.selectedQuestionIds ?? getInitialSelection(activePack.seed));
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
    setNotice("Ingebouwde dump geladen. Selecteer je favoriete 5 vragen.");
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
    setSelectedQuestionIds(pack.selectedQuestionIds ?? getInitialSelection(pack.seed));
    setNotice(`Dump geladen: ${pack.name}. Kies de 5 vragen die publiek moeten worden.`);
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
        setNotice(`Quiz-pack geladen uit ${file.name}. Kies nu je favoriete 5 vragen.`);
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
        setNotice("Je hebt al 5 vragen gekozen. Haal er eerst eentje uit.");
        return current;
      }

      setNotice("Selectie bijgewerkt. Sla op zodra je 5 vragen hebt.");
      return [...current, questionId];
    });
  }

  function saveSelection() {
    if (selectedQuestionIds.length !== QUESTION_TARGET) {
      setNotice(`Kies precies ${QUESTION_TARGET} vragen voordat je opslaat.`);
      return;
    }

    const normalizedSeed = normalizeSeed(currentSeed, selectedQuestionIds);
    const nextPack: StudioStoredPack = {
      evidenceContext: currentEvidenceContext,
      id: currentPackId === "builtin" ? "active-built-in" : currentPackId,
      name: normalizedSeed.quizTitle,
      seed: normalizedSeed,
      selectedQuestionIds,
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
    setNotice("Opgeslagen. De publieke quiz gebruikt nu deze 5 vragen.");
  }

  function resetPublicQuiz() {
    window.localStorage.removeItem(STUDIO_ACTIVE_PACK_KEY);
    loadBuiltInPack();
    setNotice("Publieke quiz teruggezet naar de ingebouwde selectie.");
  }

  function downloadPack() {
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
          Selecteer een dump of upload een quiz-pack met bijvoorbeeld 20 kandidaatvragen. Jij kiest de 5 leukste; de
          publieke quiz gebruikt meteen die selectie.
        </p>
      </section>

      <section className="studio-panel">
        <div className="studio-toolbar">
          <label>
            Dump kiezen
            <select value={currentPackId} onChange={(event) => loadStoredPack(event.target.value)}>
              <option value="builtin">Ingebouwde dump: social media verbod</option>
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
            Gebruik deze 5 in de publieke quiz
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

      <section className="studio-panel">
        <div className="studio-section-header">
          <div>
            <p className="kicker">Kandidaten</p>
            <h2>Kies de 5 leukste vragen</h2>
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
                <button className={isSelected ? "secondary-button" : "primary-button"} onClick={() => toggleQuestion(question.id)}>
                  {isSelected ? "Haal uit selectie" : "Kies deze vraag"}
                </button>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}
