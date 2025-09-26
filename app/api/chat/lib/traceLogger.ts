// app/api/chat/lib/traceLogger.ts

import fs from 'fs/promises';
import path from 'path';
import { AsyncLocalStorage } from 'async_hooks';
import { randomBytes } from 'crypto';

// Define the structure for a log step (adjust as needed based on the JSON example)
interface LogStep {
    stepIndex: number;
    timestamp: string;
    type: string;
    toolName?: string;
    inputArguments?: unknown;
    output?: unknown;
    stage?: string; // For internal tool steps
    data?: unknown;     // For internal tool steps
    error?: unknown;
}

// Define the structure for the final log file
interface TraceLog {
    requestId: string;
    requestTimestamp: string;
    initialMessages: unknown[];
    steps: LogStep[];
    finalResponse?: {
        text: string;
        finishReason?: string;
        usage?: unknown;
    };
    requestEndTime?: string;
    totalDurationSeconds?: number;
    error?: unknown;
    sectionLogFiles?: string[]; // Added to list section log files
    retryMetrics?: Record<string, { attempts?: number; retries?: number; timeouts?: number; maxAttemptsExhausted?: number }>; // Aggregated retry stats
}

// Interface for a typical message structure with parts
interface MessagePart {
    type: string;
    text?: string;
    reasoning?: string; // Added for reasoning part
    details?: Array<MessagePart>; // Added for reasoning part details
    [key: string]: unknown; // Use unknown instead of any
}

interface MessageWithParts {
    role: string;
    content: string;
    parts?: Array<MessagePart>; // Use the specific part type
    [key: string]: unknown; // Use unknown instead of any
}

// Create AsyncLocalStorage instance to hold the logger for the current request context
const asyncLocalStorage = new AsyncLocalStorage<TraceLogger>();

// Helper function to get the logger instance for the current async context
export function getLogger(): TraceLogger | undefined {
    return asyncLocalStorage.getStore();
}

// Default section name
const DEFAULT_SECTION_NAME = 'primary_agent_flow';

// Ensure logs directory exists
const logsDir = path.join(process.cwd(), 'logs');
fs.mkdir(logsDir, { recursive: true }).catch(console.error); // Create logs directory if it doesn't exist

// Helper function to clean redundant parts from messages
function cleanMessageObject(message: MessageWithParts): object {
    const cleanedMessage = { ...message };

    if (cleanedMessage.parts) {
        // 1. Filter out text parts duplicating top-level content
        let filteredParts = cleanedMessage.parts.filter(part => 
            !(part.type === 'text' && part.text === cleanedMessage.content)
        );

        // 2. Clean reasoning parts
        filteredParts = filteredParts.map(part => {
            if (part.type === 'reasoning' &&
                part.reasoning && 
                part.details &&
                part.details.length === 1 &&
                part.details[0].type === 'text' &&
                part.details[0].text === part.reasoning) {
                
                // Create a new part object without the details array manually
                const cleanedPart = { ...part };
                delete cleanedPart.details;
                return cleanedPart;
            }
            return part; // Return unmodified part
        });

        // 3. Update or remove the parts array on the cleaned message
        if (filteredParts.length > 0) {
            cleanedMessage.parts = filteredParts;
        } else {
            delete cleanedMessage.parts;
        }
    }

    return cleanedMessage;
}

export class TraceLogger {
    private _requestId: string;
    private isEnabled: boolean = false;
    private stepCounter: number = 0;
    private startTime: number;
    private overviewLogData: Partial<TraceLog> = {};

    // Store an array of step arrays for each section to handle parallel executions
    private sectionLogEntries: Map<string, LogStep[][]> = new Map();
    private currentSectionName: string = DEFAULT_SECTION_NAME;
    private currentExecutionIndex?: number;

    private sectionLogFileNames: Set<string> = new Set();

    // Aggregated retry metrics per logical phase (e.g., 'sqa', 'contentAnalysis')
    private retryMetrics: Record<string, { attempts?: number; retries?: number; timeouts?: number; maxAttemptsExhausted?: number }> = {};

    // Stream writer for progress updates
    private streamWriter?: {
        write: (data: unknown) => void;
    };

    constructor(requestId?: string) {
        this._requestId = requestId || `req_${Date.now()}_${randomBytes(4).toString('hex')}`;
        this.startTime = Date.now();
        this.overviewLogData.requestId = this._requestId;
        this.overviewLogData.requestTimestamp = new Date(this.startTime).toISOString();
        // Initialize the default section
        this.sectionLogEntries.set(DEFAULT_SECTION_NAME, [[]]);
        this.sectionLogFileNames.add(`trace_${this._requestId}_${DEFAULT_SECTION_NAME}.json`);
    }

    get requestId(): string {
        return this._requestId;
    }

    setEnabled(enabled: boolean): void {
        this.isEnabled = enabled;
    }

    get isLoggerEnabled(): boolean {
        return this.isEnabled;
    }

    logInitialMessages(messages: unknown[]): void {
        if (!this.isEnabled) return;
        // Apply cleanup to each message before storing
        this.overviewLogData.initialMessages = messages.map(msg => 
            cleanMessageObject(msg as MessageWithParts)
        );
    }

    public startLogSection(sectionName: string, executionIndex?: number): void {
        if (!this.isEnabled) return;
    
        this.currentSectionName = sectionName;
        this.currentExecutionIndex = executionIndex;
    
        if (!this.sectionLogEntries.has(sectionName)) {
            this.sectionLogEntries.set(sectionName, []);
            const sectionFileName = `trace_${this._requestId}_${sectionName}.json`;
            this.sectionLogFileNames.add(sectionFileName);
        }

        // Ensure the array for the specific execution index is initialized
        const executions = this.sectionLogEntries.get(sectionName);
        if (executions) {
            const index = executionIndex ?? 0;
            if (!executions[index]) {
                executions[index] = [];
            }
        }
    }

    private addStep(stepDetails: Omit<LogStep, 'stepIndex' | 'timestamp'>): void {
        if (!this.isEnabled) return;
        this.stepCounter++;
        const step: LogStep = {
            stepIndex: this.stepCounter,
            timestamp: new Date().toISOString(),
            ...stepDetails,
        };

        const executions = this.sectionLogEntries.get(this.currentSectionName);
        if (executions) {
            const index = this.currentExecutionIndex ?? 0;
            // Ensure the specific execution array exists before pushing
            if (!executions[index]) {
                executions[index] = [];
            }
            executions[index].push(step);
        } else {
            console.error(`[TraceLogger] Error: Attempted to log to uninitialized section '${this.currentSectionName}'. Step details:`, stepDetails);
        }
    }

    logToolCallStart(toolName: string, inputArguments: unknown): void {
        this.addStep({ type: 'TOOL_CALL_START', toolName, inputArguments });
    }

    logToolInternalStep(toolName: string, stage: string, data: unknown): void {
        this.addStep({ type: 'TOOL_INTERNAL_STEP', toolName, stage, data });
    }

    logToolCallEnd(toolName: string, output: unknown, error?: unknown): void {
        const stepData: Partial<LogStep> = { type: 'TOOL_CALL_END', toolName, output };
        if (error) {
             stepData.error = error instanceof Error ? { message: error.message, name: error.name, stack: error.stack } : error;
        }
        this.addStep(stepData as Omit<LogStep, 'stepIndex' | 'timestamp'>);
    }

    // Retry metrics aggregation (minimal API)
    incrementRetryStat(phase: string, stat: 'attempts' | 'retries' | 'timeouts' | 'maxAttemptsExhausted'): void {
        if (!this.isEnabled) return;
        const entry = (this.retryMetrics[phase] ||= {});
        entry[stat] = (entry[stat] ?? 0) + 1;
    }

    // Specific log method for the mandatory planning step via thinkTool
    logAgentPlanning(thought: string): void {
        // This captures the *input* to the thinkTool, representing the agent's plan
         this.addStep({
            type: 'AGENT_PLANNING',
            toolName: 'thinkTool', // Explicitly mark as thinkTool's input
            inputArguments: { thought }
        });
         // We might also want to log the thinkTool's *output* via logToolCallEnd if needed,
         // but the primary value is logging the plan itself.
    }

    logAgentSynthesisStart(): void {
        this.addStep({ type: 'AGENT_SYNTHESIS_START' });
    }

    logFinalResponse(response: { text: string; finishReason?: string; usage?: unknown }): void {
        if (!this.isEnabled) return;
        this.overviewLogData.finalResponse = response;
    }

    // Stream writer methods for progress updates
    setStreamWriter(writer: { write: (data: unknown) => void }): void {
        this.streamWriter = writer;
    }

    // Emit research session progress
    emitSessionProgress(data: {
        status: 'starting' | 'active' | 'complete' | 'error';
        totalObjectives: number;
        completedObjectives: number;
        error?: string;
    }): void {
        if (!this.streamWriter) return;
        this.streamWriter.write({
            type: 'data-research-session',
            id: 'current-session',
            data: {
                ...data,
                startTime: this.startTime,
            },
        });
    }

    // Emit individual objective progress
    emitObjectiveProgress(objectiveId: string, data: {
        objective: string;
        status: 'pending' | 'active' | 'complete' | 'failed';
        phase?: string;
        progress: number;
        sourcesFound?: number;
        sourcesAnalyzed?: number;
        focusAreas?: string[];
        keyEntities?: string[];
        categories?: string[];
        error?: string;
    }): void {
        if (!this.streamWriter) return;
        this.streamWriter.write({
            type: 'data-research-objective',
            id: objectiveId,
            data: {
                ...data,
                startTime: Date.now(),
            },
        });
    }

    // Emit phase progress
    emitPhaseProgress(phaseId: string, data: {
        objective: string;
        phase: string;
        status: 'starting' | 'active' | 'complete' | 'error';
        progress: number;
        details?: {
            current?: number;
            total?: number;
            description?: string;
            samples?: { url: string; title?: string; domain?: string }[];
        };
    }): void {
        if (!this.streamWriter) return;
        this.streamWriter.write({
            type: 'data-research-phase',
            id: phaseId,
            data: {
                ...data,
                startTime: Date.now(),
            },
        });
    }

    // Emit transient operation updates
    emitOperation(message: string, metadata?: { phase?: string; objective?: string }): void {
        if (!this.streamWriter) return;
        this.streamWriter.write({
            type: 'data-research-operation',
            data: {
                message,
                ...metadata,
                timestamp: Date.now(),
            },
            transient: true,
        });
    }

    // Emit search progress
    emitSearchProgress(data: {
        query: string;
        objective: string;
        completed: number;
        total: number;
        resultsFound?: number;
    }): void {
        if (!this.streamWriter) return;
        this.streamWriter.write({
            type: 'data-search-progress',
            data,
            transient: true,
        });
    }

    // Emit optional search summary snapshot
    emitSearchSummary(data: { queries: number; hits: number; unique: number }): void {
        if (!this.streamWriter) return;
        this.streamWriter.write({
            type: 'data-research-operation',
            data: {
                message: `Searching: ${data.queries} queries → ${data.hits} hits → ${data.unique} unique`,
                phase: 'searching',
                timestamp: Date.now(),
            },
            transient: true,
        });
    }

    // Emit error notifications
    emitError(message: string, metadata?: {
        phase?: string;
        objective?: string;
        retryable?: boolean;
        retryIn?: number;
    }): void {
        if (!this.streamWriter) return;
        this.streamWriter.write({
            type: 'data-research-error',
            data: {
                message,
                retryable: metadata?.retryable ?? false,
                ...metadata,
                timestamp: Date.now(),
            },
            transient: true,
        });
    }

    // Emit simple tool status (for think, memory tools)
    emitToolStatus(data: {
        toolName: 'thinkTool' | 'researchMemoryTool';
        action: string;
    }): void {
        if (!this.streamWriter) return;
        this.streamWriter.write({
            type: 'data-tool-status',
            data: {
                ...data,
                timestamp: Date.now(),
            },
            transient: true,
        });
    }

    // Emit context warning for persistent token tracking
    emitContextWarning(data: {
        level: 'notice' | 'warning' | 'critical';
        persistentTokens: number;
        message: string;
    }): void {
        if (!this.streamWriter) return;
        this.streamWriter.write({
            type: 'data-context-warning',
            data: {
                ...data,
                timestamp: Date.now(),
            }
        });
    }

    // Emit extraction session progress
    emitExtractionSession(data: {
        status: 'starting' | 'active' | 'complete' | 'error';
        totalUrls: number;
        completedUrls: number;
        error?: string;
    }): void {
        if (!this.streamWriter) return;
        this.streamWriter.write({
            type: 'data-extraction-session',
            id: 'current-extraction',
            data: {
                ...data,
                startTime: this.startTime,
            },
        });
    }

    // Emit individual URL extraction progress
    emitExtractionUrl(urlId: string, data: {
        url: string;
        status: 'pending' | 'retrieving' | 'extracting' | 'complete' | 'failed';
        phase?: 'retrieval' | 'extraction';
        progress: number;
        error?: string;
    }): void {
        if (!this.streamWriter) return;
        this.streamWriter.write({
            type: 'data-extraction-url',
            id: urlId,
            data,
        });
    }

    // Emit large collection updates (search hits, deduped urls, etc.)
    emitCollectionUpdate(collectionId: string, data: {
        kind: 'search_hits' | 'unique_urls' | 'retrieved' | 'high_signal' | 'analyzed' | 'consolidated' | 'citations';
        action: 'replace' | 'append';
        total?: number;
        items: { url: string; title?: string; domain?: string }[];
    }): void {
        if (!this.streamWriter) return;
        this.streamWriter.write({
            type: 'data-research-collection',
            id: collectionId,
            data,
        });
    }

    // Emit curated sources for the Sources tab
    emitSources(objectiveId: string | undefined, data: {
        items: { url: string; title?: string; domain?: string }[];
    }): void {
        if (!this.streamWriter) return;
        this.streamWriter.write({
            type: 'data-research-sources',
            id: objectiveId ?? 'session-sources',
            data: {
                objectiveId,
                ...data,
            },
        });
    }

    // emitClaimSpans removed to reduce token usage

    async finalizeAndWriteLog(finalError?: unknown): Promise<void> {
        if (!this.isEnabled) return;

        const endTime = Date.now();
        this.overviewLogData.requestEndTime = new Date(endTime).toISOString();
        this.overviewLogData.totalDurationSeconds = (endTime - this.startTime) / 1000;
        
        if (finalError) {
             this.overviewLogData.error = finalError instanceof Error ? { message: finalError.message, name: finalError.name, stack: finalError.stack } : finalError;
        } else {
            this.overviewLogData.error = null;
        }
        
        const writtenSectionFiles: string[] = [];

        // Write Section Logs with consolidation logic
        for (const [sectionName, executions] of this.sectionLogEntries.entries()) {
            const validExecutions = executions.filter(steps => steps && steps.length > 0);

            if (validExecutions.length === 0) {
                // Do not write a log file for a section that had no activity.
                continue;
            }

            const sectionLogFilePath = path.join(logsDir, `trace_${this._requestId}_${sectionName}.json`);
            writtenSectionFiles.push(`trace_${this._requestId}_${sectionName}.json`);

            let sectionLogContent: object;

            if (validExecutions.length > 1) {
                // Parallel execution format
                const parallelExecutions: Record<string, { steps: LogStep[] }> = {};
                executions.forEach((steps, index) => {
                    if (steps && steps.length > 0) {
                        parallelExecutions[index] = { steps };
                    }
                });

                sectionLogContent = {
                    requestId: this._requestId,
                    requestTimestamp: this.overviewLogData.requestTimestamp,
                    sectionName: sectionName,
                    parallelExecutions,
                };
            } else {
                // Standard sequential format
                sectionLogContent = {
                    requestId: this._requestId,
                    requestTimestamp: this.overviewLogData.requestTimestamp,
                    sectionName: sectionName,
                    steps: validExecutions[0],
                };
            }

            try {
                await fs.writeFile(sectionLogFilePath, JSON.stringify(sectionLogContent, null, 2));
                console.log(`[TraceLogger] Section log file written to: ${sectionLogFilePath}`);
            } catch (err) {
                console.error(`[TraceLogger] Error writing section log file ${sectionLogFilePath}:`, err);
            }
        }

        // Finalize the list of written files for the overview log
        this.overviewLogData.sectionLogFiles = writtenSectionFiles.sort();
        // Attach aggregated retry metrics (if any)
        if (Object.keys(this.retryMetrics).length > 0) {
            (this.overviewLogData as TraceLog).retryMetrics = this.retryMetrics;
            // Console summary (minimal)
            console.log(`\n====================== RETRY METRICS =======================`);
            for (const [phase, m] of Object.entries(this.retryMetrics)) {
                const attempts = m.attempts ?? 0;
                const retries = m.retries ?? 0;
                const timeouts = m.timeouts ?? 0;
                const exhausted = m.maxAttemptsExhausted ?? 0;
                console.log(`${phase}: attempts=${attempts}, retries=${retries}, timeouts=${timeouts}, max_exhausted=${exhausted}`);
            }
            console.log(`===========================================================`);
        }
        
        // Write Overview Log
        const overviewLogFilePath = path.join(logsDir, `trace_${this._requestId}_overview.json`);
        try {
            await fs.writeFile(overviewLogFilePath, JSON.stringify(this.overviewLogData, null, 2));
            console.log(`[TraceLogger] Overview log file written to: ${overviewLogFilePath}`);
        } catch (err) {
            console.error(`[TraceLogger] Error writing overview log file ${overviewLogFilePath}:`, err);
        }
    }
}

// Export the necessary components
export { asyncLocalStorage }; 
