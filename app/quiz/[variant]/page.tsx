import { notFound } from "next/navigation";
import { getVariant, getAllVariantSlugs } from "@/lib/quiz/variants";
import { QuizClient } from "@/components/quiz/quiz-client";
import type { Metadata } from "next";

interface Props {
  params: Promise<{ variant: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { variant: slug } = await params;
  const config = getVariant(slug);
  if (!config) return {};

  return {
    title: config.headline,
    description: config.description,
    openGraph: {
      title: config.headline,
      description: config.description,
    },
    twitter: {
      card: "summary_large_image",
      title: config.headline,
      description: config.description,
    },
  };
}

export function generateStaticParams() {
  return getAllVariantSlugs().map((slug) => ({ variant: slug }));
}

export default async function QuizVariantPage({ params }: Props) {
  const { variant: slug } = await params;
  const config = getVariant(slug);
  if (!config) notFound();

  // Pass only client-needed fields to minimize serialized props
  const clientConfig: typeof config = {
    slug: config.slug,
    name: config.name,
    description: "",
    questions: config.questions,
    nameField: config.nameField,
    headline: config.headline,
    subtitle: config.subtitle,
    estimatedTime: config.estimatedTime,
    resultBanner: config.resultBanner,
    ctaText: config.ctaText,
    ctaUrl: config.ctaUrl,
    promptOverlay: "",
  };

  return <QuizClient variant={clientConfig} />;
}
