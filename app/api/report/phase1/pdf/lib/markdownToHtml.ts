// app/api/report/phase1/pdf/lib/markdownToHtml.ts

import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import rehypeStringify from "rehype-stringify";

/**
 * Convert markdown to HTML string using the unified pipeline
 *
 * Uses the same plugins as the frontend Streamdown component to ensure
 * consistent rendering between screen and PDF output.
 *
 * Pipeline:
 * 1. remarkParse - Parse markdown text to mdast (markdown AST)
 * 2. remarkGfm - Add support for GitHub Flavored Markdown (tables, strikethrough, etc.)
 * 3. remarkRehype - Convert mdast to hast (HTML AST)
 * 4. rehypeStringify - Convert hast to HTML string
 */
export async function markdownToHtml(markdown: string): Promise<string> {
  const file = await unified()
    .use(remarkParse) // markdown string → mdast
    .use(remarkGfm) // Enable GFM features (tables are critical for our reports)
    .use(remarkRehype, {
      // mdast → hast
      allowDangerousHtml: false, // Security: don't allow raw HTML in markdown
    })
    .use(rehypeStringify) // hast → HTML string
    .process(markdown);

  return String(file);
}
