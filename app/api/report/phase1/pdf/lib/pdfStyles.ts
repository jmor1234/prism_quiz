// app/api/report/phase1/pdf/lib/pdfStyles.ts

/**
 * PDF-optimized styles adapted from globals.css Streamdown typography
 *
 * Key principles:
 * - Prism brand colors: red headings (#FF0C01), orange accents (#F37521)
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
  /* Default page (content sections) - with margins */
  @page {
    margin: 0.75in;
    size: letter;
  }

  /* Cover and divider pages - no margins for full bleed */
  @page cover-divider {
    margin: 0;
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

  /* Divider pages - Full gradient background, centered content */
  .divider-page {
    page: cover-divider;
    height: 11in;
    background: linear-gradient(to bottom, #FFF5EE 0%, #F37521 50%, #EF0D23 100%);
    page-break-before: always;
    page-break-after: always;
    text-align: center;
    padding-top: 2.5in;
    padding-bottom: 1in;
    padding-left: 1in;
    padding-right: 1in;
  }

  .divider-page img {
    width: 150px;
    height: auto;
    margin-bottom: 1.5rem;
    display: block;
    margin-left: auto;
    margin-right: auto;
  }

  .divider-page h1 {
    font-size: 48pt;
    font-style: italic;
    color: #000000;
    margin-bottom: 1rem;
    font-weight: 400;
  }

  .divider-page p {
    font-size: 18pt;
    color: #000000;
    margin: 0;
    text-align: center;
  }

  /* Cover page - Full gradient background */
  .cover-page {
    page: cover-divider;
    height: 11in;
    background: linear-gradient(to bottom, #FFF5EE 0%, #F37521 50%, #EF0D23 100%);
    page-break-after: always;
    text-align: center;
    padding-top: 2in;
    padding-bottom: 1in;
    padding-left: 1in;
    padding-right: 1in;
    position: relative;
  }

  .cover-page img {
    width: 180px;
    height: auto;
    margin-bottom: 1rem;
    display: block;
    margin-left: auto;
    margin-right: auto;
  }

  .cover-page h1 {
    font-size: 28pt;
    font-weight: 600;
    color: #000000;
    margin-top: 0;
    margin-bottom: 0.75rem;
    letter-spacing: 0.1em;
  }

  .cover-page h2 {
    font-size: 32pt;
    font-weight: 700;
    color: #000000;
    margin-top: 0;
    margin-bottom: 0;
    page-break-before: avoid;
    page-break-after: avoid;
  }

  .cover-page .tagline {
    font-size: 14pt;
    font-style: italic;
    color: #000000;
    border-top: 2px solid #000000;
    border-bottom: 2px solid #000000;
    padding: 0.4rem 1.5rem;
    margin-top: 1.5rem;
    margin-left: auto;
    margin-right: auto;
    display: inline-block;
    max-width: 80%;
  }

  .cover-page .disclaimer {
    font-size: 9pt;
    font-style: italic;
    color: #000000;
    position: absolute;
    bottom: 1in;
    left: 1in;
    right: 1in;
    text-align: center;
    margin: 0;
  }

  /* Content sections - White background with orange top border */
  .content-section {
    border-top: 3px solid #F37521;
    padding-top: 1rem;
    background: white;
  }

  /* Title (H1) - Report title - RED */
  h1 {
    margin-top: 0;
    margin-bottom: 0.25rem;
    font-size: 22pt;
    font-weight: 600;
    color: #FF0C01;
    text-align: center;
    page-break-after: avoid;
  }

  /* Major sections (H2) - BLACK, no forced page breaks */
  h2 {
    margin-top: 2rem;
    margin-bottom: 0.75rem;
    font-size: 20pt;
    font-weight: 600;
    color: #1a1a1a;
    text-align: center;
    page-break-after: avoid;
  }

  /* First H2 should not have excessive top margin */
  h1 + h2 {
    margin-top: 0.5rem;
  }

  /* Subsections (H3) - RED */
  h3 {
    margin-top: 1.5rem;
    margin-bottom: 0.5rem;
    font-size: 16pt;
    font-weight: 600;
    color: #FF0C01;
    page-break-after: avoid;
  }

  /* Sub-subsections (H4) - Used in citations - BLACK */
  h4 {
    margin-top: 1rem;
    margin-bottom: 0.5rem;
    font-size: 13pt;
    font-weight: 600;
    color: #1a1a1a;
    page-break-after: avoid;
  }

  /* H5, H6 for completeness - BLACK */
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

  /* Tables - Keep together on page - ORANGE BORDERS */
  table {
    width: 100%;
    margin: 1rem 0;
    border-collapse: collapse;
    border: 2px solid #F37521;
    page-break-inside: avoid;
  }

  /* Table header */
  thead {
    background-color: #f3f4f6;
  }

  /* Table header cells - ORANGE BORDERS */
  th {
    padding: 0.5rem 0.75rem;
    text-align: left;
    font-weight: 600;
    font-size: 10pt;
    color: #1a1a1a;
    border: 1px solid #F37521;
    white-space: nowrap;
  }

  /* Table body */
  tbody {
    background-color: #fafafa;
  }

  /* Table rows - ORANGE BORDERS */
  tr {
    border-bottom: 1px solid #F37521;
  }

  /* Table cells - ORANGE BORDERS */
  td {
    padding: 0.5rem 0.75rem;
    font-size: 10pt;
    border: 1px solid #F37521;
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

  /* Browser hint text - appears below headings to instruct users about opening links */
  .browser-hint {
    font-size: 9pt;
    font-style: italic;
    color: #6b7280;
    margin-top: 0.25rem;
    margin-bottom: 0.75rem;
    text-align: center;
    page-break-after: avoid;
  }
`;
