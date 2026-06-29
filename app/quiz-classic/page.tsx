import QuizApp from "@/components/QuizApp";
import { DEFAULT_BUNDLED_PACK } from "@/lib/bundledPacks";

export default function QuizClassicPage() {
  return (
    <QuizApp
      evidenceContext={DEFAULT_BUNDLED_PACK.evidenceContext}
      landingVariant="classic"
      seed={DEFAULT_BUNDLED_PACK.seed}
    />
  );
}
