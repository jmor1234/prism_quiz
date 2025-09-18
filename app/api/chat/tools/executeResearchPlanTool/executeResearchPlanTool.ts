import { z } from "zod";
import { tool } from "@ai-sdk/provider-utils";
import { getLogger } from "@/app/api/chat/lib/traceLogger";
import { orchestrateResearchExecution, ResearchExecutionResult } from "@/app/api/chat/tools/researchOrchestratorTool/researchOrchestrator";
import { EXA_CATEGORIES } from "@/app/api/chat/tools/researchOrchestratorTool/constants";
import type { ResearchPlan } from "../researchOrchestratorTool/researchStrategy/schema";

interface ResearchPlanResult {
  report: string;
}

const TOOL_NAME = "executeResearchPlanTool" as const;

const researchObjectiveSchema = z.object({
  focusedObjective: z
    .string()
    .describe(
      "Clear, focused statement of the specific research objective for this iteration"
    ),
  focusAreas: z
    .array(z.string())
    .describe(
      "Specific aspects or questions to investigate for this focused objective"
    ),
  keyEntities: z
    .array(z.string())
    .describe(
      "Important entities, concepts, or terms central to this research objective"
    ),
  recommendedCategories: z
    .array(z.string())
    .describe(
      "Exa content categories most relevant to this research objective"
    ),
  rationale: z
    .string()
    .describe(
      "Brief explanation of why this specific objective will advance the overall research"
    ),
  timeConstraints: z
    .object({
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      recencyRequired: z.enum(["high", "medium", "low"]).default("medium"),
    })
    .optional()
    .describe("Temporal constraints for the research if applicable"),
});

export const executeResearchPlanTool = tool({
  description:
    "Primary knowledge retrieval and synthesis system. Retrieves and processes information about specified topics, building understanding through focused objectives. Executes multiple independent objectives in parallel for efficiency.",
  inputSchema: z.object({
    researchPlan: z
      .array(researchObjectiveSchema)
      .min(1)
      .describe(
        "An array of one or more research objectives. If multiple objectives are provided, they will be executed in parallel to improve efficiency. For sequential tasks, provide an array with a single objective."
      ),
  }),
  execute: async ({ researchPlan }: { researchPlan: z.infer<typeof researchObjectiveSchema>[] }) => {
    const logger = getLogger();
    logger?.logToolCallStart(TOOL_NAME, { planSize: researchPlan.length });

    // Emit session starting status
    logger?.emitSessionProgress({
      status: 'starting',
      totalObjectives: researchPlan.length,
      completedObjectives: 0,
    });

    const currentDate = new Date();
    const formattedDate = currentDate.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    console.log(`\n### Executing ${TOOL_NAME} with ${researchPlan.length} objective(s) ###`);
    if (researchPlan.length > 1) {
      console.log(`   -> Objectives will be executed in parallel.`);
    }

    let finalReport = "";
    const failedObjectives: { objective: string; error: string }[] = [];
    let error: unknown = null;
    let completedCount = 0;

    try {
      // Emit initial objective statuses
      researchPlan.forEach((objective, index) => {
        const objectiveId = `objective-${index}`;
        logger?.emitObjectiveProgress(objectiveId, {
          objective: objective.focusedObjective,
          status: 'pending',
          progress: 0,
        });
      });
      const researchPromises = researchPlan.map((objective, index) => {
        const objectiveId = `objective-${index}`;
        const singleResearchPlan: ResearchPlan = {
          focusedObjective: objective.focusedObjective,
          focusAreas: objective.focusAreas,
          keyEntities: objective.keyEntities,
          recommendedCategories: (objective.recommendedCategories as (typeof EXA_CATEGORIES)[number][]) || [],
          rationale: objective.rationale,
          timeContext: objective.timeConstraints,
        };

        console.log(
          `  [Objective ${index + 1}/${researchPlan.length}] Starting: "${objective.focusedObjective.substring(0, 100)}..."`
        );
        logger?.logToolInternalStep(TOOL_NAME, `START_PARALLEL_OBJECTIVE_${index}`, {
          objective: objective.focusedObjective,
        });

        // Emit objective starting status
        logger?.emitObjectiveProgress(objectiveId, {
          objective: objective.focusedObjective,
          status: 'active',
          progress: 0.1,
        });

        // Update session to active
        logger?.emitSessionProgress({
          status: 'active',
          totalObjectives: researchPlan.length,
          completedObjectives: completedCount,
        });

        return orchestrateResearchExecution(singleResearchPlan, formattedDate, index, objectiveId);
      });

      const results = await Promise.allSettled(researchPromises);

      console.log(`\n### ${TOOL_NAME} - All objectives completed. Consolidating reports. ###`);

      const reportParts: string[] = [];

      results.forEach((result, index) => {
        const objective = researchPlan[index].focusedObjective;
        const objectiveId = `objective-${index}`;

        if (result.status === "fulfilled") {
          const value = result.value as ResearchExecutionResult;
          const report = value.finalSynthesisReport.finalDocument;

          reportParts.push(`## Research Report for Objective: "${objective}"\n\n${report}`);

          // Emit objective completion
          completedCount++;
          logger?.emitObjectiveProgress(objectiveId, {
            objective: objective,
            status: 'complete',
            progress: 1,
          });

          console.log(
            `  ✅ Report for objective "${objective.substring(0, 50)}..." is ${report.length} chars.`
          );
          logger?.logToolInternalStep(TOOL_NAME, `CONSOLIDATE_REPORT_${index}`, {
            objective: objective,
            reportLength: report.length,
            status: "success",
          });
        } else {
          const errorMessage =
            result.reason instanceof Error ? result.reason.message : String(result.reason);
          failedObjectives.push({ objective, error: errorMessage });

          // Emit objective failure
          logger?.emitObjectiveProgress(objectiveId, {
            objective: objective,
            status: 'failed',
            progress: 0,
            error: errorMessage,
          });

          console.log(
            `  ❌ Failed objective "${objective.substring(0, 50)}...": ${errorMessage}`
          );
          logger?.logToolInternalStep(TOOL_NAME, `CONSOLIDATE_REPORT_${index}`, {
            objective: objective,
            error: errorMessage,
            status: "failed",
          });
        }

        // Update session progress
        logger?.emitSessionProgress({
          status: 'active',
          totalObjectives: researchPlan.length,
          completedObjectives: completedCount,
        });
      });

      if (reportParts.length > 0) {
        finalReport = reportParts.join("\n\n---\n\n");
      }

      if (failedObjectives.length > 0) {
        const failedSummary = failedObjectives
          .map(({ objective, error }) => `- **"${objective}"**: ${error}`)
          .join("\n");

        const failedSection = `## Failed Research Objectives\n\nThe following objectives could not be completed:\n\n${failedSummary}`;

        finalReport = finalReport ? `${finalReport}\n\n---\n\n${failedSection}` : failedSection;
      }

      if (reportParts.length === 0 && failedObjectives.length > 0) {
        finalReport = `## Research Plan Execution Summary\n\nAll research objectives failed. Please review the errors above and consider refining your search criteria.\n\n${finalReport}`;
      }

      console.log(
        `[${TOOL_NAME}] Consolidation complete. Successful: ${researchPlan.length - failedObjectives.length}, Failed: ${failedObjectives.length}`
      );

      // Emit final session status
      logger?.emitSessionProgress({
        status: failedObjectives.length === researchPlan.length ? 'error' : 'complete',
        totalObjectives: researchPlan.length,
        completedObjectives: completedCount,
        error: failedObjectives.length > 0 ? `${failedObjectives.length} objectives failed` : undefined,
      });
    } catch (e) {
      error = e;
      console.error(`[${TOOL_NAME}] Unexpected error during execution:`, e);
      finalReport = `## Unexpected Error During Research Plan Execution\n\nAn unexpected error occurred: ${
        e instanceof Error ? e.message : String(e)
      }\n\nThis typically indicates a system issue rather than a problem with your research objectives.`;

      // Emit error session status
      logger?.emitSessionProgress({
        status: 'error',
        totalObjectives: researchPlan.length,
        completedObjectives: completedCount,
        error: e instanceof Error ? e.message : String(e),
      });

      // Emit error notification
      logger?.emitError(e instanceof Error ? e.message : String(e), {
        phase: 'research-execution',
        retryable: false,
      });
    } finally {
      logger?.logToolCallEnd(
        TOOL_NAME,
        {
          finalReportLength: finalReport.length,
        },
        error
      );
    }

    console.log(`### ${TOOL_NAME} Execution Finished ###\n`);

    const result: ResearchPlanResult = {
      report: finalReport,
    };

    return result;
  },
});


