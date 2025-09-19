// components/extraction-progress.tsx
"use client";

import { Loader2, CheckCircle2, XCircle, Globe2, FileText, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  ExtractionSessionData,
  ExtractionUrlData,
} from "@/lib/streaming-types";
import { Task, TaskTrigger, TaskContent, TaskItem, TaskItemFile } from "@/components/ai-elements/task";

interface ExtractionProgressProps {
  session: ExtractionSessionData;
  urls: Record<string, ExtractionUrlData>;
  className?: string;
}

export function ExtractionProgress({ session, urls, className }: ExtractionProgressProps) {
  // Don't show if no active extraction
  if (!session || session.status === 'complete' || session.status === 'error') {
    return null;
  }

  const urlList = Object.entries(urls)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, data]) => data);

  const overallProgress = session.totalUrls > 0
    ? (session.completedUrls / session.totalUrls) * 100
    : 0;

  return (
    <div className={cn("mx-3 my-2", className)}>
      <Task defaultOpen>
        <TaskTrigger title="Content extraction">
          <div className="flex w-full items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[13.5px] font-medium leading-tight truncate">
                Processing {session.totalUrls} {session.totalUrls === 1 ? 'URL' : 'URLs'}
              </p>
              <div className="mt-1 h-1 bg-muted/30 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-[width] duration-500 bg-gradient-to-r from-blue-500 to-blue-400"
                  style={{ width: `${overallProgress}%` }}
                />
              </div>
            </div>
            <div className="shrink-0 text-xs text-muted-foreground">
              {session.completedUrls}/{session.totalUrls}
            </div>
          </div>
        </TaskTrigger>
        <TaskContent>
          <TaskItem>
            <div className="space-y-2">
              {urlList.map((url, index) => (
                <UrlProgress key={url.url} url={url} index={index} />
              ))}
            </div>
          </TaskItem>
          {session.error && (
            <TaskItem>
              <TaskItemFile className="text-destructive">{session.error}</TaskItemFile>
            </TaskItem>
          )}
        </TaskContent>
      </Task>
    </div>
  );
}

interface UrlProgressProps {
  url: ExtractionUrlData;
  index: number;
}

function UrlProgress({ url, index }: UrlProgressProps) {
  const getStatusIcon = () => {
    switch (url.status) {
      case 'complete':
        return (
          <div className="relative">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
            <div className="absolute inset-0 bg-emerald-500/30 blur-md" />
          </div>
        );
      case 'failed':
        return <XCircle className="h-3.5 w-3.5 text-destructive" />;
      case 'retrieving':
        return (
          <div className="relative">
            <Globe2 className="h-3.5 w-3.5 text-blue-500 animate-pulse" />
            <div className="absolute inset-0 bg-blue-500/30 blur-md animate-pulse" />
          </div>
        );
      case 'extracting':
        return (
          <div className="relative">
            <FileText className="h-3.5 w-3.5 text-primary animate-pulse" />
            <div className="absolute inset-0 bg-primary/30 blur-md animate-pulse" />
          </div>
        );
      default:
        return <div className="h-3.5 w-3.5 rounded-full bg-muted-foreground/20" />;
    }
  };

  const getPhaseText = () => {
    switch (url.status) {
      case 'pending':
        return 'Queued';
      case 'retrieving':
        return 'Fetching content';
      case 'extracting':
        return 'Analyzing';
      case 'complete':
        return 'Complete';
      case 'failed':
        return 'Failed';
      default:
        return url.status;
    }
  };

  // Extract domain from URL for cleaner display
  const getDomain = (urlString: string) => {
    try {
      const domain = new URL(urlString).hostname.replace('www.', '');
      return domain.length > 30 ? domain.substring(0, 30) + '...' : domain;
    } catch {
      return urlString.substring(0, 30) + '...';
    }
  };

  return (
    <div
      className={cn(
        "group relative flex items-center gap-3 p-2.5",
        "border border-border/30 bg-card/30 backdrop-blur-sm",
        "rounded-lg transition-all duration-300",
        url.status === 'retrieving' && "border-blue-500/20 bg-blue-500/5",
        url.status === 'extracting' && "border-primary/20 bg-primary/5",
        url.status === 'complete' && "border-emerald-500/20 bg-emerald-500/5",
        url.status === 'failed' && "border-destructive/20 bg-destructive/5",
        "animate-in fade-in slide-in-from-left-1",
        `animation-delay-${Math.min(index * 50, 200)}`
      )}
    >
      {/* Status Icon */}
      {getStatusIcon()}

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* URL with external link icon */}
        <div className="flex items-center gap-1.5 group">
          <span
            className="text-xs font-medium text-foreground/80 truncate"
            title={url.url}
          >
            {getDomain(url.url)}
          </span>
          <ExternalLink className="h-2.5 w-2.5 text-muted-foreground opacity-0 group-hover:opacity-50 transition-opacity" />
        </div>

        {/* Status and Progress */}
        <div className="flex items-center gap-2 mt-1">
          <span className={cn(
            "text-xs",
            url.status === 'complete' && "text-emerald-600",
            url.status === 'failed' && "text-destructive",
            url.status === 'retrieving' && "text-blue-500",
            url.status === 'extracting' && "text-primary",
            url.status === 'pending' && "text-muted-foreground"
          )}>
            {getPhaseText()}
          </span>

          {/* Inline progress for active operations */}
          {(url.status === 'retrieving' || url.status === 'extracting') && (
            <div className="flex-1 max-w-[80px]">
              <div className="h-1 bg-muted/50 rounded-full overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-500 ease-out",
                    url.status === 'retrieving' && "bg-gradient-to-r from-blue-500 to-blue-400 animate-shimmer",
                    url.status === 'extracting' && "bg-gradient-to-r from-primary to-primary/70 animate-shimmer"
                  )}
                  style={{ width: `${url.progress * 100}%` }}
                />
              </div>
            </div>
          )}

          {/* Completion indicator */}
          {url.status === 'complete' && (
            <Loader2 className="h-2.5 w-2.5 text-emerald-500 opacity-0" />
          )}
        </div>

        {/* Error message */}
        {url.error && (
          <p className="text-xs text-destructive mt-1 line-clamp-1">
            {url.error}
          </p>
        )}
      </div>

      {/* Progress percentage for active items */}
      {(url.status === 'retrieving' || url.status === 'extracting') && (
        <span className="text-xs font-medium text-muted-foreground">
          {Math.round(url.progress * 100)}%
        </span>
      )}
    </div>
  );
}

export default ExtractionProgress;