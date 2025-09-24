import { ExtractionAgentInput } from './types';

export function getExtractionPrompt(input: ExtractionAgentInput): string {
  const { url, fullText, objective } = input;
  
  return `You are analyzing content from a specific URL to extract information relevant to a research objective.

URL: ${url}

Extraction Objective: ${objective}

Content to Analyze:
${fullText}

Analyze the content and extract insights that directly address the extraction objective. Focus on identifying specific, actionable information with supporting evidence.
The goal is not to write a comprehensive report, the goal is to extract the most relevant information from the content according to the extraction objective.

As clear and concise as you can be WITHOUT leaving out important relevant insights relative the objective is critical.


`;
}


