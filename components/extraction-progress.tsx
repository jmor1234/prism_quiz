// components/extraction-progress.tsx
"use client";

import { Loader2, CheckCircle2, XCircle, FileSearch2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type {
  ExtractionSessionData,
  ExtractionUrlData,
} from "@/lib/streaming-types";

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

  return (
    <div className={cn("mx-4 my-3 p-4 bg-muted/50 rounded-lg animate-in fade-in duration-300", className)}>
      {/* Session Header */}
      <div className="flex items-center gap-2 mb-3">
        <FileSearch2 className="h-4 w-4 text-primary" />
        <span className="font-medium text-sm">
          Extracting from {session.totalUrls} {session.totalUrls === 1 ? 'URL' : 'URLs'} ({session.completedUrls} completed)
        </span>
      </div>

      {/* URL List */}
      <div className="space-y-2">
        {urlList.map((url) => (
          <UrlProgress key={url.url} url={url} />
        ))}
      </div>

      {/* Error State */}
      {session.error && (
        <div className="mt-3 text-xs text-destructive">
          Error: {session.error}
        </div>
      )}
    </div>
  );
}

interface UrlProgressProps {
  url: ExtractionUrlData;
}

function UrlProgress({ url }: UrlProgressProps) {
  const getStatusIcon = () => {
    switch (url.status) {
      case 'complete':
        return <CheckCircle2 className="h-3 w-3 text-green-600" />;
      case 'failed':
        return <XCircle className="h-3 w-3 text-destructive" />;
      case 'retrieving':
      case 'extracting':
        return <Loader2 className="h-3 w-3 animate-spin text-primary" />;
      default:
        return <div className="h-3 w-3 rounded-full bg-muted-foreground/30" />;
    }
  };

  const getStatusText = () => {
    switch (url.status) {
      case 'pending':
        return 'Pending';
      case 'retrieving':
        return 'Retrieving content...';
      case 'extracting':
        return 'Extracting information...';
      case 'complete':
        return 'Complete';
      case 'failed':
        return url.error ? `Failed: ${url.error}` : 'Failed';
      default:
        return url.status;
    }
  };

  const displayUrl = url.url.length > 60 ? url.url.substring(0, 60) + '...' : url.url;

  return (
    <div className="flex items-center gap-2 text-sm">
      {getStatusIcon()}
      <div className="flex-1 min-w-0">
        <div className="truncate text-xs text-muted-foreground" title={url.url}>
          {displayUrl}
        </div>
        <div className="text-xs mt-0.5">
          {getStatusText()}
        </div>
      </div>
      {url.status !== 'pending' && url.status !== 'failed' && (
        <Progress value={url.progress * 100} className="h-1 w-16" />
      )}
    </div>
  );
}

export default ExtractionProgress;