import QuizApp, { type EvidenceContext, type QuizSeed } from "@/components/QuizApp";
import { buildEvidenceContext, type DashboardBundle } from "@/lib/evidence";
import quizSeed from "@/data/quiz_seed.json";
import dashboardBundle from "@/public/data/public_insights_dashboard_bundle.json";

export default function QuizPage() {
  return (
    <QuizApp
      evidenceContext={buildEvidenceContext(quizSeed as QuizSeed, dashboardBundle as DashboardBundle) as EvidenceContext}
      seed={quizSeed as QuizSeed}
    />
  );
}
