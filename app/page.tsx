import QuizApp, { type EvidenceContext, type QuizSeed } from "@/components/QuizApp";
import { buildEvidenceContext, type DashboardBundle } from "@/lib/evidence";
import dashboardBundle from "@/public/data/public_insights_dashboard_bundle.json";
import quizSeed from "@/data/quiz_seed.json";

export default function Home() {
  return (
    <QuizApp
      seed={quizSeed as QuizSeed}
      evidenceContext={buildEvidenceContext(quizSeed as QuizSeed, dashboardBundle as DashboardBundle) as EvidenceContext}
    />
  );
}
