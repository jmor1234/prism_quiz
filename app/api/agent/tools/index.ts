// app/api/agent/tools/index.ts

import { searchTool } from "./searchTool";
import { readTool } from "./readTool";
import { extractFindingsTool } from "./depthTool/depthTool";

export const agentTools = {
  search: searchTool,
  read: readTool,
  extract_findings: extractFindingsTool,
};
