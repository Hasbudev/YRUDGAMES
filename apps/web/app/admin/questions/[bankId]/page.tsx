import { QuestionsClient } from "./QuestionsClient";

export default async function QuestionBankPage({ params }: { params: Promise<{ bankId: string }> }) {
  const { bankId } = await params;
  return <QuestionsClient bankId={bankId} />;
}
