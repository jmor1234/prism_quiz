// components/tool-status.tsx
"use client";

import { Brain, NotebookPen } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ToolStatusData } from "@/lib/streaming-types";

interface ToolStatusProps {
  status: ToolStatusData;
  className?: string;
}

export function ToolStatus({ status, className }: ToolStatusProps) {
  const getIcon = () => {
    switch (status.toolName) {
      case 'thinkTool':
        return <Brain className="h-3.5 w-3.5 animate-pulse" />;
      case 'researchMemoryTool':
        return <NotebookPen className="h-3.5 w-3.5 animate-pulse" />;
      default:
        return null;
    }
  };

  return (
    <div className={cn(
      "mx-4 my-2 px-3 py-2 bg-muted/30 rounded-md text-sm text-muted-foreground animate-in fade-in duration-200",
      className
    )}>
      <div className="flex items-center gap-2">
        {getIcon()}
        <span>{status.action}</span>
      </div>
    </div>
  );
}

export default ToolStatus;