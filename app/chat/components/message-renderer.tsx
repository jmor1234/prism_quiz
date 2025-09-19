"use client";

import type { UIMessage } from "ai";
import type React from "react";
import Image from "next/image";
import { Response } from "@/components/ai-elements/response";
import {
  InlineCitation,
  InlineCitationText,
  InlineCitationCard,
  InlineCitationCardTrigger,
  InlineCitationCardBody,
  InlineCitationCarousel,
  InlineCitationCarouselContent,
  InlineCitationCarouselItem,
  InlineCitationCarouselHeader,
  InlineCitationCarouselIndex,
  InlineCitationCarouselPrev,
  InlineCitationCarouselNext,
  InlineCitationSource,
} from "@/components/ai-elements/inline-citation";
//
import {
  Reasoning,
  ReasoningTrigger,
  ReasoningContent,
} from "@/components/ai-elements/reasoning";

interface InlineCitationSpec {
  anchor: string; // exact substring to annotate
  sources: string[]; // urls
  quote?: string; // optional short quote for the card
  start?: number; // preferred character offset
  end?: number;   // preferred character offset (exclusive)
}

interface MessageRendererProps {
  message: UIMessage;
  inlineCitations?: InlineCitationSpec[]; // Optional claim-level mapping
}

export function MessageRenderer({ message, inlineCitations }: MessageRendererProps) {
  const renderTextWithInlineCitations = (text: string) => {
    if (!inlineCitations || inlineCitations.length === 0) return <Response>{text}</Response>;

    type Span = { start: number; end: number; anchor: string; sources: string[]; quote?: string };

    // Prefer offsets when present; validate anchors; filter overlaps
    const normalized: Span[] = [];
    const maxSpans = 16;

    // Prepare candidates
    const candidates: Span[] = inlineCitations.map((c) => ({
      start: typeof c.start === 'number' ? c.start : -1,
      end: typeof c.end === 'number' ? c.end : -1,
      anchor: c.anchor,
      sources: c.sources || [],
      quote: c.quote,
    }));

    // Collect valid offset spans
    const withOffsets = candidates
      .filter((s) => s.start >= 0 && s.end > s.start && s.end <= text.length)
      .sort((a, b) => a.start - b.start);

    let lastEnd = -1;
    for (const s of withOffsets) {
      if (s.start < lastEnd) continue; // overlap
      const substr = text.slice(s.start, s.end);
      if (s.anchor && substr !== s.anchor) {
        // Fallback: try to find anchor after lastEnd
        const idx = text.indexOf(s.anchor, Math.max(lastEnd, 0));
        if (idx !== -1) {
          s.start = idx;
          s.end = idx + s.anchor.length;
        } else {
          continue;
        }
      }
      normalized.push(s);
      lastEnd = s.end;
      if (normalized.length >= maxSpans) break;
    }

    // Add any anchor-only citations (no offsets) without overlapping existing
    const anchorOnly = candidates.filter((s) => s.start < 0 || s.end <= s.start);
    for (const s of anchorOnly) {
      const idx = text.indexOf(s.anchor, Math.max(lastEnd, 0));
      if (idx === -1) continue;
      const span: Span = { ...s, start: idx, end: idx + s.anchor.length };
      if (span.start < lastEnd) continue; // ensure non-overlap/simple order
      normalized.push(span);
      lastEnd = span.end;
      if (normalized.length >= maxSpans) break;
    }

    if (normalized.length === 0) return <Response>{text}</Response>;

    // Build output segments
    const nodes: Array<React.ReactNode> = [];
    let cursor = 0;
    normalized.forEach((s, i) => {
      if (s.start > cursor) {
        nodes.push(<Response key={`txt-${i}-pre`}>{text.slice(cursor, s.start)}</Response>);
      }
      const urls = s.sources || [];
      nodes.push(
        <InlineCitation key={`ic-${i}`}>
          <InlineCitationText>{text.slice(s.start, s.end)}</InlineCitationText>
          {urls.length > 0 && (
            <InlineCitationCard>
              <InlineCitationCardTrigger aria-label={`Sources for: ${s.anchor}`} sources={urls} />
              <InlineCitationCardBody>
                <InlineCitationCarousel>
                  <InlineCitationCarouselHeader>
                    <InlineCitationCarouselPrev />
                    <InlineCitationCarouselIndex />
                    <InlineCitationCarouselNext />
                  </InlineCitationCarouselHeader>
                  <InlineCitationCarouselContent>
                    {urls.map((u, ui) => (
                      <InlineCitationCarouselItem key={`${u}-${ui}`}>
                        <InlineCitationSource title={(() => { try { return new URL(u).hostname; } catch { return undefined; } })()} url={u} description={s.quote} />
                      </InlineCitationCarouselItem>
                    ))}
                  </InlineCitationCarouselContent>
                </InlineCitationCarousel>
              </InlineCitationCardBody>
            </InlineCitationCard>
          )}
        </InlineCitation>
      );
      cursor = s.end;
    });
    if (cursor < text.length) nodes.push(<Response key={`txt-tail`}>{text.slice(cursor)}</Response>);

    return <div className="prose prose-sm dark:prose-invert max-w-none">{nodes}</div>;
  };

  return (
    <>
      {message.parts.map((part, idx) => {
        switch (part.type) {
          case "text":
            return (
              <div key={idx} className="leading-relaxed">
                {renderTextWithInlineCitations(part.text)}
              </div>
            );
          case "reasoning":
            return (
              <Reasoning
                key={idx}
                isStreaming={part.state === "streaming"}
                defaultOpen
              >
                <ReasoningTrigger />
                <ReasoningContent>{part.text}</ReasoningContent>
              </Reasoning>
            );
          case "file":
            // Handle image files
            if (part.mediaType?.startsWith("image/")) {
              return (
                <div key={idx} className="my-2">
                  <Image 
                    src={part.url} 
                    alt={part.filename || "Image"} 
                    width={384} // max-w-sm equivalent (24rem = 384px)
                    height={200} // reasonable default height
                    className="max-w-sm rounded-lg border border-border/50 shadow-sm object-contain"
                    unoptimized // Required for data URLs and external images
                  />
                  {part.filename && (
                    <div className="mt-1 text-xs text-muted-foreground">
                      {part.filename}
                    </div>
                  )}
                </div>
              );
            }
            // Handle other file types (fallback)
            return (
              <div key={idx} className="my-2 text-sm text-muted-foreground">
                📎 {part.filename || "Attachment"}
              </div>
            );
          default:
            return null;
        }
      })}
    </>
  );
}
