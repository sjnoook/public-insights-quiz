import QuizStudio from "@/components/QuizStudio";
import type { DashboardBundle } from "@/lib/evidence";
import { DEFAULT_BUNDLED_PACK } from "@/lib/bundledPacks";

const EMPTY_DASHBOARD = {} as DashboardBundle;

export default function EditorPage() {
  return (
    <QuizStudio
      defaultDashboard={EMPTY_DASHBOARD}
      defaultEvidenceContext={DEFAULT_BUNDLED_PACK.evidenceContext}
      defaultSeed={DEFAULT_BUNDLED_PACK.seed}
    />
  );
}
