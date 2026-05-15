import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getBestLifeResult } from "@/server/bestLifeResults";
import { BestLifeHarborResultClient } from "./result-client";

interface Props {
  params: Promise<{ quizId: string }>;
}

export const metadata: Metadata = {
  title: "Your Best Life Harbor Health Intake",
  description: "Your personalized intake assessment.",
  robots: { index: false, follow: false },
};

export default async function BestLifeHarborResultPage({ params }: Props) {
  const { quizId } = await params;
  const stored = await getBestLifeResult(quizId);
  if (!stored) notFound();

  return <BestLifeHarborResultClient quizId={stored.id} report={stored.report} />;
}
