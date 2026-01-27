// app/api/admin/results/pdf/lib/adminPdfTemplate.ts

import type { QuizSubmission } from "@/lib/schemas/quiz";
import { wakeReasonLabels, bowelIssueLabels } from "@/lib/labels/quizLabels";

interface AdminPdfData {
  quizId: string;
  createdAt: string;
  submission: QuizSubmission;
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
  const { quizId, createdAt, submission, reportHtml } = data;

  const header = buildHeader(submission.name, createdAt, quizId);
  const answersSection = buildAnswersSection(submission);
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

function buildAnswersSection(submission: QuizSubmission): string {
  return `
    <h2>Quiz Responses</h2>

    <table class="answers-table">
      <tbody>
        <tr>
          <th>Energy Level</th>
          <td><strong>${submission.energyLevel}</strong> / 10</td>
        </tr>
        <tr>
          <th>Crashes after lunch</th>
          <td>${formatYesNo(submission.crashAfterLunch)}</td>
        </tr>
        <tr>
          <th>Difficulty waking</th>
          <td>${formatYesNo(submission.difficultyWaking)}</td>
        </tr>
        <tr>
          <th>Brain fog</th>
          <td>${formatYesNo(submission.brainFog)}</td>
        </tr>
        <tr>
          <th>Cold extremities</th>
          <td>${formatYesNo(submission.coldExtremities)}</td>
        </tr>
        <tr>
          <th>White tongue</th>
          <td>${formatYesNo(submission.whiteTongue)}</td>
        </tr>
        <tr>
          <th>Wakes at night</th>
          <td>${formatWakeAtNight(submission.wakeAtNight)}</td>
        </tr>
        <tr>
          <th>Bowel issues</th>
          <td>${formatBowelIssues(submission.bowelIssues)}</td>
        </tr>
      </tbody>
    </table>

    <h3>Typical Eating</h3>
    <div class="freetext-answer">${escapeHtml(submission.typicalEating)}</div>

    <h3>Health Goals</h3>
    <div class="freetext-answer">${escapeHtml(submission.healthGoals)}</div>
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

function formatWakeAtNight(wake: QuizSubmission["wakeAtNight"]): string {
  if (!wake.wakes) return "No";
  if (!wake.reasons?.length) return "Yes";
  const reasons = wake.reasons.map((r) => wakeReasonLabels[r]).join(", ");
  return `Yes (${reasons})`;
}

function formatBowelIssues(issues: QuizSubmission["bowelIssues"]): string {
  if (issues.length === 0) return "None";
  return issues.map((i) => bowelIssueLabels[i]).join(", ");
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/\n/g, "<br>");
}
