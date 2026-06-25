export type NormalizedQuote = {
  id: string;
  text: string;
  likes: number | null;
  source: string;
};

export type NormalizedComment = {
  emotion?: string;
  id: string;
  likes: number | null;
  slideUse?: string;
  source: string;
  stanceLabel?: string;
  text: string;
  themeLabels: string[];
};

export type NormalizedEvidence = {
  claim: string;
  n: number | null;
  denominator: number | null;
  pct: number | null;
  codes: string[];
  comment_ids: string[];
  quotes: NormalizedQuote[];
  quote_count: number;
  note: string;
  comparison?: Record<string, { n: number; pct?: number }>;
};

export type NormalizedQuestion = {
  id: string;
  type: string;
  tone: string;
  context: string;
  prompt: string;
  options: string[];
  optionDetails: string[];
  correctIndex: number;
  feedbackCorrect: string;
  feedbackWrong: string;
  evidence: NormalizedEvidence;
};

export type NormalizedEvidenceContext = {
  codeLabels: Record<string, string>;
  comments: Record<string, NormalizedComment>;
};

export type NormalizedResultBand = {
  min: number;
  max: number;
  title: string;
  description: string;
};

export type NormalizedPostQuizSlideItem = {
  rank: number | null;
  title: string;
  summary: string;
  n: number | null;
  denominator: number | null;
  pct: number | null;
  codes: string[];
  comment_ids: string[];
  quote: NormalizedQuote | null;
};

export type NormalizedPostQuizSlide = {
  id: string;
  type: string;
  title: string;
  subtitle: string;
  visual_type: string;
  items: NormalizedPostQuizSlideItem[];
  note: string;
};

export type NormalizedQuizSource = {
  dataset?: string;
  mode?: string;
  analyzed_comments: number;
  article_title: string;
  publication_date: string;
  rules: string[];
};

export type NormalizedQuizSeed = {
  game?: {
    featuredQuestionIds?: string[];
    questionCount?: number;
    winThreshold?: number;
  };
  quizTitle: string;
  subtitle: string;
  source: NormalizedQuizSource;
  questions: NormalizedQuestion[];
  postQuizSlides: NormalizedPostQuizSlide[];
  resultBands: NormalizedResultBand[];
};

export type QuizPackValidation = {
  missingCodeLabels: boolean;
  missingQuoteTextQuestionCount: number;
  warnings: string[];
};

export type NormalizedQuizPack = {
  quizTitle: string;
  subtitle: string;
  evidenceContext: NormalizedEvidenceContext;
  questions: NormalizedQuestion[];
  selectedQuestionIds: string[];
  seed: NormalizedQuizSeed;
  postQuizSlides: NormalizedPostQuizSlide[];
  validation: QuizPackValidation;
};

export type EvidenceContext = NormalizedEvidenceContext;
export type QuizSeed = NormalizedQuizSeed;

type RawRecord = Record<string, unknown>;

const DEFAULT_RESULT_BANDS: NormalizedResultBand[] = [
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

function isRecord(value: unknown): value is RawRecord {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function asRecord(value: unknown): RawRecord {
  return isRecord(value) ? value : {};
}

function asString(value: unknown, fallback = "") {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return fallback;
}

function asNullableNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value.replace(",", "."));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function asStringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => asString(item)).filter(Boolean);
}

function firstString(...values: unknown[]) {
  for (const value of values) {
    const text = asString(value);
    if (text) return text;
  }

  return "";
}

function cleanFallbackLabel(code: string) {
  return code
    .replace(/^theme:/, "")
    .replace(/^source:/, "")
    .replace(/^stance:/, "")
    .replace(/^emotion:/, "Gevoel: ")
    .replace(/^theme_/, "Thema ")
    .replace(/^stance_/, "Stance ")
    .replace(/^emotion_/, "Emotie ")
    .replace(/^source_/, "Bron ")
    .replace(/_/g, " ");
}

function normalizeQuote(rawQuote: unknown, fallbackId: string, fallbackSource = "bron"): NormalizedQuote | null {
  if (typeof rawQuote === "string") {
    const text = rawQuote.trim();
    return text ? { id: fallbackId, text, likes: null, source: fallbackSource } : null;
  }

  const quote = asRecord(rawQuote);
  const text = firstString(
    quote.text,
    quote.text_raw,
    quote.text_clean,
    quote.quote,
    quote.comment_text,
    quote.full_quote,
    quote.full_text,
    quote.body,
  );

  if (!text) return null;

  return {
    id: firstString(quote.id, quote.comment_id, quote.commentId, fallbackId),
    text,
    likes: asNullableNumber(quote.likes),
    source: firstString(quote.source, quote.platform, fallbackSource),
  };
}

function normalizeComments(rawComments: unknown, rawQuoteBank: unknown) {
  const comments: Record<string, NormalizedComment> = {};

  function addComment(rawComment: unknown, fallbackSource: string) {
    const comment = asRecord(rawComment);
    const id = firstString(comment.id, comment.comment_id, comment.commentId);
    const text = firstString(
      comment.text,
      comment.text_raw,
      comment.text_clean,
      comment.quote,
      comment.comment_text,
      comment.full_quote,
      comment.full_text,
      comment.body,
    );

    if (!id || !text) return;

    comments[id] = {
      id,
      text,
      likes: asNullableNumber(comment.likes),
      source: firstString(comment.source, comment.platform, fallbackSource),
      themeLabels: Array.isArray(comment.themeLabels)
        ? asStringArray(comment.themeLabels)
        : asStringArray(comment.theme_label_list),
      stanceLabel: firstString(comment.stanceLabel, comment.stance_label) || undefined,
      emotion: firstString(comment.emotion) || undefined,
      slideUse: firstString(comment.slideUse, comment.recommended_slide_use) || undefined,
    };
  }

  if (Array.isArray(rawComments)) {
    rawComments.forEach((comment) => addComment(comment, "comments"));
  } else if (isRecord(rawComments)) {
    Object.entries(rawComments).forEach(([id, value]) => {
      addComment({ id, ...asRecord(value) }, "evidenceContext");
    });
  }

  if (Array.isArray(rawQuoteBank)) {
    rawQuoteBank.forEach((quote) => addComment(quote, "quote_bank"));
  }

  return comments;
}

function normalizeCodeLabels(rawPack: RawRecord, rawSeed: RawRecord, evidenceContext: RawRecord, dashboard: RawRecord) {
  const directLabels = asRecord(
    evidenceContext.codeLabels ?? evidenceContext.code_labels ?? rawPack.codeLabels ?? rawPack.code_labels ?? rawSeed.codeLabels,
  );
  const labels: Record<string, string> = {};

  Object.entries(directLabels).forEach(([key, value]) => {
    const label = asString(value);
    if (key && label) labels[key] = label;
  });

  const counts = asRecord(dashboard.counts);
  const themeCounts = counts.theme_counts;
  if (Array.isArray(themeCounts)) {
    themeCounts.forEach((item) => {
      const theme = asRecord(item);
      const id = firstString(theme.theme_id, theme.id, theme.code);
      const label = firstString(theme.label, theme.name);
      if (id && label) labels[id] = label;
    });
  }

  return labels;
}

function getRawSeed(rawPack: RawRecord) {
  return asRecord(rawPack.seed ?? rawPack.quizSeed ?? rawPack.quiz_seed ?? rawPack);
}

function getRawDashboard(rawPack: RawRecord) {
  return asRecord(rawPack.dashboardBundle ?? rawPack.dashboard ?? rawPack.dump);
}

function normalizeSource(rawSeed: RawRecord, dashboard: RawRecord): NormalizedQuizSource {
  const source = asRecord(rawSeed.source);
  return {
    dataset: firstString(source.dataset, dashboard.dataset) || undefined,
    mode: firstString(source.mode) || undefined,
    analyzed_comments: asNullableNumber(source.analyzed_comments ?? source.analyzedComments ?? dashboard.analyzed_comments) ?? 0,
    article_title: firstString(source.article_title, source.articleTitle, dashboard.article_title, rawSeed.quizTitle) || "Public Insights dump",
    publication_date: firstString(source.publication_date, source.publicationDate, dashboard.publication_date) || "",
    rules: asStringArray(source.rules),
  };
}

function normalizeResultBands(rawSeed: RawRecord) {
  const bands = rawSeed.resultBands;
  if (!Array.isArray(bands)) return DEFAULT_RESULT_BANDS;

  const normalized = bands
    .map((band) => {
      const rawBand = asRecord(band);
      return {
        min: asNullableNumber(rawBand.min) ?? 0,
        max: asNullableNumber(rawBand.max) ?? 10,
        title: firstString(rawBand.title) || "Uitslag",
        description: firstString(rawBand.description) || "",
      };
    })
    .filter((band) => band.title);

  return normalized.length ? normalized : DEFAULT_RESULT_BANDS;
}

function quoteFromComment(commentId: string, comments: Record<string, NormalizedComment>) {
  const comment = comments[commentId];
  if (!comment) return null;

  return {
    id: comment.id,
    text: comment.text,
    likes: comment.likes,
    source: comment.source,
  } satisfies NormalizedQuote;
}

function normalizePostQuizSlideItem(
  rawItem: unknown,
  index: number,
  comments: Record<string, NormalizedComment>,
): NormalizedPostQuizSlideItem {
  const item = asRecord(rawItem);
  const rawEvidence = asRecord(item.evidence);
  const commentIds = [
    ...asStringArray(item.comment_ids),
    ...asStringArray(item.commentIds),
    ...asStringArray(rawEvidence.comment_ids),
    ...asStringArray(rawEvidence.sample_comment_ids),
  ].filter((id, idIndex, all) => id && all.indexOf(id) === idIndex);
  const rawQuotes = Array.isArray(item.quotes)
    ? item.quotes
    : Array.isArray(rawEvidence.quotes)
      ? rawEvidence.quotes
      : [];
  const directQuote =
    normalizeQuote(item.quote ?? rawEvidence.quote, `end-item-${index + 1}`, "eindslide") ??
    rawQuotes.flatMap((quote, quoteIndex) => {
      const normalized = normalizeQuote(quote, `end-item-${index + 1}-quote-${quoteIndex + 1}`, "eindslide");
      return normalized ? [normalized] : [];
    })[0] ??
    commentIds.flatMap((commentId) => {
      const quote = quoteFromComment(commentId, comments);
      return quote ? [quote] : [];
    })[0] ??
    null;

  return {
    rank: asNullableNumber(item.rank) ?? index + 1,
    title: firstString(item.title, item.label, item.name) || `Inzicht ${index + 1}`,
    summary: firstString(item.summary, item.description, item.claim, rawEvidence.claim) || "Publiek signaal uit de reacties.",
    n: asNullableNumber(item.n ?? item.count ?? rawEvidence.n ?? rawEvidence.count),
    denominator: asNullableNumber(item.denominator ?? item.total ?? rawEvidence.denominator ?? rawEvidence.total),
    pct: asNullableNumber(item.pct ?? item.percentage ?? rawEvidence.pct ?? rawEvidence.percentage),
    codes: [
      ...asStringArray(item.codes),
      ...asStringArray(rawEvidence.codes),
    ].filter((code, codeIndex, all) => code && all.indexOf(code) === codeIndex),
    comment_ids: commentIds,
    quote: directQuote,
  };
}

function normalizePostQuizSlide(
  rawSlide: unknown,
  index: number,
  comments: Record<string, NormalizedComment>,
): NormalizedPostQuizSlide {
  const slide = asRecord(rawSlide);
  const rawItems = Array.isArray(slide.items) ? slide.items : [];
  const type = firstString(slide.type) || ["top_insights", "sentiment_summary", "takeaways"][index] || "summary";

  return {
    id: firstString(slide.id) || `end0${index + 1}`,
    type,
    title: firstString(slide.title) || ["Wat viel het meest op?", "Hoe voelde het debat?", "Wat betekent dit?"][index] || "Inzichten",
    subtitle:
      firstString(slide.subtitle) ||
      [
        "De grootste publieksinzichten uit deze discussie.",
        "De dominante toon in de reacties.",
        "Praktische takeaways uit de publieke reacties.",
      ][index] ||
      "",
    visual_type:
      firstString(slide.visual_type, slide.visualType) ||
      ["top5_bar_cards", "sentiment_cards", "takeaway_cards"][index] ||
      "top5_bar_cards",
    items: rawItems.slice(0, 5).map((item, itemIndex) => normalizePostQuizSlideItem(item, itemIndex, comments)),
    note: firstString(slide.note),
  };
}

function questionToPostQuizItem(question: NormalizedQuestion, index: number): NormalizedPostQuizSlideItem {
  const firstCode = question.evidence.codes[0] ?? "";
  const label = firstCode ? cleanFallbackLabel(firstCode) : question.prompt;

  return {
    rank: index + 1,
    title: label || `Inzicht ${index + 1}`,
    summary: question.evidence.claim || question.prompt,
    n: question.evidence.n,
    denominator: question.evidence.denominator,
    pct: question.evidence.pct,
    codes: question.evidence.codes,
    comment_ids: question.evidence.comment_ids,
    quote: question.evidence.quotes[0] ?? null,
  };
}

function buildFallbackPostQuizSlides(questions: NormalizedQuestion[]): NormalizedPostQuizSlide[] {
  const rankedQuestions = [...questions]
    .sort((a, b) => (b.evidence.n ?? 0) - (a.evidence.n ?? 0))
    .slice(0, 5);
  const emotionQuestions = questions
    .filter((question) => question.evidence.codes.some((code) => code.startsWith("emotion:") || code.startsWith("stance:")))
    .slice(0, 5);
  const takeawayQuestions = rankedQuestions.slice(0, 4);

  return [
    {
      id: "end01",
      type: "top_insights",
      title: "Wat viel het meest op?",
      subtitle: "De grootste signalen uit deze quizdump.",
      visual_type: "top5_bar_cards",
      items: rankedQuestions.map(questionToPostQuizItem),
      note: "Automatisch gemaakt uit de quizvragen. Voeg postQuizSlides toe voor scherpere eindslides.",
    },
    {
      id: "end02",
      type: "sentiment_summary",
      title: "Hoe voelde het debat?",
      subtitle: "De toon achter de reacties, voor zover die in de dump zit.",
      visual_type: "sentiment_cards",
      items: (emotionQuestions.length ? emotionQuestions : rankedQuestions).map(questionToPostQuizItem),
      note: "Gebruik gecodeerde emoties of sentimenten voor een rijkere slide.",
    },
    {
      id: "end03",
      type: "takeaways",
      title: "Wat betekent dit?",
      subtitle: "Een paar praktische haakjes voor het gesprek.",
      visual_type: "takeaway_cards",
      items: takeawayQuestions.map(questionToPostQuizItem),
      note: "Automatisch afgeleid. Redactioneel aanscherpen kan in de dump.",
    },
  ];
}

function normalizePostQuizSlides(
  rawPack: RawRecord,
  rawSeed: RawRecord,
  questions: NormalizedQuestion[],
  comments: Record<string, NormalizedComment>,
) {
  const rawSlides = Array.isArray(rawSeed.postQuizSlides)
    ? rawSeed.postQuizSlides
    : Array.isArray(rawSeed.post_quiz_slides)
      ? rawSeed.post_quiz_slides
      : Array.isArray(rawPack.postQuizSlides)
        ? rawPack.postQuizSlides
        : Array.isArray(rawPack.post_quiz_slides)
          ? rawPack.post_quiz_slides
          : Array.isArray(rawPack.summarySlides)
            ? rawPack.summarySlides
            : Array.isArray(rawSeed.endSlides)
              ? rawSeed.endSlides
              : [];

  const normalized = rawSlides
    .slice(0, 3)
    .map((slide, index) => normalizePostQuizSlide(slide, index, comments))
    .filter((slide) => slide.items.length);

  if (normalized.length) return normalized;

  return buildFallbackPostQuizSlides(questions).filter((slide) => slide.items.length);
}

function normalizeOptions(rawQuestion: RawRecord) {
  const rawOptions = Array.isArray(rawQuestion.options)
    ? rawQuestion.options
    : Array.isArray(rawQuestion.answers)
      ? rawQuestion.answers
      : [];

  const options = rawOptions
    .map((option) => firstString(option, asRecord(option).label, asRecord(option).text, asRecord(option).answer))
    .filter(Boolean);

  if (options.length >= 2) return options;

  return ["Ja", "Nee"];
}

function normalizeOptionDetails(rawQuestion: RawRecord, options: string[]) {
  const rawDetails = Array.isArray(rawQuestion.optionDetails)
    ? rawQuestion.optionDetails
    : Array.isArray(rawQuestion.option_details)
      ? rawQuestion.option_details
      : [];
  const details = rawDetails.map((detail) => asString(detail));

  const rawOptions = Array.isArray(rawQuestion.options) ? rawQuestion.options : [];
  const objectDetails = rawOptions.map((option) =>
    firstString(asRecord(option).detail, asRecord(option).explanation, asRecord(option).description),
  );

  return options.map((_, index) => details[index] ?? objectDetails[index] ?? "");
}

function normalizeCorrectIndex(rawQuestion: RawRecord, options: string[]) {
  const numeric = asNullableNumber(rawQuestion.correctIndex ?? rawQuestion.correct_index ?? rawQuestion.answerIndex);
  if (numeric !== null) return Math.min(Math.max(Math.round(numeric), 0), options.length - 1);

  const correctText = firstString(rawQuestion.correctAnswer, rawQuestion.correct_answer, rawQuestion.answer);
  if (correctText) {
    const index = options.findIndex((option) => option.toLowerCase() === correctText.toLowerCase());
    if (index >= 0) return index;
  }

  return 0;
}

function normalizeEvidence(rawQuestion: RawRecord, comments: Record<string, NormalizedComment>, questionId: string) {
  const rawEvidence = asRecord(rawQuestion.evidence);
  const codes = asStringArray(rawEvidence.codes ?? rawEvidence.code_ids ?? rawQuestion.codes);
  const commentIds = [
    ...asStringArray(rawEvidence.comment_ids),
    ...asStringArray(rawEvidence.commentIds),
    ...asStringArray(rawEvidence.sample_comment_ids),
    ...asStringArray(rawQuestion.comment_ids),
    ...asStringArray(rawQuestion.commentIds),
    ...asStringArray(rawQuestion.sample_comment_ids),
  ].filter((id, index, all) => id && all.indexOf(id) === index);
  const rawQuotes = Array.isArray(rawEvidence.quotes)
    ? rawEvidence.quotes
    : Array.isArray(rawQuestion.quotes)
      ? rawQuestion.quotes
      : [];
  const quotesFromEvidence = rawQuotes.flatMap((quote, index) => {
    const normalized = normalizeQuote(quote, `${questionId}-quote-${index + 1}`, "evidence");
    return normalized ? [normalized] : [];
  });
  const quotesFromComments = commentIds.flatMap((commentId) => {
    const comment = comments[commentId];
    return comment
      ? [
          {
            id: comment.id,
            text: comment.text,
            likes: comment.likes,
            source: comment.source,
          },
        ]
      : [];
  });
  const quotes = [...quotesFromEvidence, ...quotesFromComments].filter(
    (quote, index, all) => all.findIndex((candidate) => candidate.id === quote.id && candidate.text === quote.text) === index,
  );

  return {
    claim: firstString(rawEvidence.claim, rawQuestion.claim) || "Bewijs uit de Public Insights dump.",
    n: asNullableNumber(rawEvidence.n ?? rawEvidence.count),
    denominator: asNullableNumber(rawEvidence.denominator ?? rawEvidence.dataset_total ?? rawEvidence.total),
    pct: asNullableNumber(rawEvidence.pct ?? rawEvidence.percentage),
    codes,
    comment_ids: commentIds,
    quotes,
    quote_count: quotes.length,
    note: firstString(rawEvidence.note, rawQuestion.note),
    comparison: isRecord(rawEvidence.comparison)
      ? Object.fromEntries(
          Object.entries(rawEvidence.comparison).map(([key, value]) => {
            const item = asRecord(value);
            return [key, { n: asNullableNumber(item.n) ?? 0, pct: asNullableNumber(item.pct) ?? undefined }];
          }),
        )
      : undefined,
  } satisfies NormalizedEvidence;
}

function normalizeQuestion(rawQuestion: unknown, index: number, comments: Record<string, NormalizedComment>) {
  const question = asRecord(rawQuestion);
  const id = firstString(question.id, question.question_id, question.slug) || `vraag-${index + 1}`;
  const options = normalizeOptions(question);
  const correctIndex = normalizeCorrectIndex(question, options);

  return {
    id,
    type: firstString(question.type) || "multiple_choice",
    tone: firstString(question.tone, question.label) || "publieke-peiler",
    context: firstString(question.context, question.intro),
    prompt: firstString(question.prompt, question.question, question.title) || "Welke reactie past het best?",
    options,
    optionDetails: normalizeOptionDetails(question, options),
    correctIndex,
    feedbackCorrect: firstString(question.feedbackCorrect, question.feedback_correct) || "Goed gezien.",
    feedbackWrong: firstString(question.feedbackWrong, question.feedback_wrong) || "Bijna.",
    evidence: normalizeEvidence(question, comments, id),
  } satisfies NormalizedQuestion;
}

function warnInDevelopment(messages: string[]) {
  if (process.env.NODE_ENV === "production") return;
  messages.forEach((message) => console.warn(`[Public Insights normalizer] ${message}`));
}

export function normalizeQuizPack(rawPack: unknown): NormalizedQuizPack {
  const pack = asRecord(rawPack);
  const rawSeed = getRawSeed(pack);
  const dashboard = getRawDashboard(pack);
  const rawEvidenceContext = asRecord(pack.evidenceContext ?? pack.evidence_context ?? rawSeed.evidenceContext);
  const rawQuestions = Array.isArray(rawSeed.questions)
    ? rawSeed.questions
    : Array.isArray(pack.questions)
      ? pack.questions
      : [];
  const comments = normalizeComments(
    rawEvidenceContext.comments ?? dashboard.comments,
    rawEvidenceContext.quote_bank ?? dashboard.quote_bank,
  );
  const codeLabels = normalizeCodeLabels(pack, rawSeed, rawEvidenceContext, dashboard);
  const questions = rawQuestions.map((question, index) => normalizeQuestion(question, index, comments));
  const configuredSelection = [
    ...asStringArray(pack.selectedQuestionIds ?? pack.selected_question_ids),
    ...asStringArray(asRecord(rawSeed.game).featuredQuestionIds),
  ];
  const selectedQuestionIds = configuredSelection.filter((id, index, all) => id && all.indexOf(id) === index);
  const quizTitle = firstString(rawSeed.quizTitle, rawSeed.quiz_title, pack.quizTitle, pack.name) || "Public Insights quiz";
  const subtitle = firstString(rawSeed.subtitle, pack.subtitle) || "Wat denkt Nederland echt?";
  const missingQuoteTextQuestionCount = questions.filter(
    (question) => question.evidence.comment_ids.length > 0 && question.evidence.quotes.length === 0,
  ).length;
  const validation: QuizPackValidation = {
    missingCodeLabels: Object.keys(codeLabels).length === 0,
    missingQuoteTextQuestionCount,
    warnings: [
      ...(missingQuoteTextQuestionCount ? [`Deze dump mist quote-tekst voor ${missingQuoteTextQuestionCount} vragen`] : []),
      ...(Object.keys(codeLabels).length === 0 ? ["Deze dump mist codeLabels, fallback labels worden gebruikt"] : []),
    ],
  };
  const source = normalizeSource(rawSeed, dashboard);
  const game = asRecord(rawSeed.game);
  const postQuizSlides = normalizePostQuizSlides(pack, rawSeed, questions, comments);
  const normalizedSeed: NormalizedQuizSeed = {
    game: {
      featuredQuestionIds: selectedQuestionIds.length ? selectedQuestionIds : asStringArray(game.featuredQuestionIds),
      questionCount: asNullableNumber(game.questionCount) ?? undefined,
      winThreshold: asNullableNumber(game.winThreshold) ?? undefined,
    },
    quizTitle,
    subtitle,
    source,
    questions,
    postQuizSlides,
    resultBands: normalizeResultBands(rawSeed),
  };

  if (validation.warnings.length) warnInDevelopment(validation.warnings);

  return {
    quizTitle,
    subtitle,
    evidenceContext: {
      codeLabels,
      comments,
    },
    questions,
    selectedQuestionIds,
    seed: normalizedSeed,
    postQuizSlides,
    validation,
  };
}
