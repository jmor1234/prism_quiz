import Link from "next/link";
import type { Metadata } from "next";
import { getAllVariants } from "@/lib/quiz/variants";
import { ModeToggle } from "@/components/ui/mode-toggle";

export const metadata: Metadata = {
  title: "Prism Health Assessments",
  description:
    "Discover what's really driving your health concerns. Choose a personalized assessment and uncover the patterns behind your symptoms.",
};

export default function QuizIndexPage() {
  const variants = getAllVariants();

  return (
    <div className="min-h-screen quiz-background relative overflow-hidden">
      {/* Subtle decorative accent */}
      <div
        className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full opacity-[0.07]"
        style={{
          background:
            "radial-gradient(circle, var(--quiz-gold) 0%, transparent 70%)",
        }}
      />

      <div className="absolute top-4 right-4 z-10">
        <ModeToggle />
      </div>

      <div className="relative max-w-5xl mx-auto px-5 sm:px-8 py-16 sm:py-24">
        {/* Header */}
        <div className="text-center mb-12 sm:mb-16">
          <p className="text-xs font-medium tracking-[0.25em] uppercase text-[var(--quiz-gold)] mb-4">
            Prism Health
          </p>
          <h1 className="font-[family-name:var(--font-display)] text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight mb-4">
            Health Assessments
          </h1>
          <p className="text-muted-foreground text-base sm:text-lg max-w-lg mx-auto leading-relaxed">
            Choose an assessment to uncover the patterns behind your symptoms.
          </p>
        </div>

        {/* Thin gold rule */}
        <div className="mx-auto mb-12 sm:mb-16 w-16 h-px bg-[var(--quiz-gold)]/40" />

        {/* Chat option */}
        <Link
          href="/chat"
          className="group block mx-auto max-w-md mb-10 sm:mb-12 rounded-xl border border-[var(--quiz-gold)]/30 bg-[var(--quiz-gold)]/[0.04] p-5 text-center transition-all duration-300 hover:border-[var(--quiz-gold)]/60 hover:bg-[var(--quiz-gold)]/[0.08] hover:-translate-y-0.5 hover:shadow-lg hover:shadow-[var(--quiz-gold)]/5"
        >
          <p className="text-xs text-muted-foreground mb-1.5">
            Not sure where to start?
          </p>
          <p className="text-sm font-semibold group-hover:text-[var(--quiz-gold)] transition-colors duration-300">
            Chat with our health agent directly
          </p>
          <p className="text-xs text-muted-foreground mt-1.5">
            Describe what you&apos;re experiencing and get research-backed insights
          </p>
        </Link>

        {/* Card grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {variants.map((variant) => (
            <Link
              key={variant.slug}
              href={`/quiz/${variant.slug}`}
              className="group relative block rounded-xl border border-border/60 bg-card/50 backdrop-blur-sm p-6 transition-all duration-300 hover:border-[var(--quiz-gold)]/50 hover:bg-card/80 hover:shadow-lg hover:shadow-[var(--quiz-gold)]/5 hover:-translate-y-0.5"
            >
              {/* Gold top accent line */}
              <div className="absolute top-0 left-6 right-6 h-px bg-gradient-to-r from-transparent via-[var(--quiz-gold)]/0 to-transparent group-hover:via-[var(--quiz-gold)]/40 transition-all duration-500" />

              <h2 className="font-semibold text-[15px] mb-2 group-hover:text-[var(--quiz-gold)] transition-colors duration-300">
                {variant.name}
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {variant.subtitle ?? variant.description}
              </p>

              {/* Arrow indicator */}
              <div className="mt-4 flex items-center text-xs font-medium text-[var(--quiz-gold)] opacity-0 group-hover:opacity-100 transition-[opacity,transform] duration-300 translate-x-0 group-hover:translate-x-1">
                <span>Begin</span>
                <svg
                  className="ml-1 w-3.5 h-3.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M13 7l5 5m0 0l-5 5m5-5H6"
                  />
                </svg>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
