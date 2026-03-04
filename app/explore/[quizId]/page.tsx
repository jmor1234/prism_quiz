import { notFound } from "next/navigation";
import { getQuizSubmission } from "@/server/quizSubmissions";
import { getQuizResult } from "@/server/quizResults";
import { AgentPage } from "./agent-page";
import type { Metadata } from "next";

interface Props {
  params: Promise<{ quizId: string }>;
}

export const metadata: Metadata = {
  title: "Explore Your Results - Prism Health",
};

export default async function ExploreQuizPage({ params }: Props) {
  const { quizId } = await params;

  const [submission, result] = await Promise.all([
    getQuizSubmission(quizId),
    getQuizResult(quizId),
  ]);

  if (!submission || !result) notFound();

  return <AgentPage quizId={quizId} key={quizId} />;
}
