// app/api/quiz/pdf/lib/quizTemplateBuilder.ts

import { promises as fs } from "node:fs";
import path from "node:path";

/**
 * Builds complete HTML document for quiz assessment PDF
 *
 * Structure (simpler than full report):
 * 1. Cover page (gradient + logo + "Your Health Assessment")
 * 2. Single content section (full assessment markdown)
 */

let logoBase64Cache: string | null = null;

async function getLogoBase64(): Promise<string> {
  if (logoBase64Cache) {
    return logoBase64Cache;
  }

  const logoPath = path.join(
    process.cwd(),
    "lib",
    "pdf",
    "prism_transparent.png"
  );
  const logoBuffer = await fs.readFile(logoPath);
  logoBase64Cache = `data:image/png;base64,${logoBuffer.toString("base64")}`;

  return logoBase64Cache;
}

function buildCoverPage(logoBase64: string): string {
  return `
    <div class="cover-page">
      <img src="${logoBase64}" alt="Prism Health Logo" />
      <h1>PRISM</h1>
      <h2>Health Assessment</h2>
      <p class="tagline">Your personalized health insights...</p>
      <p class="disclaimer">The information contained in this assessment is not to be construed as medical advice.</p>
    </div>
  `;
}

function buildContentSection(htmlContent: string): string {
  return `
    <div class="content-section">
      ${htmlContent}
    </div>
  `;
}

export async function buildQuizHtml(markdownHtml: string): Promise<string> {
  const logoBase64 = await getLogoBase64();

  const bodyContent = [
    // 1. Cover page
    buildCoverPage(logoBase64),

    // 2. Assessment content
    buildContentSection(markdownHtml),
  ].join("\n");

  return bodyContent;
}
