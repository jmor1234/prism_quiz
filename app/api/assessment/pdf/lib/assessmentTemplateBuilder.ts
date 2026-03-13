// app/api/assessment/pdf/lib/assessmentTemplateBuilder.ts

function buildContentSection(htmlContent: string): string {
  return `
    <div class="content-section">
      ${htmlContent}
    </div>
  `;
}

export async function buildAssessmentHtml(
  markdownHtml: string
): Promise<string> {
  return buildContentSection(markdownHtml);
}
