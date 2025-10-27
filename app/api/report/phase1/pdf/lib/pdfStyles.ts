// app/api/report/phase1/pdf/lib/pdfStyles.ts

/**
 * PDF-optimized styles adapted from globals.css Streamdown typography
 *
 * Key principles:
 * - Static colors (no CSS variables - limited PDF support)
 * - Professional serif typography for readability
 * - Smart page breaks (sections start new page, keep items together)
 * - Print-optimized spacing and margins
 */

export const PDF_STYLES = `
  /* CSS Reset for consistent PDF rendering */
  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }

  /* Page setup */
  @page {
    margin: 0.75in;
    size: letter;
  }

  /* Body typography */
  body {
    font-family: Georgia, 'Times New Roman', serif;
    font-size: 11pt;
    line-height: 1.6;
    color: #1a1a1a;
    background: white;
  }

  /* Title (H1) - Report title */
  h1 {
    margin-top: 0;
    margin-bottom: 0.25rem;
    font-size: 28pt;
    font-weight: 700;
    color: #1a1a1a;
    page-break-after: avoid;
  }

  /* Major sections (H2) - Start new page */
  h2 {
    margin-top: 2rem;
    margin-bottom: 0.75rem;
    font-size: 20pt;
    font-weight: 600;
    color: #1a1a1a;
    page-break-before: always;
    page-break-after: avoid;
  }

  /* First H2 (client name) should NOT start new page */
  h1 + h2 {
    page-break-before: avoid;
    margin-top: 0.5rem;
  }

  /* Subsections (H3) */
  h3 {
    margin-top: 1.5rem;
    margin-bottom: 0.5rem;
    font-size: 16pt;
    font-weight: 600;
    color: #1a1a1a;
    page-break-after: avoid;
  }

  /* Sub-subsections (H4) - Used in citations */
  h4 {
    margin-top: 1rem;
    margin-bottom: 0.5rem;
    font-size: 13pt;
    font-weight: 600;
    color: #1a1a1a;
    page-break-after: avoid;
  }

  /* H5, H6 for completeness */
  h5 {
    margin-top: 0.75rem;
    margin-bottom: 0.5rem;
    font-size: 12pt;
    font-weight: 600;
    color: #1a1a1a;
    page-break-after: avoid;
  }

  h6 {
    margin-top: 0.75rem;
    margin-bottom: 0.5rem;
    font-size: 11pt;
    font-weight: 600;
    color: #1a1a1a;
    page-break-after: avoid;
  }

  /* Paragraphs */
  p {
    margin-top: 0.5rem;
    margin-bottom: 0.5rem;
    text-align: justify;
  }

  /* Strong emphasis */
  strong {
    font-weight: 600;
    color: #1a1a1a;
  }

  /* Emphasis */
  em {
    font-style: italic;
  }

  /* Links - Keep clickable but subtle for print */
  a {
    color: #2563eb;
    text-decoration: underline;
    text-decoration-color: #93c5fd;
  }

  /* Horizontal rules - Section separators */
  hr {
    margin-top: 1.5rem;
    margin-bottom: 1.5rem;
    border: none;
    border-top: 1px solid #d1d5db;
    page-break-after: auto;
  }

  /* Blockquotes */
  blockquote {
    margin: 1rem 0;
    padding-left: 1rem;
    border-left: 4px solid #9ca3af;
    color: #4b5563;
    font-style: italic;
  }

  /* Unordered lists */
  ul {
    margin-top: 0.5rem;
    margin-bottom: 0.5rem;
    margin-left: 1.5rem;
    list-style-type: disc;
    list-style-position: outside;
  }

  /* Ordered lists */
  ol {
    margin-top: 0.5rem;
    margin-bottom: 0.5rem;
    margin-left: 1.5rem;
    list-style-type: decimal;
    list-style-position: outside;
  }

  /* List items */
  li {
    margin-top: 0.25rem;
    margin-bottom: 0.25rem;
    padding-left: 0.25rem;
  }

  /* Nested lists */
  ul ul,
  ol ul {
    margin-left: 1rem;
    list-style-type: circle;
  }

  ul ul ul,
  ol ul ul {
    list-style-type: square;
  }

  /* Inline code */
  code {
    font-family: 'Courier New', monospace;
    font-size: 10pt;
    background-color: #f3f4f6;
    padding: 0.125rem 0.375rem;
    border-radius: 0.25rem;
  }

  /* Code blocks */
  pre {
    margin: 1rem 0;
    padding: 0.75rem;
    background-color: #f9fafb;
    border: 1px solid #e5e7eb;
    border-radius: 0.375rem;
    overflow-x: auto;
    page-break-inside: avoid;
  }

  pre code {
    background: none;
    padding: 0;
    font-size: 9pt;
    line-height: 1.5;
  }

  /* Tables - Keep together on page */
  table {
    width: 100%;
    margin: 1rem 0;
    border-collapse: collapse;
    border: 1px solid #d1d5db;
    page-break-inside: avoid;
  }

  /* Table header */
  thead {
    background-color: #f3f4f6;
  }

  /* Table header cells */
  th {
    padding: 0.5rem 0.75rem;
    text-align: left;
    font-weight: 600;
    font-size: 10pt;
    color: #1a1a1a;
    border: 1px solid #d1d5db;
    white-space: nowrap;
  }

  /* Table body */
  tbody {
    background-color: #fafafa;
  }

  /* Table rows */
  tr {
    border-bottom: 1px solid #d1d5db;
  }

  /* Table cells */
  td {
    padding: 0.5rem 0.75rem;
    font-size: 10pt;
    border: 1px solid #d1d5db;
    vertical-align: top;
  }

  /* Alternate row coloring for readability */
  tbody tr:nth-child(even) {
    background-color: #f9fafb;
  }

  /* Ensure table text doesn't break awkwardly */
  table p {
    margin: 0;
    text-align: left;
  }

  /* Special handling for diagnostic/supplement sections */
  /* These follow pattern: table + paragraph (Notes:) + hr separator */

  /* Keep "Notes:" paragraphs with their tables */
  table + p {
    margin-top: 0.5rem;
    page-break-before: avoid;
  }

  /* Keep hr separators from orphaning */
  p + hr {
    page-break-before: avoid;
  }

  /* Prevent orphaned headings */
  h1, h2, h3, h4, h5, h6 {
    page-break-inside: avoid;
  }

  /* Keep heading + first paragraph together */
  h1 + p,
  h2 + p,
  h3 + p,
  h4 + p,
  h5 + p,
  h6 + p {
    page-break-before: avoid;
  }

  /* Avoid widows and orphans in paragraphs */
  p {
    orphans: 3;
    widows: 3;
  }

  /* Special styling for bold labels in assessment findings */
  /* Pattern: "**Questionnaire:**", "**History:**", etc. */
  li strong:first-child {
    color: #1a1a1a;
  }

  /* Citation lists - more compact */
  h4 + ul {
    margin-top: 0.25rem;
  }

  /* Citation links */
  h4 + ul a {
    font-size: 10pt;
    word-break: break-word;
  }

  /* Prevent very long URLs from breaking layout */
  a {
    word-wrap: break-word;
    overflow-wrap: break-word;
  }
`;
