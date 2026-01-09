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
app/api/quiz/
├── route.ts              # POST endpoint: validate → save → generate → return
└── systemPrompt.ts       # Builds prompt with knowledge + formatted answers

server/
├── quizSubmissions.ts    # Submission storage (dev: filesystem, prod: Upstash)
└── quizResults.ts        # Results storage (dev: filesystem, prod: Upstash)

lib/
├── schemas/
│   └── quiz.ts           # Zod schema for quiz submission
└── knowledge/
    ├── knowledge.md              # Bioenergetic foundation (3 pillars)
    ├── questionaire.md           # Symptom → implication interpretation
    └── diet_lifestyle_standardized.md  # Diet analysis framework
```

### Frontend

```
app/quiz/
└── page.tsx              # Quiz form + inline result display
```

### Storage (Dev vs Prod)

```
Dev (filesystem):
storage/
├── quiz-submissions/<id>.json
└── quiz-results/<id>.json

Prod (Upstash Redis):
Keys: quiz-submissions:<id>, quiz-results:<id>
Env: QUIZ_UPSTASH_REDIS_REST_URL, QUIZ_UPSTASH_REDIS_REST_TOKEN
```

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

**Contact:** Email (required), Name (optional), Phone (optional)

---

## API

### POST /api/quiz

**Request:**
```json
{
  "email": "user@example.com",
  "name": "Optional Name",
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

**Response:**
```json
{
  "id": "uuid",
  "report": "## Your Health Assessment\n\n..."
}
```

---

## Output Format

Markdown with:
- Personalized opening
- 3 pattern sections (title + 2-3 sentence explanation)
- Booking CTA linking to https://prism.miami/booking

No recommendations. No citations. Brief and engaging.

---

## Environment Variables

```
# Required for API
ANTHROPIC_API_KEY=

# Required for production storage
QUIZ_UPSTASH_REDIS_REST_URL=
QUIZ_UPSTASH_REDIS_REST_TOKEN=
```

---

## Local Development

```bash
npm run dev
# Navigate to http://localhost:3000/quiz
```

Submissions stored in `storage/quiz-submissions/` and `storage/quiz-results/` during dev.
