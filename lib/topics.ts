export const PUBLIC_INSIGHTS_TOPICS_KEY = "public-insights-topics-v3";
export const PUBLIC_INSIGHTS_DELETED_TOPICS_KEY = "public-insights-deleted-topics-v3";
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
  "drink",
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
    accent: "purple",
    description: "Een luchtige kantoor-discussie waarin comfort, professionaliteit en dubbele standaarden botsen.",
    icon: "shorts",
    id: "korte-broek",
    label: "KORTE BROEK OP WERK",
    packId: "bundled-korte-broek",
    prompt: "Kantoorhit of dresscode-drama?",
    status: "actief",
  },
  {
    accent: "cyan",
    description: "Reacties over schermtijd, online veiligheid, ouderrol en platformverantwoordelijkheid.",
    icon: "phone",
    id: "social-media",
    label: "SOCIAL MEDIA VERBOD JONGEREN",
    packId: "bundled-socialemediaverbod",
    prompt: "Ja of nee?",
    status: "actief",
  },
  {
    accent: "blue",
    description: "Reacties over huizenprijzen, starters, betaalbaarheid en het gevoel dat wonen steeds verder weg schuift.",
    icon: "housing",
    id: "woningmarkt",
    label: "WONINGMARKT",
    packId: "bundled-woningmarkt",
    prompt: "Wie kan er nog wonen?",
    status: "actief",
  },
  {
    accent: "orange",
    description: "Reacties over zelfrijdende auto's, vertrouwen, aansprakelijkheid en Nederlandse verkeersrealiteit.",
    icon: "car",
    id: "tesla-fsd",
    label: "TESLA FSD",
    packId: "bundled-tesla-fsd",
    prompt: "Slimme auto of spannend risico?",
    status: "actief",
  },
  {
    accent: "lime",
    description: "Reacties over alcoholadvies, vrijheid, gezondheid en de grens tussen waarschuwing en betutteling.",
    icon: "drink",
    id: "alcoholadvies",
    label: "ALCOHOLADVIES",
    packId: "bundled-alcoholadvies",
    prompt: "Gezond advies of bemoeienis?",
    status: "actief",
  },
  {
    accent: "orange",
    description: "Reacties over hitte, klimaat, dagelijks ongemak en de vraag wanneer warm weer een publiek probleem wordt.",
    icon: "climate",
    id: "hittegolf",
    label: "HITTEGOLF",
    packId: "bundled-hittegolf",
    prompt: "Zweet, zeur en zonnebrand.",
    status: "actief",
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
    packId: "packId" in input ? input.packId || undefined : fallback.packId,
    prompt: input.prompt?.trim() || fallback.prompt,
    sourcesVisible: input.sourcesVisible ?? fallback.sourcesVisible ?? true,
    status,
  };
}

function normalizeDeletedTopicIds(deletedTopicIds: unknown) {
  return Array.isArray(deletedTopicIds)
    ? deletedTopicIds.filter((id): id is string => typeof id === "string" && Boolean(id.trim()))
    : [];
}

export function parseTopicStorageValue(raw: string | null, fallback: unknown): unknown {
  if (!raw) return fallback;

  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return fallback;
  }
}

export function mergeStoredTopics(stored: unknown, deletedTopicIds: unknown = []): PublicInsightTopic[] {
  const deletedIds = new Set(normalizeDeletedTopicIds(deletedTopicIds));
  if (!Array.isArray(stored)) return DEFAULT_TOPICS.filter((topic) => !deletedIds.has(topic.id));

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
    .filter((topic) => topic.id && topic.label && !deletedIds.has(topic.id));

  const storedIds = new Set(normalizedStored.map((topic) => topic.id));
  const missingDefaults = DEFAULT_TOPICS.filter((topic) => !storedIds.has(topic.id) && !deletedIds.has(topic.id));

  return [...normalizedStored, ...missingDefaults];
}
