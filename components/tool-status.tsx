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
        return <Brain className="h-3.5 w-3.5" />;
      case 'researchMemoryTool':
        return <NotebookPen className="h-3.5 w-3.5" />;
      default:
        return null;
    }
  };

  const getColorClasses = () => {
    switch (status.toolName) {
      case 'thinkTool':
        return "from-violet-500/10 to-purple-500/10 border-violet-500/20 text-violet-600 dark:text-violet-400";
      case 'researchMemoryTool':
        return "from-amber-500/10 to-orange-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400";
      default:
        return "from-primary/10 to-primary/5 border-primary/20 text-primary";
    }
  };

  return (
    <div className={cn(
      "mx-3 my-2",
      "animate-in slide-in-from-top-1 fade-in duration-300",
      className
    )}>
      <div className={cn(
        "inline-flex items-center gap-2.5",
        "px-3 py-1.5",
        "bg-gradient-to-r",
        getColorClasses(),
        "border rounded-full",
        "shadow-sm",
        "backdrop-blur-sm"
      )}>
        {/* Animated icon wrapper */}
        <div className="relative">
          {getIcon()}
          <div className={cn(
            "absolute inset-0 blur-md animate-pulse",
            status.toolName === 'thinkTool' && "bg-violet-500/30",
            status.toolName === 'researchMemoryTool' && "bg-amber-500/30"
          )} />
        </div>

        {/* Status text with subtle animation */}
        <span className="text-xs font-medium tracking-tight">
          {status.action}
        </span>

        {/* Activity indicator */}
        <div className="flex gap-0.5 ml-1">
          <div className="w-1 h-1 bg-current rounded-full opacity-40 animate-pulse" />
          <div className="w-1 h-1 bg-current rounded-full opacity-60 animate-pulse animation-delay-150" />
          <div className="w-1 h-1 bg-current rounded-full opacity-80 animate-pulse animation-delay-300" />
        </div>
      </div>
    </div>
  );
}

export default ToolStatus;