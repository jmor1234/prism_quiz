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
}

// Research phase progress (persistent, reconciled)
export interface ResearchPhaseData {
  objective: string;
  phase: string;
  status: 'starting' | 'active' | 'complete' | 'error';
  progress: number;
  details?: {
    current?: number;
    total?: number;
    description?: string;
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
    'extraction-session': ExtractionSessionData;
    'extraction-url': ExtractionUrlData;
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
  | { type: 'data-extraction-session'; data: ExtractionSessionData; id?: string }
  | { type: 'data-extraction-url'; data: ExtractionUrlData; id: string };

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
}