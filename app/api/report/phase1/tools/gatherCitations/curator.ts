// app/api/report/phase1/tools/gatherCitations/curator.ts

import { google } from "@ai-sdk/google";
import { generateObject } from "ai";
import { z } from "zod";
import { withRetry } from "@/app/api/chat/lib/llmRetry";
import { getPhaseTimeoutMs } from "@/app/api/chat/lib/retryConfig";
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
  subsubsection: string;
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
  const { subsection, subsubsection, topics, citations, targetCount } = input;

  console.log(`      → Curator sub-agent: selecting up to ${targetCount} from ${citations.length} citations...`);

  const prompt = `
<subsection>
${subsection}
</subsection>

<pattern>
${subsubsection}
</pattern>

<topics_discussed>
${topics.join('\n')}
</topics_discussed>

<available_citations>
${JSON.stringify(citations, null, 2)}
</available_citations>

Select up to ${targetCount} most relevant citations for this pattern based on the topics discussed.
`.trim();

  const response = await withRetry(
    (signal) =>
      generateObject({
        model: google(CURATION_MODEL),
        schema: curatorOutputSchema,
        prompt,
        abortSignal: signal,
      }),
    {
      phase: "citationCuration",
      timeoutMs: getPhaseTimeoutMs("citationCuration"),
    }
  );

  console.log(`      ✓ Curator selected ${response.object.selectedCitations.length} citations`);

  return response.object.selectedCitations;
}
