import type { EvidenceContext, QuizSeed } from "@/components/QuizApp";

export type DashboardBundle = {
  counts?: {
    theme_counts?: Array<{
      theme_id: string;
      label: string;
    }>;
  };
  comments?: Array<{
    comment_id: string;
    full_text?: string;
    likes?: number;
    theme_label_list?: string[];
    stance_label?: string;
    emotion?: string;
  }>;
  quote_bank?: Array<{
    comment_id: string;
    full_quote?: string;
    recommended_slide_use?: string;
    likes?: number;
  }>;
};

export function buildEvidenceContext(seed: Pick<QuizSeed, "questions">, dashboard: DashboardBundle): EvidenceContext {
  const usedCommentIds = new Set(
    seed.questions.flatMap((question) => question.evidence.comment_ids ?? []),
  );
  const commentsById = new Map((dashboard.comments ?? []).map((comment) => [comment.comment_id, comment]));
  const quotesById = new Map((dashboard.quote_bank ?? []).map((quote) => [quote.comment_id, quote]));

  return {
    codeLabels: Object.fromEntries(
      (dashboard.counts?.theme_counts ?? []).map((theme) => [theme.theme_id, theme.label]),
    ),
    comments: Object.fromEntries(
      [...usedCommentIds].flatMap((commentId) => {
        const comment = commentsById.get(commentId);
        const quote = quotesById.get(commentId);
        const text = quote?.full_quote ?? comment?.full_text;

        if (!text) return [];

        return [
          [
            commentId,
            {
              text,
              likes: quote?.likes ?? comment?.likes,
              themeLabels: comment?.theme_label_list ?? [],
              stanceLabel: comment?.stance_label,
              emotion: comment?.emotion,
              slideUse: quote?.recommended_slide_use,
            },
          ],
        ];
      }),
    ),
  };
}
