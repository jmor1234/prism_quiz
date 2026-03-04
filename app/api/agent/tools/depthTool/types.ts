// app/api/agent/tools/depthTool/types.ts

export interface Finding {
  insight: string;
  evidence: string;
}

export interface ExtractionOutput {
  findings: Finding[];
  summary: string;
}

export interface DepthToolOutput extends ExtractionOutput {
  url: string;
}
