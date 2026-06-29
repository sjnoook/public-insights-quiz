import alcoholadviesPack from "@/data/quiz-packs/alcoholadvies.json";
import hittegolfPack from "@/data/quiz-packs/hittegolf.json";
import korteBroekPack from "@/data/quiz-packs/korte-broek-op-kantoor.json";
import socialemediaverbodPack from "@/data/quiz-packs/socialemediaverbod.json";
import teslaFsdPack from "@/data/quiz-packs/tesla-fsd.json";
import woningmarktPack from "@/data/quiz-packs/woningmarkt.json";
import {
  normalizeQuizPack,
  type EvidenceContext,
  type QuizPackValidation,
  type QuizSeed,
} from "@/lib/quizNormalizer";

export type BundledQuizPack = {
  evidenceContext: EvidenceContext;
  id: string;
  name: string;
  seed: QuizSeed;
  selectedQuestionIds: string[];
  sourceName: string;
  updatedAt: string;
  validation?: QuizPackValidation;
};

const BUNDLED_PACK_INPUTS = [
  {
    id: "bundled-korte-broek",
    name: "Publieke Peiler: korte broek op kantoor",
    raw: korteBroekPack,
    sourceName: "korte-broek-op-kantoor.json",
  },
  {
    id: "bundled-socialemediaverbod",
    name: "Publieke Peiler: socialmediaverbod",
    raw: socialemediaverbodPack,
    sourceName: "socialemediaverbod.json",
  },
  {
    id: "bundled-woningmarkt",
    name: "Publieke Peiler: woningmarkt",
    raw: woningmarktPack,
    sourceName: "woningmarkt.json",
  },
  {
    id: "bundled-tesla-fsd",
    name: "Publieke Peiler: Tesla FSD",
    raw: teslaFsdPack,
    sourceName: "tesla-fsd.json",
  },
  {
    id: "bundled-alcoholadvies",
    name: "Publieke Peiler: alcoholadvies",
    raw: alcoholadviesPack,
    sourceName: "alcoholadvies.json",
  },
  {
    id: "bundled-hittegolf",
    name: "Publieke Peiler: hittegolf",
    raw: hittegolfPack,
    sourceName: "hittegolf.json",
  },
] as const;

export const BUNDLED_PACKS: BundledQuizPack[] = BUNDLED_PACK_INPUTS.map((input) => {
  const normalized = normalizeQuizPack(input.raw);

  return {
    evidenceContext: normalized.evidenceContext,
    id: input.id,
    name: normalized.quizTitle || input.name,
    seed: normalized.seed,
    selectedQuestionIds: normalized.selectedQuestionIds,
    sourceName: input.sourceName,
    updatedAt: "bundled",
    validation: normalized.validation,
  };
});

export const DEFAULT_BUNDLED_PACK = BUNDLED_PACKS[0] as BundledQuizPack;

export function findBundledPack(packId: string | undefined) {
  if (!packId) return undefined;

  return BUNDLED_PACKS.find((pack) => pack.id === packId);
}
