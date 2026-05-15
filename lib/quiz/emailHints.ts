// lib/quiz/emailHints.ts
//
// Light-touch email typo suggestion. Pure function — no side effects, no
// network. Surfaces "Did you mean foo@gmail.com?" inline below the email
// input without ever blocking submission. The actual format gate is
// `z.string().email()` on both client and server.

const TYPO_TABLE: Record<string, string> = {
  // gmail
  "gmial.com": "gmail.com",
  "gmal.com": "gmail.com",
  "gnail.com": "gmail.com",
  "gmai.com": "gmail.com",
  "gmaill.com": "gmail.com",
  // yahoo
  "yaho.com": "yahoo.com",
  "yhoo.com": "yahoo.com",
  "yahooo.com": "yahoo.com",
  // hotmail
  "hotmial.com": "hotmail.com",
  "hotmal.com": "hotmail.com",
  "hotmai.com": "hotmail.com",
  // outlook
  "outloo.com": "outlook.com",
  "outlok.com": "outlook.com",
  // icloud
  "iclod.com": "icloud.com",
  "icoud.com": "icloud.com",
  // aol
  "aol.co": "aol.com",
};

const MAJOR_DOMAINS = [
  "gmail.com",
  "yahoo.com",
  "hotmail.com",
  "outlook.com",
  "icloud.com",
  "aol.com",
];

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const rows = a.length + 1;
  const cols = b.length + 1;
  const d = new Array(rows * cols);
  for (let i = 0; i < rows; i++) d[i * cols] = i;
  for (let j = 0; j < cols; j++) d[j] = j;
  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i * cols + j] = Math.min(
        d[(i - 1) * cols + j] + 1,
        d[i * cols + (j - 1)] + 1,
        d[(i - 1) * cols + (j - 1)] + cost,
      );
    }
  }
  return d[rows * cols - 1];
}

// Returns a corrected email, or null if no high-confidence suggestion exists.
// Two heuristics, in order:
//   1. Exact match against a known typo table → swap domain.
//   2. Levenshtein distance of exactly 1 against a major domain → swap.
// Distance 0 returns null (already correct). Distance ≥2 returns null (too
// ambiguous to suggest with confidence).
export function suggestEmailFix(email: string): string | null {
  const trimmed = email.trim().toLowerCase();
  const atIdx = trimmed.lastIndexOf("@");
  if (atIdx <= 0 || atIdx === trimmed.length - 1) return null;

  const local = trimmed.slice(0, atIdx);
  const domain = trimmed.slice(atIdx + 1);

  const tableHit = TYPO_TABLE[domain];
  if (tableHit) return `${local}@${tableHit}`;

  for (const major of MAJOR_DOMAINS) {
    if (domain === major) return null;
    if (levenshtein(domain, major) === 1) return `${local}@${major}`;
  }

  return null;
}
