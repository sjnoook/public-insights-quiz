export const PUBLIC_INSIGHTS_TOPICS_KEY = "public-insights-topics-v1";
export const ACTIVE_TOPIC_STATUS = "actief";

export const TOPIC_STATUSES = ["actief", "concept", "mist data", "verborgen"] as const;
export const TOPIC_ACCENTS = ["lime", "purple", "cyan", "orange", "blue"] as const;
export const TOPIC_ICONS = [
  "bike",
  "shorts",
  "phone",
  "coach",
  "ai",
  "vape",
  "office",
  "application",
  "car",
  "housing",
  "energy",
  "climate",
  "asylum",
] as const;

export type TopicStatus = (typeof TOPIC_STATUSES)[number];
export type TopicAccent = (typeof TOPIC_ACCENTS)[number];
export type TopicIcon = (typeof TOPIC_ICONS)[number];

export type PublicInsightTopic = {
  accent: TopicAccent;
  description: string;
  icon: TopicIcon;
  id: string;
  label: string;
  packId?: string;
  prompt: string;
  sourcesVisible?: boolean;
  status: TopicStatus;
};

export const DEFAULT_TOPICS: PublicInsightTopic[] = [
  {
    accent: "lime",
    description: "Publieke reacties over overlast, status, veiligheid en de plek van de fatbike in de stad.",
    icon: "bike",
    id: "fatbike",
    label: "FATBIKE",
    prompt: "Wat vindt Nederland van de fatbike?",
    status: "mist data",
  },
  {
    accent: "purple",
    description: "Een luchtige kantoor-discussie waarin comfort, professionaliteit en dubbele standaarden botsen.",
    icon: "shorts",
    id: "korte-broek",
    label: "KORTE BROEK OP WERK",
    prompt: "Kantoorhit of dresscode-drama?",
    status: "actief",
  },
  {
    accent: "cyan",
    description: "Reacties over schermtijd, online veiligheid, ouderrol en platformverantwoordelijkheid.",
    icon: "phone",
    id: "social-media",
    label: "SOCIAL MEDIA VERBOD JONGEREN",
    prompt: "Ja of nee?",
    status: "concept",
  },
  {
    accent: "orange",
    description: "Publieke frames rond bondscoach Koeman: vertrouwen, frustratie, verwachtingen en voetbalgevoel.",
    icon: "coach",
    id: "koeman",
    label: "WAT DENKT NEDERLAND OVER KOEMAN",
    prompt: "Bondscoach of bliksemafleider?",
    status: "concept",
  },
  {
    accent: "blue",
    description: "Reacties over AI, werkzekerheid, kansen, controle en de vraag wie straks nog waarde toevoegt.",
    icon: "ai",
    id: "ai-banen",
    label: "AI GAAT ONZE BANEN OVERNEMEN",
    prompt: "Paniek of prima kans?",
    status: "mist data",
  },
];

export function normalizeTopic(input: Partial<PublicInsightTopic>, fallback: PublicInsightTopic): PublicInsightTopic {
  const status = TOPIC_STATUSES.includes(input.status as TopicStatus) ? (input.status as TopicStatus) : fallback.status;
  const accent = TOPIC_ACCENTS.includes(input.accent as TopicAccent) ? (input.accent as TopicAccent) : fallback.accent;
  const icon = TOPIC_ICONS.includes(input.icon as TopicIcon) ? (input.icon as TopicIcon) : fallback.icon;

  return {
    accent,
    description: input.description?.trim() || fallback.description,
    icon,
    id: input.id?.trim() || fallback.id,
    label: input.label?.trim() || fallback.label,
    packId: input.packId || fallback.packId,
    prompt: input.prompt?.trim() || fallback.prompt,
    sourcesVisible: input.sourcesVisible ?? fallback.sourcesVisible ?? true,
    status,
  };
}

export function mergeStoredTopics(stored: unknown): PublicInsightTopic[] {
  if (!Array.isArray(stored)) return DEFAULT_TOPICS;

  const defaultsById = new Map(DEFAULT_TOPICS.map((topic) => [topic.id, topic]));
  const normalizedStored = stored
    .map((topic) => {
      const candidate = topic as Partial<PublicInsightTopic>;
      const fallback =
        (candidate.id ? defaultsById.get(candidate.id) : undefined) ??
        ({
          accent: "lime",
          description: "",
          icon: "phone",
          id: candidate.id || `topic-${Date.now()}`,
          label: "Nieuw onderwerp",
          prompt: "Waar gaat Nederland op reageren?",
          status: "concept",
        } satisfies PublicInsightTopic);

      return normalizeTopic(candidate, fallback);
    })
    .filter((topic) => topic.id && topic.label);

  const storedIds = new Set(normalizedStored.map((topic) => topic.id));
  const missingDefaults = DEFAULT_TOPICS.filter((topic) => !storedIds.has(topic.id));

  return [...normalizedStored, ...missingDefaults];
}
