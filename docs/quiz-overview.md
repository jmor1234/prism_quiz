# Prism Questions - Project Overview

## Purpose

Lead generation quiz tool for Prism Therapeutics. Prospects complete a 10-question health assessment and receive an instant mini-report identifying their 3 most important health patterns through the bioenergetic lens.

**Flow:** Ad Click → Quiz → Instant Analysis → Book Consultation CTA

---

## Core Architecture

### Design Principle

Provide the agent with comprehensive knowledge and clear intent. The agent reasons holistically across all answers to identify patterns - no prescriptive mappings or rigid rules.

```
Knowledge Foundation (knowledge.md, questionaire.md, diet_lifestyle_standardized.md)
                    ↓
         10 Quiz Answers
                    ↓
      Agent Holistic Analysis
                    ↓
       3 Key Patterns + CTA
```

### Key Differences from Report System

| Aspect | Report System | Quiz System |
|--------|---------------|-------------|
| Purpose | Comprehensive client report | Lead generation |
| Input | Expert notes + client data + lab PDFs | 10 quick questions |
| Output | Full recommendations + citations | 3 patterns, no recommendations |
| Duration | 6-10 minutes | 5-15 seconds |
| Complexity | Multi-phase, tools, sub-agents | Single-shot generation |

---

## Directory Structure

### Backend

```
app/api/
├── quiz/
│   ├── route.ts          # POST endpoint: validate → save → generate → return
│   ├── systemPrompt.ts   # Builds prompt with knowledge + formatted answers
│   ├── pdf/              # PDF export endpoint
│   └── result/           # Result retrieval endpoint
└── admin/
    └── results/
        └── route.ts      # GET endpoint: list submissions (password protected)

server/
├── quizSubmissions.ts    # Submission storage + listing (dev: filesystem, prod: Upstash)
└── quizResults.ts        # Results storage (dev: filesystem, prod: Upstash)

lib/
├── schemas/
│   └── quiz.ts           # Zod schema for quiz submission
├── quizStorage.ts        # Client-side localStorage persistence (result + retry state)
└── knowledge/
    ├── knowledge.md              # Bioenergetic foundation (3 pillars)
    ├── questionaire.md           # Symptom → implication interpretation
    └── diet_lifestyle_standardized.md  # Diet analysis framework
```

### Frontend

```
app/
├── quiz/
│   └── page.tsx          # Quiz form + inline result display
└── admin/
    └── results/
        └── page.tsx      # Admin dashboard for viewing submissions
```

### Storage (Dev vs Prod)

```
Dev (filesystem):
storage/
├── quiz-submissions/<id>.json
└── quiz-results/<id>.json

Prod (Upstash Redis):
Keys: quiz-submissions:<id>, quiz-results:<id>, quiz-index (sorted set)
Env: UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN

Client (localStorage):
Key: prism-quiz
Value: { v: 1, id: "uuid", report: "..." | null }
```

### Error Handling & Retry

Handles transient LLM API failures without creating duplicate submissions:

```
Submit → Save submission → [LLM fails] → Return submissionId in error
                                              ↓
                                    Client stores in localStorage
                                              ↓
                          Page refresh → Restore retry UI from localStorage
                                              ↓
                              Retry → POST with submissionId → Uses stored submission
```

- **Submission saved before LLM call** — no data loss on failure
- **submissionId returned on error** — enables retry without duplicate
- **Existing result check** — if result exists, returns immediately (no re-generation)
- **localStorage persistence** — survives page refresh, shows result or retry UI

---

## The 10 Questions

| # | Question | Type |
|---|----------|------|
| 1 | Energy levels (1-10) | Slider |
| 2 | Crash after lunch? | Yes/No |
| 3 | Difficulty waking? | Yes/No |
| 4 | Wake at night? Why? | Yes/No + conditional multi-select |
| 5 | Brain fog? | Yes/No |
| 6 | Bowel issues? | Multi-select |
| 7 | Cold extremities? | Yes/No |
| 8 | White tongue coating? | Yes/No |
| 9 | Typical eating | Free text |
| 10 | Health goals | Free text |

**Contact:** Name (required)

---

## API

### POST /api/quiz

**Request (new submission):**
```json
{
  "name": "User Name",
  "energyLevel": 4,
  "crashAfterLunch": true,
  "difficultyWaking": true,
  "wakeAtNight": { "wakes": true, "reasons": ["eat", "pee"] },
  "brainFog": true,
  "bowelIssues": ["straining", "incomplete"],
  "coldExtremities": true,
  "whiteTongue": true,
  "typicalEating": "Oatmeal, sandwich, pasta...",
  "healthGoals": "More energy, better sleep..."
}
```

**Request (retry after error):**
```json
{
  "submissionId": "uuid"
}
```

When `submissionId` is provided, the endpoint uses the stored submission data (no duplicate created). If a result already exists, it returns immediately without re-generation.

**Response (success):**
```json
{
  "id": "uuid",
  "report": "## Your Health Assessment\n\n..."
}
```

**Response (error):**
```json
{
  "error": "Error message",
  "submissionId": "uuid"
}
```

The `submissionId` is returned on error so the client can retry without creating duplicates.

### GET /api/admin/results

Returns list of quiz submissions with AI assessments. Requires password authentication.

**Query params:**
- `key` (required): Admin password
- `limit` (optional): Max entries to return (default 100, max 500)

**Response:**
```json
{
  "entries": [
    {
      "id": "uuid",
      "createdAt": "2026-01-27T10:42:00.000Z",
      "submission": { /* quiz answers */ },
      "report": "## Your Health Assessment\n\n..."
    }
  ]
}
```

---

## Output Format

Markdown with:
- Personalized opening
- 3 pattern sections (title + 2-3 sentence explanation)
- Booking CTA (button links to https://go.prism.miami/formconsultation)

No recommendations. No citations. Brief and engaging.

---

## Environment Variables

```
# Required for API
ANTHROPIC_API_KEY=

# Required for production storage
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

# Required for admin dashboard access
ADMIN_PASSWORD=
```

---

## Admin Dashboard

View quiz submissions and AI assessments at `/admin/results`.

**Authentication:** Password-protected via `ADMIN_PASSWORD` env var. Password is stored in sessionStorage (clears on browser close).

**Features:**
- List of all submissions (newest first)
- Click to expand and view quiz answers + AI assessment
- Visual indicators: energy level bar, yes/no badges, issue tags
- Refresh button to reload data
- Dark mode support

**Note:** Only submissions created after the indexing feature was deployed will appear. Older submissions in Redis are not retroactively indexed.

---

## Local Development

```bash
npm run dev
# Navigate to http://localhost:3000/quiz
```

Submissions stored in `storage/quiz-submissions/` and `storage/quiz-results/` during dev.
