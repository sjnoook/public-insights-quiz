import { buildEvidenceContext, type DashboardBundle } from "@/lib/evidence";
import { normalizeQuizPack, type EvidenceContext, type QuizSeed } from "@/lib/quizNormalizer";
import QuizApp from "@/components/QuizApp";
import quizSeed from "@/data/quiz_seed.json";
import dashboardBundle from "@/public/data/public_insights_dashboard_bundle.json";

export default function QuizPage() {
  const evidenceContext = buildEvidenceContext(quizSeed as QuizSeed, dashboardBundle as DashboardBundle) as EvidenceContext;
  const pack = normalizeQuizPack({ dashboard: dashboardBundle, evidenceContext, seed: quizSeed });

  return (
    <QuizApp
      evidenceContext={pack.evidenceContext}
      seed={pack.seed}
    />
  );
}
