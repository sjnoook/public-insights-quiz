import QuizStudio from "@/components/QuizStudio";
import type { DashboardBundle } from "@/lib/evidence";
import type { QuizSeed } from "@/lib/quizNormalizer";
import quizSeed from "@/data/quiz_seed.json";
import dashboardBundle from "@/public/data/public_insights_dashboard_bundle.json";

export default function EditorPage() {
  return <QuizStudio defaultDashboard={dashboardBundle as DashboardBundle} defaultSeed={quizSeed as QuizSeed} />;
}
