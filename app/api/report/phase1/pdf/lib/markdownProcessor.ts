// app/api/report/phase1/pdf/lib/markdownProcessor.ts

/**
 * Processes Phase 1 report markdown to extract metadata and section boundaries
 * 
 * Extracts:
 * - Client name from h1: "# Personalized Health Report: [Name]"
 * - Section boundaries for template injection
 */

export interface ProcessedReport {
  clientName: string;
  sections: {
    beforeIntroduction: string; // H1 and everything before ## Introduction
    introduction: string; // ## Introduction through end of ## Assessment Findings
    recommendations: string; // ## Recommendations through ## Conclusion
    references: string; // ## Scientific References (if present)
  };
}

export function processMarkdown(markdown: string): ProcessedReport {
  // Extract client name from h1
  const h1Match = markdown.match(/^#\s+Personalized Health Report:\s+(.+?)$/m);
  const clientName = h1Match ? h1Match[1].trim() : "Client";

  // Find section boundaries
  const introMatch = markdown.match(/^##\s+Introduction$/m);
  const recommendationsMatch = markdown.match(/^##\s+Recommendations$/m);
  const referencesMatch = markdown.match(/^##\s+Scientific References$/m);

  const introIndex = introMatch?.index ?? -1;
  const recommendationsIndex = recommendationsMatch?.index ?? -1;
  const referencesIndex = referencesMatch?.index ?? -1;

  // Split markdown into sections
  let beforeIntroduction = "";
  let introduction = "";
  let recommendations = "";
  let references = "";

  if (introIndex !== -1) {
    // Everything before ## Introduction (includes h1)
    beforeIntroduction = markdown.substring(0, introIndex).trim();

    if (recommendationsIndex !== -1) {
      // ## Introduction through just before ## Recommendations
      introduction = markdown.substring(introIndex, recommendationsIndex).trim();

      if (referencesIndex !== -1) {
        // ## Recommendations through just before ## Scientific References
        recommendations = markdown.substring(recommendationsIndex, referencesIndex).trim();
        // ## Scientific References to end
        references = markdown.substring(referencesIndex).trim();
      } else {
        // ## Recommendations to end (no references section found)
        recommendations = markdown.substring(recommendationsIndex).trim();
      }
    } else {
      // ## Introduction to end (no recommendations section found - fallback)
      introduction = markdown.substring(introIndex).trim();
    }
  } else {
    // Fallback: no clear section structure, treat entire markdown as single section
    beforeIntroduction = markdown;
  }

  return {
    clientName,
    sections: {
      beforeIntroduction,
      introduction,
      recommendations,
      references,
    },
  };
}

