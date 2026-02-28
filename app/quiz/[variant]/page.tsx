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
      ...(config.ogImage && {
        images: [{ url: config.ogImage, width: 1200, height: 630 }],
      }),
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

  return <QuizClient variant={config} />;
}
