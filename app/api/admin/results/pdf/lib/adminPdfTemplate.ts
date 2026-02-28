// app/api/admin/results/pdf/lib/adminPdfTemplate.ts

import { wakeReasonLabels, bowelIssueLabels } from "@/lib/labels/quizLabels";
import type { YesNoWithFollowUp } from "@/lib/quiz/types";

interface AdminPdfData {
  quizId: string;
  createdAt: string;
  name: string;
  answers: Record<string, unknown>;
  reportHtml: string;
}

/**
 * Build complete HTML for admin quiz PDF export
 *
 * Structure:
 * 1. Header with client name, date, and quiz ID
 * 2. Quiz Responses table
 * 3. Free text answers (eating, goals)
 * 4. AI Assessment (markdown converted to HTML)
 */
export function buildAdminPdfHtml(data: AdminPdfData): string {
  const { quizId, createdAt, name, answers, reportHtml } = data;

  const header = buildHeader(name, createdAt, quizId);
  const answersSection = buildAnswersSection(answers);
  const assessmentSection = buildAssessmentSection(reportHtml);

  return `
    ${header}
    <div class="content-section">
      ${answersSection}
      ${assessmentSection}
    </div>
  `;
}

function buildHeader(name: string, createdAt: string, quizId: string): string {
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
          <span>${date}</span>
          <span class="admin-header-id">ID: ${quizId.slice(0, 8)}</span>
        </div>
      </div>
    </div>
  `;
}

function buildAnswersSection(answers: Record<string, unknown>): string {
  const wakeAtNight = answers.wakeAtNight as YesNoWithFollowUp | undefined;

  return `
    <h2>Quiz Responses</h2>

    <table class="answers-table">
      <tbody>
        <tr>
          <th>Energy Level</th>
          <td><strong>${answers.energyLevel}</strong> / 10</td>
        </tr>
        <tr>
          <th>Crashes after lunch</th>
          <td>${formatYesNo(answers.crashAfterLunch as boolean)}</td>
        </tr>
        <tr>
          <th>Difficulty waking</th>
          <td>${formatYesNo(answers.difficultyWaking as boolean)}</td>
        </tr>
        <tr>
          <th>Brain fog</th>
          <td>${formatYesNo(answers.brainFog as boolean)}</td>
        </tr>
        <tr>
          <th>Cold extremities</th>
          <td>${formatYesNo(answers.coldExtremities as boolean)}</td>
        </tr>
        <tr>
          <th>White tongue</th>
          <td>${formatYesNo(answers.whiteTongue as boolean)}</td>
        </tr>
        <tr>
          <th>Wakes at night</th>
          <td>${formatWakeAtNight(wakeAtNight)}</td>
        </tr>
        <tr>
          <th>Bowel issues</th>
          <td>${formatBowelIssues((answers.bowelIssues ?? []) as string[])}</td>
        </tr>
      </tbody>
    </table>

    <h3>Typical Eating</h3>
    <div class="freetext-answer">${escapeHtml(answers.typicalEating as string)}</div>

    <h3>Health Goals</h3>
    <div class="freetext-answer">${escapeHtml(answers.healthGoals as string)}</div>
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

function formatYesNo(value: boolean): string {
  return value ? "Yes" : "No";
}

function formatWakeAtNight(wake: YesNoWithFollowUp | undefined): string {
  if (!wake || wake.answer !== true) return "No";
  if (!wake.followUp?.length) return "Yes";
  const reasons = wake.followUp
    .map((r) => wakeReasonLabels[r as keyof typeof wakeReasonLabels] ?? r)
    .join(", ");
  return `Yes (${reasons})`;
}

function formatBowelIssues(issues: string[]): string {
  if (issues.length === 0) return "None";
  return issues
    .map((i) => bowelIssueLabels[i as keyof typeof bowelIssueLabels] ?? i)
    .join(", ");
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/\n/g, "<br>");
}
