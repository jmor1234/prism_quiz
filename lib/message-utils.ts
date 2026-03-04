import type { UIMessage } from "ai";
import { canonicalizeUrlForDedupe } from "./utils";

export function extractMessageText(message: UIMessage): string {
  if (!message?.parts?.length) return "";
  return message.parts
    .filter(
      (part): part is { type: "text"; text: string } =>
        part?.type === "text" && typeof part.text === "string"
    )
    .map((part) => part.text)
    .join("\n\n")
    .trim();
}

export interface CitationSource {
  title: string;
  url: string;
  domain: string;
}

const CITATION_REGEX = /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g;

export function extractCitationUrls(text: string): CitationSource[] {
  CITATION_REGEX.lastIndex = 0;
  const seen = new Set<string>();
  const results: CitationSource[] = [];
  let match;
  while ((match = CITATION_REGEX.exec(text)) !== null) {
    const canonical = canonicalizeUrlForDedupe(match[2]);
    if (!seen.has(canonical)) {
      seen.add(canonical);
      let domain = "";
      try {
        domain = new URL(match[2]).hostname.replace(/^www\./, "");
      } catch {
        /* ignore */
      }
      results.push({ title: match[1], url: match[2], domain });
    }
  }
  return results;
}
