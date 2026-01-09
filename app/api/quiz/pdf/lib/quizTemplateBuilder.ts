// app/api/quiz/pdf/lib/quizTemplateBuilder.ts

/**
 * Builds HTML document for quiz assessment PDF
 * Simple wrapper - just the content section with markdown
 */

function buildContentSection(htmlContent: string): string {
  return `
    <div class="content-section">
      ${htmlContent}
    </div>
  `;
}

export async function buildQuizHtml(markdownHtml: string): Promise<string> {
  return buildContentSection(markdownHtml);
}
