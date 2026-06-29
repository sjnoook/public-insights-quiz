import QuizApp from "@/components/QuizApp";
import { DEFAULT_BUNDLED_PACK } from "@/lib/bundledPacks";

export default function QuizPage() {
  return (
    <QuizApp
      evidenceContext={DEFAULT_BUNDLED_PACK.evidenceContext}
      seed={DEFAULT_BUNDLED_PACK.seed}
    />
  );
}
