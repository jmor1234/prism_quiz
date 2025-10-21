// app/api/report/phase1/tools/gatherCitations/curator.ts

import { google } from "@ai-sdk/google";
import { generateObject } from "ai";
import { z } from "zod";
import { CURATION_MODEL } from "./constants";

const curatorOutputSchema = z.object({
  selectedCitations: z
    .array(
      z.object({
        title: z.string().describe("Paper title"),
        author: z.string().optional().describe("Author(s) if available"),
        publishedDate: z
          .string()
          .optional()
          .describe("Publication date if available"),
        url: z.string().describe("Full URL to the paper"),
      })
    )
    .describe("Most relevant citations for this subsection based on topics discussed"),
});

interface CuratorInput {
  subsection: string;
  topics: string[];
  citations: Array<{
    title: string;
    author?: string;
    publishedDate?: string;
    url: string;
  }>;
  targetCount: number;
}

export async function curateCitations(
  input: CuratorInput
): Promise<Array<{
  title: string;
  author?: string;
  publishedDate?: string;
  url: string;
}>> {
  const { subsection, topics, citations, targetCount } = input;

  const prompt = `
<subsection>
${subsection}
</subsection>

<topics_discussed>
${topics.join('\n')}
</topics_discussed>

<available_citations>
${JSON.stringify(citations, null, 2)}
</available_citations>

Select the ${targetCount} most relevant citations for this subsection based on the topics discussed.
`.trim();

  const result = await generateObject({
    model: google(CURATION_MODEL),
    schema: curatorOutputSchema,
    prompt,
  });

  return result.object.selectedCitations;
}
