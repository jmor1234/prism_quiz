// app/api/admin/results/pdf/lib/adminPdfTemplate.ts

import { getVariant } from "@/lib/quiz/variants";
import type { QuestionConfig, YesNoWithFollowUp } from "@/lib/quiz/types";

interface AdminPdfData {
  quizId: string;
  createdAt: string;
  variant: string;
  name: string;
  answers: Record<string, unknown>;
  reportHtml: string;
}

/**
 * Build complete HTML for admin quiz PDF export
 *
 * Structure:
 * 1. Header with client name, variant, date, and quiz ID
 * 2. Quiz Responses (config-driven, works for any variant)
 * 3. AI Assessment (markdown converted to HTML)
 */
export function buildAdminPdfHtml(data: AdminPdfData): string {
  const { quizId, createdAt, variant, name, answers, reportHtml } = data;

  const config = getVariant(variant);
  const variantName = config?.name ?? variant;

  const header = buildHeader(name, variantName, createdAt, quizId);
  const answersSection = config
    ? buildAnswersSection(config.questions, answers)
    : buildFallbackAnswersSection(answers);
  const assessmentSection = buildAssessmentSection(reportHtml);

  return `
    ${header}
    <div class="content-section">
      ${answersSection}
      ${assessmentSection}
    </div>
  `;
}

function buildHeader(name: string, variantName: string, createdAt: string, quizId: string): string {
  const date = new Date(createdAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return `
    <div class="admin-header">
      <h1>Quiz Assessment Report</h1>
      <div class="admin-header-meta">
        <div class="admin-header-client">${escapeHtml(name)}</div>
        <div class="admin-header-details">
          <span>${escapeHtml(variantName)}</span>
          <span>${date}</span>
          <span class="admin-header-id">ID: ${quizId.slice(0, 8)}</span>
        </div>
      </div>
    </div>
  `;
}

function formatAnswerValue(q: QuestionConfig, value: unknown): string {
  switch (q.type) {
    case "slider":
      return `<strong>${value ?? 0}</strong> / ${q.max}`;

    case "yes_no": {
      if (q.conditionalFollowUp) {
        const compound = typeof value === "boolean"
          ? { answer: value, followUp: [] as string[] }
          : (value as YesNoWithFollowUp | undefined);
        if (!compound || compound.answer !== true) return "No";
        if (!compound.followUp?.length) return "Yes";
        const reasons = compound.followUp
          .map((v) => {
            const opt = q.conditionalFollowUp!.options.find((o) => o.value === v);
            return opt ? opt.label : v;
          })
          .join(", ");
        return `Yes (${escapeHtml(reasons)})`;
      }
      return value ? "Yes" : "No";
    }

    case "multi_select": {
      const selected = (value ?? []) as string[];
      if (selected.length === 0) return "None";
      return escapeHtml(
        selected
          .map((v) => {
            const opt = q.options.find((o) => o.value === v);
            return opt ? opt.label : v;
          })
          .join(", ")
      );
    }

    case "single_select": {
      const opt = q.options.find((o) => o.value === value);
      return escapeHtml(opt ? opt.label : String(value ?? ""));
    }

    case "free_text":
      return ""; // handled separately
  }
}

function buildAnswersSection(questions: QuestionConfig[], answers: Record<string, unknown>): string {
  const tableQuestions = questions.filter((q) => q.type !== "free_text");
  const freeTextQuestions = questions.filter((q) => q.type === "free_text");

  const tableRows = tableQuestions
    .map((q) => {
      const label = q.promptLabel ?? q.question;
      return `<tr><th>${escapeHtml(label)}</th><td>${formatAnswerValue(q, answers[q.id])}</td></tr>`;
    })
    .join("\n");

  const freeTextSections = freeTextQuestions
    .map((q) => {
      const label = q.promptLabel ?? q.question;
      return `<h3>${escapeHtml(label)}</h3>\n<div class="freetext-answer">${escapeHtml(String(answers[q.id] ?? ""))}</div>`;
    })
    .join("\n");

  return `
    <h2>Quiz Responses</h2>
    <table class="answers-table"><tbody>${tableRows}</tbody></table>
    ${freeTextSections}
  `;
}

function buildFallbackAnswersSection(answers: Record<string, unknown>): string {
  const rows = Object.entries(answers)
    .map(([key, val]) => `<tr><th>${escapeHtml(key)}</th><td>${escapeHtml(JSON.stringify(val))}</td></tr>`)
    .join("\n");

  return `
    <h2>Quiz Responses</h2>
    <table class="answers-table"><tbody>${rows}</tbody></table>
  `;
}

function buildAssessmentSection(reportHtml: string): string {
  if (!reportHtml) {
    return `
      <h2>AI Assessment</h2>
      <p class="no-assessment">No assessment generated</p>
    `;
  }

  return `
    <h2>AI Assessment</h2>
    ${reportHtml}
  `;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/\n/g, "<br>");
}
