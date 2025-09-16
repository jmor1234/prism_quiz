import Exa from 'exa-js';
import { getLogger } from '@/app/api/chat/lib/traceLogger';
import type { ExaCategory } from '../constants';
import type { ExaSearchConfig, ExaSearchHit } from './types';

// --- Start of Rate Limiter Implementation ---

class RateLimiter {
  private queue: (() => void)[] = [];
  private processing = false;
  private readonly interval: number;

  constructor(interval: number) {
    this.interval = interval;
  }

  public async execute<T>(task: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue.push(() => {
        task().then(resolve).catch(reject);
      });
      this.processNext();
    });
  }

  private processNext() {
    if (this.processing || this.queue.length === 0) {
      return;
    }
    this.processing = true;

    const task = this.queue.shift()!;
    task();

    setTimeout(() => {
      this.processing = false;
      this.processNext();
    }, this.interval);
  }
}

// 12.5 requests per second -> 80ms interval between requests (17% cushion below 15 QPS limit)
const exaRateLimiter = new RateLimiter(80);

// --- End of Rate Limiter Implementation ---

const exaApiKey = process.env.EXA_API_KEY;

if (!exaApiKey) {
  console.error('EXA_API_KEY is not set. Please set it in your environment variables.');
}

const exa = new Exa(exaApiKey);

// Options type for the Exa SDK search() call (URL-only search)
interface ExaSDKSearchOptions {
  numResults?: number;
  includeDomains?: string[];
  excludeDomains?: string[];
  startCrawlDate?: string;
  endCrawlDate?: string;
  startPublishedDate?: string;
  endPublishedDate?: string;
  useAutoprompt?: boolean;
  type?: 'keyword' | 'neural' | 'auto';
  category?: ExaCategory;
}

/**
 * Executes a search query using the Exa SDK and returns processed results (URL-only search).
 */
export async function searchExa(
  config: ExaSearchConfig,
  useAutopromptFlag: boolean
): Promise<ExaSearchHit[]> {
  const logger = getLogger();
  const toolName = 'ExaSearchClient';

  const sdkOptions: ExaSDKSearchOptions = {
    numResults: config.numResults,
    type: config.type,
    useAutoprompt: useAutopromptFlag,
  };
  if (config.category) sdkOptions.category = config.category;
  if (config.startPublishedDate) sdkOptions.startPublishedDate = config.startPublishedDate;
  if (config.endPublishedDate) sdkOptions.endPublishedDate = config.endPublishedDate;

  logger?.logToolInternalStep(toolName, 'EXA_SEARCH_API_CALL_START', {
    query: config.query,
    options: sdkOptions,
  });

  try {
    const response = await exaRateLimiter.execute(() =>
      exa.search(config.query, sdkOptions as Parameters<typeof exa.search>[1])
    );

    logger?.logToolInternalStep(toolName, 'EXA_SEARCH_API_CALL_SUCCESS', {
      query: config.query,
      resultsCount: response.results?.length || 0,
    });

    return (response.results || []).map((hit) => ({
      url: hit.url,
      title: hit.title,
      publishedDate: hit.publishedDate,
      author: hit.author,
      exaScore: hit.score,
    }));
  } catch (error: unknown) {
    logger?.logToolInternalStep(toolName, 'EXA_SEARCH_API_CALL_ERROR', {
      query: config.query,
      error: error instanceof Error ? { message: error.message, name: error.name } : String(error),
    });
    throw error;
  }
}

/**
 * Fetches the full textual content for a batch of URLs using Exa's getContents API.
 * @param urls An array of URL strings to fetch content for.
 * @returns A promise that resolves to an array of objects, each indicating success/failure and the content for a URL.
 */
export async function fetchFullTextContents(
  urls: string[]
): Promise<Array<{ url: string; fullText: string | null; success: boolean; error?: { message: string; name: string; statusCode?: number } }>> {
  const logger = getLogger();
  const toolName = 'ExaContentsClient'; // For logging

  if (!urls || urls.length === 0) {
    return [];
  }

  logger?.logToolInternalStep(toolName, 'EXA_CONTENTS_API_BATCH_START', {
    urlCount: urls.length,
    urlsToFetch: urls,
  });

  try {
    const exaResults = await exaRateLimiter.execute(() => 
      exa.getContents(urls, { text: true })
    );

    logger?.logToolInternalStep(toolName, 'EXA_CONTENTS_API_BATCH_SUCCESS', {
      requestedUrlCount: urls.length,
      receivedResultsCount: exaResults.results?.length || 0,
      sampleUrlsProcessed: exaResults.results?.slice(0,3).map(r => r.url)
    });

    const processedResults = urls.map(requestedUrl => {
      const resultForUrl = exaResults.results?.find(r => r.url === requestedUrl);
      
      if (resultForUrl) {
        const textContent = resultForUrl.text || null;
        const isSuccess = !!textContent && textContent.length > 0;
        let errorForUrl: { message: string; name: string } | undefined = undefined;

        if (!isSuccess && textContent === null) { // Only consider it an error if text was explicitly null
            errorForUrl = { message: 'No text content returned or content was null', name: 'NoContentError' };
        }

        return {
          url: requestedUrl,
          fullText: textContent,
          success: isSuccess,
          error: errorForUrl 
        };
      } else {
        return {
          url: requestedUrl,
          fullText: null,
          success: false,
          error: { message: 'URL not found in Exa batch response', name: 'ExaContentMismatchError' }
        };
      }
    });

    return processedResults;

  } catch (error: unknown) {
    logger?.logToolInternalStep(toolName, 'EXA_CONTENTS_API_BATCH_ERROR', {
      urlCount: urls.length,
      urlsAttempted: urls,
      error: error instanceof Error ? { message: error.message, name: error.name, stack: error.stack?.substring(0, 200) } : String(error),
    });
    console.error(`[${toolName}] Error calling Exa getContents API for URLs:`, urls, error);
    return urls.map(url => ({
      url,
      fullText: null,
      success: false,
      error: error instanceof Error ? { message: error.message, name: error.name, statusCode: (error as Error & { status?: number }).status } : { message: String(error), name: 'ExaBatchError' },
    }));
  }
}

/**
 * Enhanced version of fetchFullTextContents that supports crawl options.
 * @param urls An array of URL strings to fetch content for.
 * @param options Optional crawl configuration for live crawling and subpage exploration.
 * @returns A promise that resolves to an array of objects, each indicating success/failure and the content for a URL.
 */
export async function fetchFullTextContentsWithOptions(
  urls: string[],
  options?: {
    liveCrawl?: 'auto' | 'always' | 'never';
    subpages?: number;
    subpageTargets?: string[];
  }
): Promise<Array<{ url: string; fullText: string | null; success: boolean; error?: { message: string; name: string; statusCode?: number } }>> {
  const logger = getLogger();
  const toolName = 'ExaContentsClient'; // For logging

  if (!urls || urls.length === 0) {
    return [];
  }

  logger?.logToolInternalStep(toolName, 'EXA_CONTENTS_API_BATCH_START', {
    urlCount: urls.length,
    urlsToFetch: urls,
    crawlOptions: options,
  });

  try {
    // Build Exa getContents options with crawl support
    const exaOptions: Record<string, unknown> = { text: true };
    
    if (options?.liveCrawl) {
      exaOptions.livecrawl = options.liveCrawl;
    }
    
    if (options?.subpages !== undefined) {
      exaOptions.subpages = options.subpages;
    }
    
    if (options?.subpageTargets && options.subpageTargets.length > 0) {
      exaOptions.subpage_target = options.subpageTargets;
    }

    const exaResults = await exaRateLimiter.execute(() => 
      exa.getContents(urls, exaOptions)
    );

    logger?.logToolInternalStep(toolName, 'EXA_CONTENTS_API_BATCH_SUCCESS', {
      requestedUrlCount: urls.length,
      receivedResultsCount: exaResults.results?.length || 0,
      crawlOptionsUsed: options,
      sampleUrlsProcessed: exaResults.results?.slice(0,3).map(r => r.url)
    });

    const processedResults = urls.map(requestedUrl => {
      const resultForUrl = exaResults.results?.find(r => r.url === requestedUrl);
      
      if (resultForUrl) {
        const textContent = resultForUrl.text || null;
        const isSuccess = !!textContent && textContent.length > 0;
        let errorForUrl: { message: string; name: string } | undefined = undefined;

        if (!isSuccess && textContent === null) {
            errorForUrl = { message: 'No text content returned or content was null', name: 'NoContentError' };
        }

        return {
          url: requestedUrl,
          fullText: textContent,
          success: isSuccess,
          error: errorForUrl 
        };
      } else {
        return {
          url: requestedUrl,
          fullText: null,
          success: false,
          error: { message: 'URL not found in Exa batch response', name: 'ExaContentMismatchError' }
        };
      }
    });

    return processedResults;

  } catch (error: unknown) {
    logger?.logToolInternalStep(toolName, 'EXA_CONTENTS_API_BATCH_ERROR', {
      urlCount: urls.length,
      urlsAttempted: urls,
      crawlOptions: options,
      error: error instanceof Error ? { message: error.message, name: error.name, stack: error.stack?.substring(0, 200) } : String(error),
    });
    console.error(`[${toolName}] Error calling Exa getContents API with crawl options for URLs:`, urls, error);
    return urls.map(url => ({
      url,
      fullText: null,
      success: false,
      error: error instanceof Error ? { message: error.message, name: error.name, statusCode: (error as Error & { status?: number }).status } : { message: String(error), name: 'ExaBatchError' },
    }));
  }
} 


