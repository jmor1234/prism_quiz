import { generateObject } from 'ai';
import { google } from "@ai-sdk/google";
import { getLogger } from '@/app/api/chat/lib/traceLogger';
import { ExtractionAgentInput, ExtractionAgentOutput } from './types';
import { extractionOutputSchema } from './schema';
import { getExtractionPrompt } from './prompt';
import { AGENT_NAME, EXTRACTION_MODEL } from '../constants';

export async function extractFromDocument(
  input: ExtractionAgentInput
): Promise<ExtractionAgentOutput> {
  const logger = getLogger();
  
  // Log extraction agent start with detailed input
  logger?.logToolCallStart(AGENT_NAME, {
    url: input.url,
    objective: input.objective,
    contentLength: input.fullText.length,
    contentSizeKb: Math.round(input.fullText.length / 1000)
  });

  logger?.logToolInternalStep(AGENT_NAME, 'PREPARING_EXTRACTION', {
    url: input.url,
    objective: input.objective,
    model: EXTRACTION_MODEL,
    contentPreview: input.fullText.substring(0, 200) + '...'
  });

  console.log(`     🤖 Analyzing content with ${EXTRACTION_MODEL}...`);
  console.log(`        - Content size: ${Math.round(input.fullText.length / 1000)}k characters`);
  console.log(`        - Objective: "${input.objective.substring(0, 60)}${input.objective.length > 60 ? '...' : ''}"`);

  const prompt = getExtractionPrompt(input);

  let error: unknown = null;
  let result: ExtractionAgentOutput | null = null;

  try {
    logger?.logToolInternalStep(AGENT_NAME, 'CALLING_LLM', {
      model: EXTRACTION_MODEL,
      promptLength: prompt.length
    });
    
    const { object: extractedData, usage } = await generateObject({
      model: google(EXTRACTION_MODEL),
      schema: extractionOutputSchema,
      prompt: prompt,
    });

    // Log detailed extraction results
    logger?.logToolInternalStep(AGENT_NAME, 'EXTRACTION_SUCCESS', {
      url: input.url,
      findingsCount: extractedData.findings.length,
      hasAdditionalContext: !!extractedData.additionalContext,
      summaryLength: extractedData.summary.length,
      usage: {
        inputTokens: usage?.inputTokens,
        outputTokens: usage?.outputTokens,
        totalTokens: usage?.totalTokens
      },
      topFindings: extractedData.findings.slice(0, 2).map(f => ({
        insight: f.insight.substring(0, 100),
        evidenceLength: f.evidence.length,
        relevance: f.relevance
      }))
    });

    console.log(`        ✓ Extraction complete:`);
    console.log(`          - ${extractedData.findings.length} findings extracted`);
    if (extractedData.findings.length > 0) {
      console.log(`          - Relevance scores: ${extractedData.findings.map(f => f.relevance).join(', ')}`);
    }
    if (extractedData.additionalContext) {
      console.log(`          - Additional context captured`);
    }
    
    result = extractedData as ExtractionAgentOutput;
    return extractedData as ExtractionAgentOutput;

  } catch (e) {
    error = e;
    
    // Log detailed error information
    logger?.logToolInternalStep(AGENT_NAME, 'EXTRACTION_ERROR', {
      url: input.url,
      error: e instanceof Error ? {
        message: e.message,
        name: e.name,
        stack: e.stack?.substring(0, 500)
      } : String(e)
    });
    
    console.error(`        ❌ Extraction failed:`, e instanceof Error ? e.message : e);
    
    throw e;
  } finally {
    logger?.logToolCallEnd(AGENT_NAME, result, error);
  }
}


