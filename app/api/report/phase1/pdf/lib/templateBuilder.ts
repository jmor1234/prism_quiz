// app/api/report/phase1/pdf/lib/templateBuilder.ts

import { promises as fs } from "node:fs";
import path from "node:path";
import type { ProcessedReport } from "./markdownProcessor";

/**
 * Builds complete HTML document with branded cover page, section dividers, and styled content
 * 
 * Structure:
 * 1. Cover page (gradient + logo + client name)
 * 2. "Our Analysis" divider page
 * 3. Introduction + Assessment content (with orange border)
 * 4. "Our Recommendations" divider page
 * 5. Recommendations + Conclusion + References (with orange border)
 */

let logoBase64Cache: string | null = null;

async function getLogoBase64(): Promise<string> {
  if (logoBase64Cache) {
    return logoBase64Cache;
  }

  const logoPath = path.join(process.cwd(), "app", "api", "report", "phase1", "pdf", "lib", "prism_transparent.png");
  const logoBuffer = await fs.readFile(logoPath);
  logoBase64Cache = `data:image/png;base64,${logoBuffer.toString("base64")}`;
  
  return logoBase64Cache;
}

function buildCoverPage(clientName: string, logoBase64: string): string {
  return `
    <div class="cover-page">
      <img src="${logoBase64}" alt="Prism Health Logo" />
      <h1>PRISM</h1>
      <h2>Client Care Report</h2>
      <p class="tagline">We looked at your health through a new lens...</p>
      <p class="disclaimer">The information contained in this report is not to be construed as medical advice.</p>
    </div>
  `;
}

function buildDividerPage(title: string, subtitle: string, logoBase64: string): string {
  return `
    <div class="divider-page">
      <img src="${logoBase64}" alt="Prism Health Logo" />
      <h1>${title}</h1>
      <p>${subtitle}</p>
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

export async function buildReportHtml(
  processedReport: ProcessedReport,
  convertedSections: {
    beforeIntroduction: string;
    introduction: string;
    recommendations: string;
    references: string;
  }
): Promise<string> {
  const logoBase64 = await getLogoBase64();

  // Build complete HTML body
  const bodyContent = [
    // 1. Cover page
    buildCoverPage(processedReport.clientName, logoBase64),

    // 2. "Our Analysis" divider
    buildDividerPage("Our Analysis", "Here's what we think is going on:", logoBase64),

    // 3. Introduction + Assessment content (h1 + ## Introduction through ## Assessment Findings)
    buildContentSection(
      convertedSections.beforeIntroduction + "\n\n" + convertedSections.introduction
    ),

    // 4. "Our Recommendations" divider
    buildDividerPage("Our Recommendations", "Here's what we think will help you:", logoBase64),

    // 5. Recommendations + Conclusion + References
    buildContentSection(
      convertedSections.recommendations +
        (convertedSections.references ? "\n\n" + convertedSections.references : "")
    ),
  ].join("\n");

  return bodyContent;
}

