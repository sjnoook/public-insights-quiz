import QuizStudio from "@/components/QuizStudio";
import type { QuizSeed } from "@/components/QuizApp";
import type { DashboardBundle } from "@/lib/evidence";
import quizSeed from "@/data/quiz_seed.json";
import dashboardBundle from "@/public/data/public_insights_dashboard_bundle.json";

export default function EditorPage() {
  return <QuizStudio defaultDashboard={dashboardBundle as DashboardBundle} defaultSeed={quizSeed as QuizSeed} />;
}
