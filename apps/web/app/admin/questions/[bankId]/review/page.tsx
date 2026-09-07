import { ReviewClient } from "./ReviewClient";

export default async function QuestionReviewPage({ params }: { params: Promise<{ bankId: string }> }) {
  const { bankId } = await params;
  return <ReviewClient bankId={bankId} />;
}
