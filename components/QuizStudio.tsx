"use client";

import { type ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { buildEvidenceContext, type DashboardBundle } from "@/lib/evidence";
import {
  normalizeQuizPack,
  type EvidenceContext,
  type QuizPackValidation,
  type QuizSeed,
} from "@/lib/quizNormalizer";
import { STUDIO_ACTIVE_PACK_KEY, STUDIO_CUSTOM_PACKS_KEY } from "@/lib/studioStorage";
import {
  DEFAULT_TOPICS,
  PUBLIC_INSIGHTS_TOPICS_KEY,
  TOPIC_ACCENTS,
  TOPIC_ICONS,
  TOPIC_STATUSES,
  mergeStoredTopics,
  normalizeTopic,
  type PublicInsightTopic,
  type TopicAccent,
  type TopicIcon,
  type TopicStatus,
} from "@/lib/topics";

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
  validation?: QuizPackValidation;
};

type UploadShape = {
  dashboard?: DashboardBundle;
  dashboardBundle?: DashboardBundle;
  dump?: DashboardBundle;
  evidenceContext?: EvidenceContext;
  kind?: string;
  questions?: unknown;
  quizSeed?: QuizSeed;
  seed?: QuizSeed;
};

type StudioWindowWithWebAudio = Window &
  typeof globalThis & {
    webkitAudioContext?: typeof AudioContext;
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

function isQuestionEdit(value: unknown) {
  const candidate = value as Partial<QuizQuestion> | undefined;
  return Boolean(
    candidate?.id &&
      candidate?.prompt &&
      Array.isArray(candidate?.options) &&
      candidate.options.length >= 2 &&
      typeof candidate?.correctIndex === "number",
  );
}

function extractQuestionEdits(value: unknown) {
  if (Array.isArray(value) && value.every(isQuestionEdit)) return normalizeQuizPack({ questions: value }).questions;

  const wrapped = value as UploadShape | undefined;
  if (Array.isArray(wrapped?.questions) && wrapped.questions.every(isQuestionEdit)) {
    return normalizeQuizPack({ questions: wrapped.questions }).questions;
  }

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
      codes: [...question.evidence.codes],
      comment_ids: [...question.evidence.comment_ids],
      quotes: [...question.evidence.quotes],
      comparison: question.evidence.comparison ? { ...question.evidence.comparison } : undefined,
    },
    optionDetails: [...question.optionDetails],
    options: [...question.options],
  };
}

function mergeQuestionEdit(existing: QuizQuestion | undefined, edit: QuizQuestion): QuizQuestion {
  const base = existing ?? edit;
  const baseEvidence = base.evidence;
  const editEvidence = edit.evidence;
  const options = edit.options.length ? [...edit.options] : [...base.options];
  const correctIndex = Math.min(Math.max(edit.correctIndex, 0), options.length - 1);

  return {
    ...base,
    ...edit,
    correctIndex,
    evidence: {
      ...baseEvidence,
      ...editEvidence,
      codes: editEvidence.codes.length ? [...editEvidence.codes] : [...baseEvidence.codes],
      comment_ids: editEvidence.comment_ids.length ? [...editEvidence.comment_ids] : [...baseEvidence.comment_ids],
      quotes: editEvidence.quotes.length ? [...editEvidence.quotes] : [...baseEvidence.quotes],
      comparison: editEvidence.comparison ?? baseEvidence.comparison,
    },
    optionDetails: edit.optionDetails.length ? [...edit.optionDetails] : [...base.optionDetails],
    options,
  };
}

function mergeQuestionEdits(seed: QuizSeed, questionEdits: QuizQuestion[]): QuizSeed {
  const editsById = new Map(questionEdits.map((question) => [question.id, question]));
  const existingIds = new Set(seed.questions.map((question) => question.id));
  const updatedQuestions = seed.questions.map((question) => {
    const edit = editsById.get(question.id);
    return edit ? mergeQuestionEdit(question, edit) : question;
  });
  const newQuestions = questionEdits
    .filter((question) => !existingIds.has(question.id))
    .map((question) => mergeQuestionEdit(undefined, question));

  return {
    ...seed,
    questions: [...updatedQuestions, ...newQuestions],
  };
}

function readStoredPacks() {
  try {
    const raw = window.localStorage.getItem(STUDIO_CUSTOM_PACKS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as StudioStoredPack[];
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

function normalizeStoredPack(pack: Partial<StudioStoredPack> | undefined) {
  if (!pack) return undefined;

  const normalized = normalizeQuizPack(pack);
  if (!normalized.seed.questions.length) return undefined;

  return {
    evidenceContext: normalized.evidenceContext,
    id: pack.id || `custom-${Date.now()}`,
    name: pack.name || normalized.quizTitle,
    seed: normalized.seed,
    selectedQuestionIds: normalized.selectedQuestionIds.length
      ? normalized.selectedQuestionIds
      : getInitialSelection(normalized.seed, pack.selectedQuestionIds),
    sourceName: pack.sourceName,
    updatedAt: pack.updatedAt || new Date().toISOString(),
    validation: normalized.validation,
  } satisfies StudioStoredPack;
}

function upsertPack(packs: StudioStoredPack[], nextPack: StudioStoredPack) {
  const others = packs.filter((pack) => pack.id !== nextPack.id);
  return [nextPack, ...others];
}

function questionStat(seed: QuizSeed, questionId: string) {
  const question = seed.questions.find((candidate) => candidate.id === questionId);
  if (!question?.evidence.n || !question.evidence.denominator) return "geen telling";

  const pct = question.evidence.pct !== null ? ` (${String(question.evidence.pct).replace(".", ",")}%)` : "";
  return `${question.evidence.n} van ${question.evidence.denominator}${pct}`;
}

function createTopicId(label: string) {
  const slug = label
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  return slug || `onderwerp-${Date.now()}`;
}

export default function QuizStudio({
  defaultDashboard,
  defaultSeed,
}: {
  defaultDashboard: DashboardBundle;
  defaultSeed: QuizSeed;
}) {
  const builtDefaultEvidenceContext = useMemo(
    () => buildEvidenceContext(defaultSeed, defaultDashboard),
    [defaultDashboard, defaultSeed],
  );
  const defaultPack = useMemo(
    () => normalizeQuizPack({ dashboard: defaultDashboard, evidenceContext: builtDefaultEvidenceContext, seed: defaultSeed }),
    [builtDefaultEvidenceContext, defaultDashboard, defaultSeed],
  );
  const defaultEvidenceContext = defaultPack.evidenceContext;
  const normalizedDefaultSeed = defaultPack.seed;
  const [currentDashboard, setCurrentDashboard] = useState(defaultDashboard);
  const [currentEvidenceContext, setCurrentEvidenceContext] = useState(defaultEvidenceContext);
  const [currentPackId, setCurrentPackId] = useState("builtin");
  const [currentSeed, setCurrentSeed] = useState(normalizedDefaultSeed);
  const [customPacks, setCustomPacks] = useState<StudioStoredPack[]>([]);
  const [currentValidation, setCurrentValidation] = useState(defaultPack.validation);
  const [topics, setTopics] = useState<PublicInsightTopic[]>(DEFAULT_TOPICS);
  const [selectedTopicId, setSelectedTopicId] = useState(DEFAULT_TOPICS[1]?.id ?? DEFAULT_TOPICS[0].id);
  const [topicDraft, setTopicDraft] = useState<PublicInsightTopic>(DEFAULT_TOPICS[1] ?? DEFAULT_TOPICS[0]);
  const [draftQuestion, setDraftQuestion] = useState<QuizQuestion | null>(null);
  const [notice, setNotice] = useState("Kies precies 10 vragen. Daarna gebruikt de publieke quiz precies die selectie.");
  const [savedQuestionId, setSavedQuestionId] = useState<string | null>(null);
  const [saveToast, setSaveToast] = useState("");
  const [selectedQuestionIds, setSelectedQuestionIds] = useState(() => getInitialSelection(normalizedDefaultSeed));
  const saveFeedbackTimeoutRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    try {
      const storedTopics = window.localStorage.getItem(PUBLIC_INSIGHTS_TOPICS_KEY);
      const nextTopics = storedTopics ? mergeStoredTopics(JSON.parse(storedTopics)) : DEFAULT_TOPICS;
      const preferredTopicId = DEFAULT_TOPICS[1]?.id ?? DEFAULT_TOPICS[0].id;
      const nextTopic = nextTopics.find((topic) => topic.id === preferredTopicId) ?? nextTopics[0];

      setTopics(nextTopics);
      setSelectedTopicId(nextTopic.id);
      setTopicDraft(nextTopic);
    } catch {
      setTopics(DEFAULT_TOPICS);
    }

    const storedPacks = readStoredPacks();
    setCustomPacks(storedPacks);

    try {
      const activeRaw = window.localStorage.getItem(STUDIO_ACTIVE_PACK_KEY);
      if (!activeRaw) return;

      const activePack = normalizeStoredPack(JSON.parse(activeRaw) as StudioStoredPack);
      if (!activePack?.seed.questions.length) return;
      if ((activePack.seed.game?.questionCount ?? 0) < QUESTION_TARGET) {
        window.localStorage.removeItem(STUDIO_ACTIVE_PACK_KEY);
        setNotice("Oude 5-vragenselectie genegeerd. De studio werkt nu met minimaal 10 vragen.");
        return;
      }
      if (
        activePack.id === "active-built-in" &&
        activePack.seed.source.dataset === normalizedDefaultSeed.source.dataset &&
        activePack.seed.questions.length < normalizedDefaultSeed.questions.length
      ) {
        window.localStorage.removeItem(STUDIO_ACTIVE_PACK_KEY);
        setNotice("De ingebouwde dump is vernieuwd naar 30 kandidaatvragen. Oude lokale selectie genegeerd.");
        return;
      }

      setCurrentEvidenceContext(activePack.evidenceContext ?? defaultEvidenceContext);
      setCurrentPackId(activePack.id);
      setCurrentSeed(activePack.seed);
      setCurrentValidation(activePack.validation ?? normalizeQuizPack(activePack).validation);
      setSelectedQuestionIds(getInitialSelection(activePack.seed, activePack.selectedQuestionIds));
      setNotice("Actieve quizselectie geladen. Je kunt hem aanpassen en opnieuw opslaan.");
    } catch {
      setNotice("De ingebouwde dump is geladen.");
    }
  }, [defaultEvidenceContext, normalizedDefaultSeed]);

  useEffect(
    () => () => {
      if (saveFeedbackTimeoutRef.current) window.clearTimeout(saveFeedbackTimeoutRef.current);
    },
    [],
  );

  const selectedQuestions = selectedQuestionIds
    .map((id) => currentSeed.questions.find((question) => question.id === id))
    .filter(Boolean);
  const basePackOptions = [
    { id: "builtin", name: "Ingebouwde dump: korte broek op kantoor" },
    ...customPacks.map((pack) => ({ id: pack.id, name: pack.name })),
  ];
  const packOptions = basePackOptions.some((pack) => pack.id === currentPackId)
    ? basePackOptions
    : [...basePackOptions, { id: currentPackId, name: "Actieve studio-keuze" }];
  const linkedPackName =
    packOptions.find((pack) => pack.id === topicDraft.packId)?.name ??
    (topicDraft.packId ? "Actieve studio-keuze" : "Geen dump gekoppeld");

  function playSaveSound() {
    try {
      const audioWindow = window as StudioWindowWithWebAudio;
      const AudioContextCtor = audioWindow.AudioContext ?? audioWindow.webkitAudioContext;
      if (!AudioContextCtor) return;

      const context = new AudioContextCtor();
      const now = context.currentTime;
      const frequencies = [520, 780, 1040];

      frequencies.forEach((frequency, index) => {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        const start = now + index * 0.055;

        oscillator.type = index === 0 ? "triangle" : "sine";
        oscillator.frequency.setValueAtTime(frequency, start);
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(0.045, start + 0.012);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.13);

        oscillator.connect(gain);
        gain.connect(context.destination);
        oscillator.start(start);
        oscillator.stop(start + 0.15);
      });

      window.setTimeout(() => void context.close().catch(() => undefined), 320);
    } catch {
      // Saving should never depend on browser audio support.
    }
  }

  function triggerSavedFeedback(message: string, questionId?: string) {
    if (saveFeedbackTimeoutRef.current) window.clearTimeout(saveFeedbackTimeoutRef.current);

    playSaveSound();
    setSaveToast(message);
    setSavedQuestionId(questionId ?? null);

    saveFeedbackTimeoutRef.current = window.setTimeout(() => {
      setSaveToast("");
      setSavedQuestionId(null);
    }, 1900);
  }

  function loadBuiltInPack() {
    setCurrentDashboard(defaultDashboard);
    setCurrentEvidenceContext(defaultEvidenceContext);
    setCurrentValidation(defaultPack.validation);
    setCurrentPackId("builtin");
    setCurrentSeed(normalizedDefaultSeed);
    setSelectedQuestionIds(getInitialSelection(normalizedDefaultSeed));
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
    setCurrentValidation(pack.validation ?? normalizeQuizPack(pack).validation);
    setCurrentPackId(pack.id);
    setCurrentSeed(pack.seed);
    setSelectedQuestionIds(getInitialSelection(pack.seed, pack.selectedQuestionIds));
    setDraftQuestion(null);
    setNotice(`Dump geladen: ${pack.name}. Kies de 10 vragen die publiek moeten worden.`);
  }

  function selectTopic(topicId: string) {
    const topic = topics.find((candidate) => candidate.id === topicId);
    if (!topic) return;

    setSelectedTopicId(topic.id);
    setTopicDraft(topic);
    if (topic.packId) loadStoredPack(topic.packId);
  }

  function addTopic() {
    const baseLabel = "Nieuw onderwerp";
    let id = createTopicId(baseLabel);
    let suffix = 2;

    while (topics.some((topic) => topic.id === id)) {
      id = `${createTopicId(baseLabel)}-${suffix}`;
      suffix += 1;
    }

    const nextTopic: PublicInsightTopic = {
      accent: "lime",
      description: "Korte uitleg voor bezoekers en de redactie.",
      icon: "phone",
      id,
      label: baseLabel,
      packId: currentPackId,
      prompt: "Waar gaat Nederland op reageren?",
      sourcesVisible: true,
      status: "concept",
    };
    const nextTopics = [...topics, nextTopic];

    setTopics(nextTopics);
    setSelectedTopicId(nextTopic.id);
    setTopicDraft(nextTopic);
    setNotice("Nieuw onderwerp aangemaakt als concept. Vul de tekst aan en sla op.");
  }

  function updateTopicDraft<K extends keyof PublicInsightTopic>(field: K, value: PublicInsightTopic[K]) {
    setTopicDraft((current) => ({ ...current, [field]: value }));
  }

  function saveTopic() {
    const fallback = topics.find((topic) => topic.id === selectedTopicId) ?? DEFAULT_TOPICS[0];
    const cleanTopic = normalizeTopic({ ...topicDraft, packId: topicDraft.packId ?? currentPackId }, fallback);
    const nextTopics = topics.map((topic) => (topic.id === selectedTopicId ? cleanTopic : topic));
    const topicExists = nextTopics.some((topic) => topic.id === cleanTopic.id);
    const topicsToSave = topicExists ? nextTopics : [cleanTopic, ...nextTopics];

    window.localStorage.setItem(PUBLIC_INSIGHTS_TOPICS_KEY, JSON.stringify(topicsToSave));
    setTopics(topicsToSave);
    setSelectedTopicId(cleanTopic.id);
    setTopicDraft(cleanTopic);
    setNotice(
      cleanTopic.status === "actief"
        ? "Onderwerp opgeslagen. Het verschijnt nu op /quiz."
        : "Onderwerp opgeslagen. Het blijft uit /quiz zolang de status niet actief is.",
    );
    triggerSavedFeedback("Onderwerp opgeslagen");
  }

  async function handleUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const parsed = JSON.parse(await file.text()) as UploadShape;
      const uploadedSeed = extractSeed(parsed);
      const uploadedDashboard = extractDashboard(parsed);
      const uploadedQuestionEdits = extractQuestionEdits(parsed);

      if (!uploadedSeed && !uploadedDashboard && !uploadedQuestionEdits) {
        setNotice("Ik herken dit JSON-bestand niet als quiz-pack of dashboard-bundle.");
        return;
      }

      if (uploadedQuestionEdits && !uploadedSeed) {
        const mergedSeed = mergeQuestionEdits(currentSeed, uploadedQuestionEdits);
        const normalizedPack = normalizeQuizPack({
          evidenceContext: parsed.evidenceContext ?? currentEvidenceContext,
          seed: mergedSeed,
          selectedQuestionIds,
        });
        const nextSeed = normalizedPack.seed;
        const nextEvidenceContext = normalizedPack.evidenceContext;
        const nextSelection = getInitialSelection(nextSeed, selectedQuestionIds);

        setCurrentEvidenceContext(nextEvidenceContext);
        setCurrentValidation(normalizedPack.validation);
        setDraftQuestion(null);

        persistActivePack(
          nextSeed,
          nextSelection,
          `${uploadedQuestionEdits.length} vragen geüpload en opgeslagen. Controleer nog even de quiz voordat je live laat spelen.`,
          undefined,
          nextEvidenceContext,
          "Vragen geüpload",
        );
        return;
      }

      const rawNextSeed = uploadedSeed ?? currentSeed;
      const nextDashboard = uploadedDashboard ?? currentDashboard;
      const rawEvidenceContext = parsed.evidenceContext ?? buildEvidenceContext(rawNextSeed, nextDashboard);
      const normalizedPack = normalizeQuizPack({
        ...parsed,
        dashboard: nextDashboard,
        evidenceContext: rawEvidenceContext,
        seed: rawNextSeed,
      });
      const nextSeed = normalizedPack.seed;
      const nextEvidenceContext = normalizedPack.evidenceContext;
      const nextSelection = getInitialSelection(
        nextSeed,
        normalizedPack.selectedQuestionIds.length ? normalizedPack.selectedQuestionIds : undefined,
      );

      setCurrentDashboard(nextDashboard);
      setCurrentEvidenceContext(nextEvidenceContext);
      setCurrentValidation(normalizedPack.validation);
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
          validation: normalizedPack.validation,
        };
        const nextPacks = upsertPack(customPacks, nextPack);

        window.localStorage.setItem(STUDIO_CUSTOM_PACKS_KEY, JSON.stringify(nextPacks));
        setCustomPacks(nextPacks);
        setCurrentPackId(nextPack.id);
        setTopicDraft((current) => ({ ...current, packId: nextPack.id }));
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

  function persistActivePack(
    seedToSave: QuizSeed,
    selectionToSave: string[],
    successNotice: string,
    savedQuestion?: QuizQuestion,
    evidenceContextToSave = currentEvidenceContext,
    feedbackMessage = "Opgeslagen",
  ) {
    if (seedToSave.questions.length < QUESTION_TARGET) {
      setNotice(`Deze quiz heeft maar ${seedToSave.questions.length} vragen. Maak of upload minimaal 10 vragen.`);
      return false;
    }

    if (selectionToSave.length !== QUESTION_TARGET) {
      setNotice(`Kies precies ${QUESTION_TARGET} vragen voordat je opslaat.`);
      return false;
    }

    const normalizedPack = normalizeQuizPack({
      evidenceContext: evidenceContextToSave,
      seed: normalizeSeed(seedToSave, selectionToSave),
      selectedQuestionIds: selectionToSave,
    });
    const normalizedSeed = normalizedPack.seed;
    const normalizedEvidenceContext = normalizedPack.evidenceContext;
    const nextPack: StudioStoredPack = {
      evidenceContext: normalizedEvidenceContext,
      id: currentPackId === "builtin" ? "active-built-in" : currentPackId,
      name: normalizedSeed.quizTitle,
      seed: normalizedSeed,
      selectedQuestionIds: selectionToSave,
      sourceName: currentPackId === "builtin" ? "ingebouwde dump" : undefined,
      updatedAt: new Date().toISOString(),
      validation: normalizedPack.validation,
    };

    window.localStorage.setItem(STUDIO_ACTIVE_PACK_KEY, JSON.stringify(nextPack));

    if (currentPackId !== "builtin" && customPacks.some((pack) => pack.id === currentPackId)) {
      const nextPacks = upsertPack(customPacks, nextPack);
      window.localStorage.setItem(STUDIO_CUSTOM_PACKS_KEY, JSON.stringify(nextPacks));
      setCustomPacks(nextPacks);
    }

    setCurrentSeed(normalizedSeed);
    setCurrentEvidenceContext(normalizedEvidenceContext);
    setCurrentValidation(normalizedPack.validation);
    setCurrentPackId(nextPack.id);
    setSelectedQuestionIds(selectionToSave);
    setNotice(successNotice);
    triggerSavedFeedback(feedbackMessage, savedQuestion?.id);
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

    if (
      persistActivePack(
        nextSeed,
        nextSelection,
        `Vraag ${cleanQuestion.id} opgeslagen. De publieke quiz gebruikt je aangepaste tekst.`,
        cleanQuestion,
      )
    ) {
      setDraftQuestion(cloneQuestion(cleanQuestion));
    }
  }

  function resetPublicQuiz() {
    window.localStorage.removeItem(STUDIO_ACTIVE_PACK_KEY);
    loadBuiltInPack();
    setNotice("Publieke quiz teruggezet naar de ingebouwde selectie.");
  }

  function downloadJson(data: unknown, filename: string) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.download = filename;
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
  }

  function downloadEditableQuestions() {
    const exportQuestions = {
      kind: "public-insights-question-edits-v1",
      instructions: [
        "Bewerk vooral context, prompt, options, optionDetails, feedbackCorrect en feedbackWrong.",
        "Laat id staan; daarmee zet de studio de vraag later terug op de juiste plek.",
        "correctIndex is nul-gebaseerd: 0 is antwoord 1, 1 is antwoord 2, enzovoort.",
        "Laat evidence, codes en comment_ids bij voorkeur staan, tenzij je precies weet wat je aanpast.",
        "Upload dit bestand terug in de Quizstudio via 'Upload quiz-pack, dump of vragen-JSON'.",
      ],
      quizTitle: currentSeed.quizTitle,
      selectedQuestionIds,
      source: currentSeed.source,
      exportedAt: new Date().toISOString(),
      questions: currentSeed.questions.map(cloneQuestion),
    };
    const filename = `${currentSeed.quizTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-alle-vragen-chatgpt.json`;

    downloadJson(exportQuestions, filename);
    setNotice("Alle vragen gedownload als ChatGPT-vriendelijke JSON. Bewerk de JSON en upload hem straks hier terug.");
    triggerSavedFeedback("Vragen gedownload");
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
    const filename = `${normalizedSeed.quizTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-quiz-pack.json`;

    downloadJson(exportPack, filename);
  }

  return (
    <main className="page-shell studio-shell">
      <section className="studio-header">
        <p className="kicker">Achter de schermen</p>
        <h1>Editor</h1>
        <p className="subtitle">
          Beheer hier onderwerpen, dumps en vragen. Alleen onderwerpen met status actief verschijnen op het publieke
          kwisscherm.
        </p>
      </section>

      <section className="studio-panel topic-manager-panel">
        <div className="studio-section-header">
          <div>
            <p className="kicker">Onderwerpen</p>
            <h2>Wat mag publiek zichtbaar zijn?</h2>
          </div>
          <button className="secondary-button" onClick={addTopic} type="button">
            Nieuw onderwerp
          </button>
        </div>

        <div className="topic-manager-grid">
          <div className="topic-list" aria-label="Bestaande onderwerpen">
            {topics.map((topic) => (
              <button
                className={topic.id === selectedTopicId ? "active" : ""}
                key={topic.id}
                onClick={() => selectTopic(topic.id)}
                type="button"
              >
                <strong>{topic.label}</strong>
                <span>{topic.status}</span>
              </button>
            ))}
          </div>

          <div className="topic-edit-form">
            <label>
              Onderwerpnaam
              <input
                onChange={(event) => updateTopicDraft("label", event.target.value)}
                value={topicDraft.label}
              />
            </label>
            <label>
              Korte omschrijving
              <textarea
                onChange={(event) => updateTopicDraft("description", event.target.value)}
                rows={3}
                value={topicDraft.description}
              />
            </label>
            <label>
              Tekst op onderwerpkaart
              <input
                onChange={(event) => updateTopicDraft("prompt", event.target.value)}
                value={topicDraft.prompt}
              />
            </label>
            <div className="topic-inline-fields">
              <label>
                Status
                <select
                  onChange={(event) => updateTopicDraft("status", event.target.value as TopicStatus)}
                  value={topicDraft.status}
                >
                  {TOPIC_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Kleurthema
                <select
                  onChange={(event) => updateTopicDraft("accent", event.target.value as TopicAccent)}
                  value={topicDraft.accent}
                >
                  {TOPIC_ACCENTS.map((accent) => (
                    <option key={accent} value={accent}>
                      {accent}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Icoon
                <select
                  onChange={(event) => updateTopicDraft("icon", event.target.value as TopicIcon)}
                  value={topicDraft.icon}
                >
                  {TOPIC_ICONS.map((icon) => (
                    <option key={icon} value={icon}>
                      {icon}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label>
              Gekoppelde dump
              <select
                onChange={(event) => updateTopicDraft("packId", event.target.value)}
                value={topicDraft.packId ?? currentPackId}
              >
                {packOptions.map((pack) => (
                  <option key={pack.id} value={pack.id}>
                    {pack.name}
                  </option>
                ))}
                {topicDraft.packId && !packOptions.some((pack) => pack.id === topicDraft.packId) ? (
                  <option value={topicDraft.packId}>Actieve studio-keuze</option>
                ) : null}
              </select>
            </label>
            <label className="topic-checkbox">
              <input
                checked={topicDraft.sourcesVisible ?? true}
                onChange={(event) => updateTopicDraft("sourcesVisible", event.target.checked)}
                type="checkbox"
              />
              Bronnen en quotes mogen in de reveal zichtbaar zijn
            </label>
          </div>

          <aside className="topic-preview-panel">
            <p className="kicker">Preview op /quiz</p>
            <button className={`topic-card public-topic-card ${topicDraft.accent} spotlight`} type="button">
              <span className="topic-status">{topicDraft.status}</span>
              <strong>{topicDraft.label}</strong>
              <span>{topicDraft.prompt}</span>
              <span className={`topic-visual ${topicDraft.icon}`} aria-hidden="true" />
            </button>
            <p>
              Dump: <strong>{linkedPackName}</strong>
            </p>
            <button className="primary-button" onClick={saveTopic} type="button">
              Opslaan onderwerp
            </button>
          </aside>
        </div>
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
            Upload quiz-pack, dump of vragen-JSON
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
        {currentValidation.warnings.length ? (
          <div className="studio-admin-warnings" role="status" aria-live="polite">
            <strong>Dump-check</strong>
            {currentValidation.warnings.map((warning) => (
              <span key={warning}>{warning}</span>
            ))}
          </div>
        ) : null}
        {saveToast ? (
          <p className="studio-save-toast" role="status" aria-live="polite">
            {saveToast}
          </p>
        ) : null}

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
          <a className="secondary-button" href="/quiz">
            Bekijk publieke quiz
          </a>
          <button className="secondary-button" onClick={downloadPack} type="button">
            Download quiz-pack
          </button>
          <button className="secondary-button" onClick={downloadEditableQuestions} type="button">
            Download alle vragen voor ChatGPT
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
            <button
              className={`primary-button save-question-button ${savedQuestionId === draftQuestion.id ? "saved" : ""}`}
              onClick={saveQuestionEdits}
              type="button"
            >
              {savedQuestionId === draftQuestion.id ? "Opgeslagen" : "Sla vraag op"}
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
                    <dd>{question.evidence.quote_count}</dd>
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
