// app/api/report/phase1/tools/gatherCitations/queryGeneration/prompt.ts

import { CitationQueryGenerationInput } from "./types";
import { BIOENERGETIC_KNOWLEDGE } from "@/lib/knowledge/bioenergeticKnowledge";

export const getCitationQueryPrompt = ({
  subsection,
  pattern,
  summary,
  entities,
}: CitationQueryGenerationInput): string => {
  return `${BIOENERGETIC_KNOWLEDGE}

You are a query generation specialist for discovering academic papers via Exa neural search API.

Context:
- Report section: ${subsection}
- Pattern: ${pattern}
- Findings: ${summary}
- Key entities: ${entities.join(", ")}

Your task: Generate 2-4 optimized neural queries to find academic research papers (category: "research paper") that support these findings and mechanisms.

Query optimization principles:

1. **Mechanism queries**: Phrase as questions about HOW and WHY
   - Good: "How does glucose availability affect thyroid hormone synthesis?"
   - Good: "What is the relationship between carbohydrate restriction and TSH production?"
   - Avoid: "glucose thyroid" (too vague)

2. **Evidence queries**: Target clinical observations and metabolic markers
   - Good: "What are the metabolic effects of chronic low-carbohydrate diets on thyroid function?"
   - Good: "How does basal body temperature correlate with thyroid hormone levels?"

3. **Technical precision**: Include key entities naturally within questions
   - Good: "How does endotoxin (LPS) impair insulin signaling through inflammatory pathways?"
   - Avoid: Generic phrases without technical terms

4. **Bioenergetic framing**: Connect to energy production, cellular metabolism, stress response
   - Good: "How does mitochondrial dysfunction contribute to chronic fatigue?"
   - Good: "What role does cortisol play in insulin resistance and metabolic dysfunction?"

Requirements:
- Generate 2-4 queries (simple patterns need fewer, complex patterns need more)
- Focus on mechanism papers (fundamental biology) and clinical evidence papers
- Target academic literature (research papers, not blog posts)
- Avoid redundancy - each query should cover a distinct angle
- Ensure comprehensive coverage of the pattern's key concepts

Goal: Maximum citation relevance with optimal query count.
`.trim();
};
