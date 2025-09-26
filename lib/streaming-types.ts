// lib/streaming-types.ts
// Type definitions for research streaming data parts

import type { UIMessage } from 'ai';

// Research session overview (persistent)
export interface ResearchSessionData {
  status: 'starting' | 'active' | 'complete' | 'error';
  totalObjectives: number;
  completedObjectives: number;
  startTime: number;
  error?: string;
}

// Individual research objective progress (persistent, reconciled)
export interface ResearchObjectiveData {
  objective: string;
  status: 'pending' | 'active' | 'complete' | 'failed';
  phase?: 'query-generation' | 'searching' | 'deduplicating' | 'analyzing' | 'consolidating' | 'synthesizing';
  progress: number; // 0-1
  sourcesFound?: number;
  sourcesAnalyzed?: number;
  startTime: number;
  endTime?: number;
  error?: string;
  // Optional enriched plan context for display
  focusAreas?: string[];
  keyEntities?: string[];
  categories?: string[];
}

// Research phase progress (persistent, reconciled)
export interface ResearchPhaseData {
  objective: string;
  phase: string;
  status: 'starting' | 'active' | 'complete' | 'error';
  progress: number;
  details?: {
    // Generic counters
    current?: number;
    total?: number;
    description?: string;
    samples?: { url: string; title?: string; domain?: string }[];
    summary?: { queries: number; hits?: number; unique?: number };
    // New, optional fine-grained progress fields for narrative UI
    queries?: string[]; // small set of representative search queries
    subphase?: 'retrieval' | 'sqa' | 'analysis' | 'consolidation';
    metrics?: {
      fetched?: { ok: number; total: number };
      highSignal?: { ok: number; total: number };
      analyzed?: { current: number; total: number };
      consolidated?: { current: number; total: number };
    };
  };
  startTime: number;
  endTime?: number;
}

// Operational status updates (transient)
export interface ResearchOperationData {
  message: string;
  phase?: string;
  objective?: string;
  timestamp: number;
}

// Search progress updates (transient)
export interface SearchProgressData {
  query: string;
  objective: string;
  completed: number;
  total: number;
  resultsFound?: number;
}

// Optional summary snapshots for compact UI chips
export interface SearchSummaryData {
  queries: number;
  hits: number;
  unique: number;
}

// Error notifications (transient)
export interface ResearchErrorData {
  message: string;
  phase?: string;
  objective?: string;
  retryable: boolean;
  retryIn?: number;
  timestamp: number;
}

// Simple tool status (transient) - for think, memory tools
export interface ToolStatusData {
  toolName: 'thinkTool' | 'researchMemoryTool';
  action: string; // "Thinking about research strategy..." or "Recording research note..."
  timestamp: number;
}

// Context warning for persistent token tracking
export interface ContextWarningData {
  level: 'notice' | 'warning' | 'critical';
  persistentTokens: number;
  message: string;
  timestamp: number;
}

// Extraction session overview (persistent)
export interface ExtractionSessionData {
  status: 'starting' | 'active' | 'complete' | 'error';
  totalUrls: number;
  completedUrls: number;
  startTime: number;
  error?: string;
}

// Individual URL extraction progress (persistent, reconciled)
export interface ExtractionUrlData {
  url: string;
  status: 'pending' | 'retrieving' | 'extracting' | 'complete' | 'failed';
  phase?: 'retrieval' | 'extraction';
  progress: number; // 0-1
  error?: string;
}

// Streamed list updates for large collections (search hits, deduped URLs, etc.)
export type ResearchCollectionKind =
  | 'search_hits'
  | 'unique_urls'
  | 'retrieved'
  | 'high_signal'
  | 'analyzed'
  | 'consolidated'
  | 'citations';

export interface ResearchCollectionData {
  kind: ResearchCollectionKind;
  action: 'replace' | 'append';
  total?: number;
  items: { url: string; title?: string; domain?: string }[];
}

// Curated sources for the Sources tab (can evolve across phases)
export interface ResearchSourcesData {
  objectiveId?: string;
  items: { url: string; title?: string; domain?: string }[];
}

// Claim spans for precise inline citations (backend-provided)
// Claim spans removed to reduce token usage; inline citations in final Markdown are authoritative

// Type-safe UIMessage with research data parts
export type ResearchUIMessage = UIMessage<
  never, // metadata type
  {
    'research-session': ResearchSessionData;
    'research-objective': ResearchObjectiveData;
    'research-phase': ResearchPhaseData;
    'research-operation': ResearchOperationData;
    'search-progress': SearchProgressData;
    'research-error': ResearchErrorData;
    'tool-status': ToolStatusData;
    'context-warning': ContextWarningData;
    'extraction-session': ExtractionSessionData;
    'extraction-url': ExtractionUrlData;
    'research-collection': ResearchCollectionData;
    'research-sources': ResearchSourcesData;
  }
>;

// Helper type for discriminated unions in onData callback
export type ResearchDataPart =
  | { type: 'data-research-session'; data: ResearchSessionData; id?: string }
  | { type: 'data-research-objective'; data: ResearchObjectiveData; id: string }
  | { type: 'data-research-phase'; data: ResearchPhaseData; id: string }
  | { type: 'data-research-operation'; data: ResearchOperationData; transient: true }
  | { type: 'data-search-progress'; data: SearchProgressData; transient: true }
  | { type: 'data-research-error'; data: ResearchErrorData; transient: true }
  | { type: 'data-tool-status'; data: ToolStatusData; transient: true }
  | { type: 'data-context-warning'; data: ContextWarningData }
  | { type: 'data-extraction-session'; data: ExtractionSessionData; id?: string }
  | { type: 'data-extraction-url'; data: ExtractionUrlData; id: string }
  | { type: 'data-research-collection'; data: ResearchCollectionData; id: string }
  | { type: 'data-research-sources'; data: ResearchSourcesData; id?: string };

// Research state for frontend
export interface ResearchState {
  session: ResearchSessionData | null;
  objectives: Record<string, ResearchObjectiveData>;
  phases: Record<string, ResearchPhaseData>;
  currentOperation: ResearchOperationData | null;
  searchProgress: SearchProgressData | null;
  lastError: ResearchErrorData | null;
  // New states for other tools
  currentToolStatus: ToolStatusData | null;
  extractionSession: ExtractionSessionData | null;
  extractionUrls: Record<string, ExtractionUrlData>;
  // Collections and curated sources for richer UI
  collections?: Record<string, { kind: ResearchCollectionKind; total?: number; items: { url: string; title?: string; domain?: string }[] }>;
  sourcesByObjective?: Record<string, { items: { url: string; title?: string; domain?: string }[] }>;
  // claimSpansByObjective removed
  // Note: contextWarning is handled as local component state in thread-chat.tsx, not in this global state
}