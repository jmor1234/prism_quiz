import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getBestLifeResult } from "@/server/bestLifeResults";
import { PrismAssessmentResultClient } from "./result-client";

interface Props {
  params: Promise<{ quizId: string }>;
}

export const metadata: Metadata = {
  title: "Your Prism Health Assessment",
  description: "Your personalized intake assessment.",
  robots: { index: false, follow: false },
};

export default async function PrismAssessmentResultPage({ params }: Props) {
  const { quizId } = await params;
  const stored = await getBestLifeResult(quizId);
  if (!stored) notFound();

  return <PrismAssessmentResultClient quizId={stored.id} report={stored.report} />;
}
