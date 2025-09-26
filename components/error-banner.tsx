"use client";

import { AlertCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ErrorBannerProps {
  error: Error;
  onRetry?: () => void;
  onDismiss?: () => void;
}

function classifyError(error: Error): {
  type: 'transient' | 'permanent';
  message: string;
} {
  const msg = error.message.toLowerCase();

  if (
    msg.includes('overload') ||
    msg.includes('timeout') ||
    msg.includes('timed out') ||
    msg.includes('network') ||
    msg.includes('rate limit') ||
    msg.includes('503') ||
    msg.includes('502') ||
    msg.includes('429')
  ) {
    return {
      type: 'transient',
      message: error.message || 'Service temporarily unavailable',
    };
  }

  if (
    msg.includes('context limit') ||
    msg.includes('413') ||
    msg.includes('401') ||
    msg.includes('403') ||
    msg.includes('invalid')
  ) {
    return {
      type: 'permanent',
      message: error.message || 'Unable to process request',
    };
  }

  return {
    type: 'transient',
    message: error.message || 'An error occurred',
  };
}

export function ErrorBanner({ error, onRetry, onDismiss }: ErrorBannerProps) {
  const { type, message } = classifyError(error);
  const isTransient = type === 'transient';

  const colorClasses = isTransient
    ? 'bg-yellow-50 text-yellow-900 border-yellow-200 dark:bg-yellow-900/10 dark:text-yellow-400 dark:border-yellow-800/30'
    : 'bg-red-50 text-red-900 border-red-200 dark:bg-red-900/10 dark:text-red-400 dark:border-red-800/30';

  return (
    <div
      role="alert"
      aria-live="assertive"
      className={`mx-4 md:mx-6 mt-2 mb-2 px-4 py-3 rounded-md border ${colorClasses}`}
    >
      <div className="flex items-start gap-3">
        <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">
            {isTransient ? 'Message failed to send' : 'Unable to send message'}
          </p>
          <p className="text-sm mt-1 opacity-90">
            {message}
          </p>
          <div className="flex items-center gap-2 mt-3">
            {isTransient && onRetry && (
              <Button
                onClick={onRetry}
                size="sm"
                variant="outline"
                className="h-8 text-xs"
              >
                Retry
              </Button>
            )}
            {onDismiss && (
              <Button
                onClick={onDismiss}
                size="sm"
                variant="ghost"
                className="h-8 text-xs"
              >
                Dismiss
              </Button>
            )}
          </div>
        </div>
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="flex-shrink-0 opacity-70 hover:opacity-100 transition-opacity"
            aria-label="Dismiss error"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}