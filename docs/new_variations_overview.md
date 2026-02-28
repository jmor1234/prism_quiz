# Multi-Variant Quiz Architecture

## Design for extending the Prism root cause quiz into 11 condition-specific quiz variants within a single codebase.

---

## Overview

The existing root cause quiz becomes one of 11 variants. Each variant shares the same infrastructure (UI engine, storage, retry, admin, PDF, UTM tracking) but has its own questions, prompt focus, landing copy, and metadata. A variant is defined entirely by a config object — no code changes required to add variant #12.

### The 11 Variants

| Slug | Name | Entry Point |
|------|------|-------------|
| `root-cause` | Root Cause Assessment | General health patterns |
| `gut` | Gut Health Assessment | IBS, bloating, SIBO, digestion |
| `fatigue` | Energy & Fatigue Assessment | Chronic fatigue, low energy |
| `hormones-women` | Women's Hormonal Assessment | Estrogen, PCOS, cycle issues |
| `testosterone` | Men's Hormone & Performance Assessment | Low T, muscle, vitality |
| `sleep` | Sleep Assessment | Insomnia, waking, non-restorative sleep |
| `thyroid` | Thyroid & Metabolism Assessment | "Labs normal but feel terrible" |
| `brain-fog` | Brain Fog & Cognitive Assessment | Focus, memory, mental clarity |
| `weight` | Weight & Body Composition Assessment | Can't lose weight despite effort |
| `skin` | Skin Health Assessment | Acne, eczema, gut-skin axis |
| `anxiety` | Anxiety & Mood Assessment | Gut-brain axis, serotonin reframe |

---

## Routing

```
/quiz                 → redirect to /quiz/root-cause (preserves existing links)
/quiz/[variant]       → dynamic route, renders quiz for that variant
/admin/results        → all variants, filterable
```

The existing `/quiz` URL continues to work via redirect. Each variant gets a clean shareable link: `prismquiz.com/quiz/gut`, `prismquiz.com/quiz/testosterone`, etc.

### Implementation

```
app/
├── quiz/
│   ├── page.tsx                    # Redirect to /quiz/root-cause
│   └── [variant]/
│       └── page.tsx                # Dynamic quiz page — loads variant config by slug
```

The `[variant]/page.tsx` receives the slug from params, looks up the variant config, and renders the shared quiz engine with that config.

---

## Variant Config Structure

Each variant is a single config object. This is the complete contract — everything the system needs to render, validate, generate, and display a quiz.

```typescript
// lib/quiz/types.ts

type QuestionType = 'slider' | 'yes_no' | 'multi_select' | 'free_text' | 'single_select';

interface SliderConfig {
  type: 'slider';
  min: number;
  max: number;
  default: number;
  lowLabel: string;       // e.g. "Exhausted"
  highLabel: string;      // e.g. "Energized"
  qualifiers?: {          // optional labels for ranges
    low: { max: number; label: string };     // e.g. { max: 4, label: "low" }
    mid: { max: number; label: string };     // e.g. { max: 6, label: "moderate" }
    high: { label: string };                 // e.g. { label: "good" }
  };
}

interface YesNoConfig {
  type: 'yes_no';
  conditionalFollowUp?: {       // optional follow-up when answer is "yes"
    prompt: string;              // e.g. "If so, why? (select all that apply)"
    options: { value: string; label: string }[];
  };
}

interface MultiSelectConfig {
  type: 'multi_select';
  options: { value: string; label: string }[];
  hint?: string;                 // e.g. "Select all that apply, or skip if none"
  required?: boolean;            // default false — empty selection is valid
}

interface SingleSelectConfig {
  type: 'single_select';
  options: { value: string; label: string }[];
}

interface FreeTextConfig {
  type: 'free_text';
  placeholder: string;
  rows?: number;                 // default 4
  required?: boolean;            // default true
}

type QuestionConfig = {
  id: string;                    // unique key for this question (e.g. "energyLevel", "bloatingFrequency")
  question: string;              // the question text displayed to the user
  hint?: string;                 // optional subtitle/help text
} & (SliderConfig | YesNoConfig | MultiSelectConfig | SingleSelectConfig | FreeTextConfig);

interface VariantConfig {
  // Identity
  slug: string;                  // URL path segment (e.g. "gut")
  name: string;                  // display name (e.g. "Gut Health Assessment")
  description: string;           // meta description / OG description

  // Questions
  questions: QuestionConfig[];   // ordered list — each becomes one wizard step
  nameField: {                   // the name collection step (always last before submit)
    question: string;            // e.g. "What's your name?"
    hint: string;                // e.g. "We'll personalize your assessment"
  };

  // Landing / UI copy
  headline: string;              // e.g. "Discover What's Really Driving Your Gut Issues"
  subtitle?: string;             // optional subheading
  resultBanner: string;          // e.g. "Your personalized gut health assessment is ready"
  ctaText: string;               // e.g. "Book a Free Consultation"

  // Prompt
  promptOverlay: string;         // variant-specific system prompt section (see Prompt Architecture)

  // OG / Social metadata
  ogImage?: string;              // path to variant-specific OG image
}
```

### Example: Root Cause Variant Config (migrating the existing quiz)

```typescript
// lib/quiz/variants/root-cause.ts

import { VariantConfig } from '../types';

export const rootCauseConfig: VariantConfig = {
  slug: 'root-cause',
  name: 'Root Cause Health Assessment',
  description: 'Trace health symptoms to root causes through energy metabolism, gut health, and stress cascades',

  questions: [
    {
      id: 'energyLevel',
      question: 'Rate your average energy levels throughout the day',
      hint: '1 = barely able to function, 10 = perfect energy all day',
      type: 'slider',
      min: 1,
      max: 10,
      default: 5,
      lowLabel: 'Exhausted',
      highLabel: 'Energized',
      qualifiers: {
        low: { max: 4, label: 'low' },
        mid: { max: 6, label: 'moderate' },
        high: { label: 'good' },
      },
    },
    {
      id: 'crashAfterLunch',
      question: 'Do you tend to crash in energy after lunch?',
      type: 'yes_no',
    },
    {
      id: 'difficultyWaking',
      question: 'Do you have difficulty getting up in the morning?',
      type: 'yes_no',
    },
    {
      id: 'wakeAtNight',
      question: 'Do you wake up in the middle of the night?',
      type: 'yes_no',
      conditionalFollowUp: {
        prompt: 'If so, why? (select all that apply)',
        options: [
          { value: 'no_reason', label: 'No apparent reason' },
          { value: 'eat', label: 'To eat' },
          { value: 'drink', label: 'To drink' },
          { value: 'pee', label: 'To urinate' },
        ],
      },
    },
    {
      id: 'brainFog',
      question: 'Do you experience brain fog, or impaired motivation, cognitive function, or memory?',
      type: 'yes_no',
    },
    {
      id: 'bowelIssues',
      question: 'Do you experience any of the following with your bowel movements?',
      hint: 'Select all that apply, or skip if none',
      type: 'multi_select',
      options: [
        { value: 'straining', label: 'Straining' },
        { value: 'pain', label: 'Pain' },
        { value: 'incomplete', label: 'Incomplete emptying' },
        { value: 'diarrhea', label: 'Diarrhea' },
        { value: 'smell', label: 'Excessive smell/mess' },
      ],
      required: false,
    },
    {
      id: 'coldExtremities',
      question: 'Do you frequently get cold, especially at the fingers, toes, nose, or ears?',
      type: 'yes_no',
    },
    {
      id: 'whiteTongue',
      question: 'Do you notice a white coating on your tongue, especially in the morning?',
      type: 'yes_no',
    },
    {
      id: 'typicalEating',
      question: 'Describe a typical day of eating for you',
      hint: 'Include breakfast, lunch, dinner, snacks, and drinks',
      type: 'free_text',
      placeholder: 'Example: Coffee and toast for breakfast, salad for lunch, pasta for dinner...',
      rows: 5,
    },
    {
      id: 'healthGoals',
      question: 'What health goals are you looking to achieve?',
      hint: 'What would feeling your best look like for you?',
      type: 'free_text',
      placeholder: 'Example: More energy, better sleep, improved focus...',
      rows: 4,
    },
  ],

  nameField: {
    question: "What's your name?",
    hint: "We'll personalize your assessment with your name",
  },

  headline: 'Prism Health Assessment',
  subtitle: 'Trace your symptoms to their root causes',
  resultBanner: 'Your personalized assessment is ready',
  ctaText: 'Book a Free Consultation',

  promptOverlay: '', // The original root cause quiz has no overlay — the base prompt IS the root cause prompt

  ogImage: '/og/root-cause.png',
};
```

### Variant Config Registry

```typescript
// lib/quiz/variants/index.ts

import { rootCauseConfig } from './root-cause';
import { gutConfig } from './gut';
import { fatigueConfig } from './fatigue';
// ... all 11

import type { VariantConfig } from '../types';

const variants: Record<string, VariantConfig> = {
  'root-cause': rootCauseConfig,
  'gut': gutConfig,
  'fatigue': fatigueConfig,
  'hormones-women': hormonesWomenConfig,
  'testosterone': testosteroneConfig,
  'sleep': sleepConfig,
  'thyroid': thyroidConfig,
  'brain-fog': brainFogConfig,
  'weight': weightConfig,
  'skin': skinConfig,
  'anxiety': anxietyConfig,
};

export function getVariant(slug: string): VariantConfig | undefined {
  return variants[slug];
}

export function getAllVariants(): VariantConfig[] {
  return Object.values(variants);
}

export function getVariantSlugs(): string[] {
  return Object.keys(variants);
}
```

---

## Question Design Principles

Each variant should have **8-12 questions** that follow this structure:

1. **Anchor question** (1-2) — the primary symptom/concern that brought them here. High signal, sets the frame.
2. **Condition-specific questions** (4-6) — targeted symptoms that help the agent identify patterns *within* this condition. These are what differentiate variants.
3. **Cross-system signals** (2-3) — symptoms from adjacent systems that reveal root causes. Gut quiz asks about energy and mood. Testosterone quiz asks about sleep and digestion. This is where the bioenergetic interconnections surface.
4. **Lifestyle/diet** (1) — free text eating pattern. Present in every variant because diet is always relevant through the bioenergetic lens.
5. **Goals** (1) — free text. Always last content question. Anchors personalization.
6. **Name** — always the final step.

### Universal Questions (appear in most/all variants)

Some questions are so broadly informative through the bioenergetic lens that they appear across many variants, potentially with variant-specific framing:

- **Energy level** (slider) — baseline metabolic signal, relevant to every condition
- **Typical eating** (free text) — PUFAs, salt, meal timing, all relevant everywhere
- **Health goals** (free text) — personalization anchor

### Cross-Variant Question Reuse

Questions can share the same `id` across variants when they're identical. This means:
- The same answer formatting logic applies
- Admin can compare answers across variants when the id matches
- But each variant can also have unique question ids for condition-specific questions

---

## Schema & Validation

### Dynamic Zod Schema Generation

Instead of one hardcoded schema, build the Zod schema from the variant config at runtime:

```typescript
// lib/quiz/schema.ts

import { z } from 'zod';
import type { QuestionConfig, VariantConfig } from './types';

function questionToZodField(q: QuestionConfig): z.ZodTypeAny {
  switch (q.type) {
    case 'slider':
      return z.number().min(q.min).max(q.max);

    case 'yes_no':
      if (q.conditionalFollowUp) {
        return z.object({
          answer: z.boolean(),
          followUp: z.array(z.string()).optional(),
        });
      }
      return z.boolean();

    case 'multi_select':
      const validValues = q.options.map(o => o.value);
      const arraySchema = z.array(z.enum(validValues as [string, ...string[]]));
      return q.required ? arraySchema.min(1) : arraySchema;

    case 'single_select':
      const validOptions = q.options.map(o => o.value);
      return z.enum(validOptions as [string, ...string[]]);

    case 'free_text':
      return q.required !== false ? z.string().min(1) : z.string();
  }
}

export function buildSubmissionSchema(variant: VariantConfig) {
  const answerFields: Record<string, z.ZodTypeAny> = {};
  for (const q of variant.questions) {
    answerFields[q.id] = questionToZodField(q);
  }

  return z.object({
    variant: z.literal(variant.slug),
    name: z.string().min(1),
    answers: z.object(answerFields),
  });
}
```

### Submission Shape

```typescript
// What the client sends
interface QuizSubmissionPayload {
  variant: string;
  name: string;
  answers: Record<string, unknown>; // validated per-variant
}

// What gets stored
interface QuizSubmissionRecord {
  id: string;
  variant: string;               // NEW — which quiz variant
  createdAt: string;
  name: string;
  answers: Record<string, unknown>;
}
```

### Migration: Existing Root Cause Submissions

Existing submissions in Redis don't have a `variant` field. The storage layer should default missing variant to `'root-cause'`:

```typescript
// In quizSubmissions.ts, when reading
const record = JSON.parse(raw);
record.variant = record.variant ?? 'root-cause';
```

---

## Storage Changes

### Redis Key Patterns

```
quiz-submissions:{uuid}          # unchanged — submission data (now includes variant field)
quiz-results:{uuid}              # unchanged — result data (now includes variant field)
quiz-index                       # global index — all variants (existing entries remain)
quiz-index:{variant}             # per-variant index — for filtered listing
```

### Dual Index Strategy

When saving a submission, write to both the global index and the variant-specific index:

```typescript
// On save
await redis.zadd('quiz-index', { score: timestamp, member: id });
await redis.zadd(`quiz-index:${variant}`, { score: timestamp, member: id });
```

This enables:
- **Admin dashboard**: list all (global index) or filter by variant (variant index)
- **No migration needed**: existing entries stay in global index, just lack variant index entries

### Filesystem (Dev)

Add variant to the filename or as a field in the JSON. Filtering in dev can just read the JSON and check the variant field since volume is low.

---

## Client-Side Storage

### localStorage Keying

Change from single key to variant-scoped keys:

```
prism-quiz:{variant}     →  { v: 2, id: "uuid", report: "..." | null }
prism-utm                →  unchanged (UTM is global, not per-variant)
```

This means a user can have results stored for multiple variants simultaneously. Completing the gut quiz doesn't erase their root cause quiz result.

### Migration

If `prism-quiz` (v1, no variant) exists in localStorage, treat it as `prism-quiz:root-cause` on first read, then migrate:

```typescript
// In quizStorage.ts
function migrateV1() {
  const old = localStorage.getItem('prism-quiz');
  if (old) {
    const parsed = JSON.parse(old);
    if (parsed.v === 1) {
      localStorage.setItem('prism-quiz:root-cause', JSON.stringify({ ...parsed, v: 2 }));
      localStorage.removeItem('prism-quiz');
    }
  }
}
```

---

## Answer Formatting (for System Prompt)

Replace the hardcoded `formatAnswers()` with a generic formatter driven by question configs:

```typescript
// lib/quiz/formatAnswers.ts

function formatAnswers(
  variant: VariantConfig,
  name: string,
  answers: Record<string, unknown>
): string {
  const lines: string[] = [];
  lines.push(`**Name:** ${name}`);

  for (const q of variant.questions) {
    const value = answers[q.id];
    lines.push(formatSingleAnswer(q, value));
  }

  return lines.join('\n\n');
}

function formatSingleAnswer(q: QuestionConfig, value: unknown): string {
  const label = q.question; // or a shorter display label if added to config

  switch (q.type) {
    case 'slider': {
      const num = value as number;
      let qualifier = '';
      if (q.qualifiers) {
        if (num <= q.qualifiers.low.max) qualifier = ` (${q.qualifiers.low.label})`;
        else if (num <= q.qualifiers.mid.max) qualifier = ` (${q.qualifiers.mid.label})`;
        else qualifier = ` (${q.qualifiers.high.label})`;
      }
      return `**${label}:** ${num}/${q.max}${qualifier}`;
    }

    case 'yes_no': {
      if (q.conditionalFollowUp) {
        const obj = value as { answer: boolean; followUp?: string[] };
        if (obj.answer && obj.followUp?.length) {
          const reasons = obj.followUp
            .map(v => q.conditionalFollowUp!.options.find(o => o.value === v)?.label ?? v)
            .join(', ');
          return `**${label}:** Yes (${reasons})`;
        }
        return `**${label}:** ${obj.answer ? 'Yes' : 'No'}`;
      }
      return `**${label}:** ${value ? 'Yes' : 'No'}`;
    }

    case 'multi_select': {
      const selected = value as string[];
      if (selected.length === 0) return `**${label}:** None reported`;
      const labels = selected
        .map(v => q.options.find(o => o.value === v)?.label ?? v)
        .join(', ');
      return `**${label}:** ${labels}`;
    }

    case 'single_select': {
      const selected = value as string;
      const optLabel = q.options.find(o => o.value === selected)?.label ?? selected;
      return `**${label}:** ${optLabel}`;
    }

    case 'free_text':
      return `**${label}:**\n${value}`;
  }
}
```

This replaces the entire hardcoded `formatAnswers()` in `systemPrompt.ts`. The agent sees the same clean text format regardless of which variant generated it.

---

## System Prompt Architecture

### Structure

```
Base prompt (shared across all variants)
├── Context: Prism identity, bioenergetic lens
├── Knowledge Foundation (3 shared files)
│   ├── knowledge.md
│   ├── questionaire.md
│   └── diet_lifestyle_standardized.md
├── Base behavioral instructions
│
├── Variant Overlay (injected per-variant)  ← NEW
│   ├── Condition focus and framing
│   ├── What to look for in this population
│   ├── How the bioenergetic lens applies to this condition
│   └── Output framing adjustments
│
├── Formatted quiz answers
│
└── Output format + constraints (shared)
```

### Variant Prompt Overlay

Each variant config includes a `promptOverlay` string that gets injected between the knowledge foundation and the quiz answers. This is the key differentiator — it tells the agent *how* to think about this specific condition.

The overlay should include:

1. **Focus statement** — what condition this quiz targets and why
2. **Population context** — who takes this quiz and what they've likely tried/experienced
3. **Key mechanisms to look for** — which bioenergetic connections are most relevant
4. **Pattern framing** — how to frame the 3 patterns for this audience

### Example: Gut Health Overlay

```
## Condition Focus: Gut Health

This person is specifically concerned about digestive issues. They likely experience some combination
of bloating, irregular bowel movements, food sensitivities, or abdominal discomfort. Many have been
told they have IBS, SIBO, or similar diagnoses without getting real resolution.

Through the bioenergetic lens, gut dysfunction is never isolated. Look for how their gut symptoms
connect to:
- Energy metabolism (thyroid function drives gut motility, enzyme secretion, and immune function)
- Stress cascades (cortisol and adrenaline directly suppress digestive function; serotonin produced
  by gut irritation drives further symptoms)
- The bidirectional gut-system connections (gut inflammation driving brain fog, mood issues, skin
  problems, hormonal disruption, fatigue)

When identifying patterns, frame them in terms of *what is driving the gut dysfunction*, not just
describing the dysfunction itself. The insight these people need is: your gut problems aren't random
or isolated, they're connected to these deeper systems, and addressing the root cause is what
actually resolves them.

Their stated digestive symptoms are the entry point. The patterns you surface should show them
the deeper picture they haven't seen.
```

### Example: Testosterone Overlay

```
## Condition Focus: Men's Hormones & Testosterone

This person wants to optimize testosterone, build muscle, or restore vitality. They've likely tried
the standard advice: lift heavy, sleep more, take zinc and ashwagandha. Some may be considering TRT.
Many are frustrated that "doing everything right" hasn't moved the needle.

Through the bioenergetic lens, testosterone is downstream of energy metabolism. Look for:
- Gut dysfunction suppressing androgen production (endotoxin directly inhibits testosterone synthesis)
- Stress hormone competition (cortisol and testosterone share precursors; chronic stress steals resources)
- Thyroid and metabolic rate (low metabolic rate means low hormone production across the board)
- Dietary factors (PUFAs decrease androgens; caloric restriction increases stress hormones that
  suppress T; estrogen-promoting factors from gut dysfunction)
- Sleep quality (stress hormones disrupting recovery when testosterone should be produced)

The reframe for this audience: your testosterone isn't low because you need a supplement or injection.
It's low because your body's energy production system is compromised, and that's suppressing hormone
production as a downstream consequence. The patterns should connect their symptoms to root causes
that explain WHY testosterone is low, not just confirm that it is.
```

### Prompt Assembly

```typescript
// app/api/quiz/systemPrompt.ts (refactored)

export async function buildQuizPrompt(
  variant: VariantConfig,
  name: string,
  answers: Record<string, unknown>
) {
  const { knowledgeBase, questionnaireGuide, dietLifestyleGuide } = await loadKnowledge();
  const formattedAnswers = formatAnswers(variant, name, answers);

  const questionCount = variant.questions.length;

  const prompt = `
# Context

You are assisting Prism Health, a bioenergetic health practice. A prospective client has just
completed a brief health assessment quiz focused on ${variant.name.toLowerCase()}.
Your role is to analyze their answers holistically and identify the most important health
patterns through the bioenergetic lens.

# Knowledge Foundation

<bioenergetic_knowledge>
${knowledgeBase}
</bioenergetic_knowledge>

<symptom_interpretation_guide>
${questionnaireGuide}
</symptom_interpretation_guide>

<diet_lifestyle_context>
${dietLifestyleGuide}
</diet_lifestyle_context>

${variant.promptOverlay ? `# Condition-Specific Guidance\n\n${variant.promptOverlay}` : ''}

# Client's Quiz Answers

${formattedAnswers}

# Your Task

Analyze the answers holistically. Identify the meaningful patterns that emerge — how symptoms
interconnect, what they suggest about underlying energy and metabolism. Let the data guide how
many patterns you surface.

For each pattern: give it a clear title and a brief explanation that references their specific
answers and connects to their goals.

# Output Format
... [same as current — shared across all variants]

# Closing Guidance
... [same as current — shared across all variants]

# Important
... [same as current — shared across all variants]
`.trim();

  return [{ role: 'user' as const, content: prompt }];
}
```

---

## Quiz Page (Frontend)

### Data-Driven Wizard

The current 1007-line `page.tsx` with its `renderStepContent()` switch statement gets replaced by a generic quiz engine that renders any variant from its config.

**Key components:**

```
QuizPage (app/quiz/[variant]/page.tsx)
  → loads variant config by slug
  → passes config to QuizWizard

QuizWizard (components/quiz/quiz-wizard.tsx)
  → manages form state as Record<string, unknown>
  → manages step navigation
  → renders QuestionStep for current step
  → handles submit

QuestionStep (components/quiz/question-step.tsx)
  → receives QuestionConfig + value + onChange
  → dispatches to type-specific renderers

Type Renderers (components/quiz/questions/)
  ├── SliderQuestion
  ├── YesNoQuestion
  ├── MultiSelectQuestion
  ├── SingleSelectQuestion
  ├── FreeTextQuestion
  └── NameStep
```

### Form State

Instead of a typed `FormState` interface per variant, the form state is a generic `Record<string, unknown>` where keys are question ids:

```typescript
// Initial state derived from config
function buildInitialState(variant: VariantConfig): Record<string, unknown> {
  const state: Record<string, unknown> = {};
  for (const q of variant.questions) {
    switch (q.type) {
      case 'slider': state[q.id] = q.default; break;
      case 'yes_no':
        state[q.id] = q.conditionalFollowUp
          ? { answer: null, followUp: [] }
          : null;
        break;
      case 'multi_select': state[q.id] = []; break;
      case 'single_select': state[q.id] = null; break;
      case 'free_text': state[q.id] = ''; break;
    }
  }
  return state;
}
```

### Step Validation

Generic per-type validation replaces the hardcoded `isStepValid()` switch:

```typescript
function isStepValid(q: QuestionConfig, value: unknown): boolean {
  switch (q.type) {
    case 'slider': return true; // always has a value
    case 'yes_no':
      if (q.conditionalFollowUp) {
        return (value as { answer: boolean | null }).answer !== null;
      }
      return value !== null;
    case 'multi_select': return !q.required || (value as string[]).length > 0;
    case 'single_select': return value !== null;
    case 'free_text': return q.required !== false ? (value as string).trim().length > 0 : true;
  }
}
```

### Test Data Generator

The existing `generateTestData()` becomes generic:

```typescript
function generateTestData(variant: VariantConfig): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  for (const q of variant.questions) {
    switch (q.type) {
      case 'slider':
        data[q.id] = Math.floor(Math.random() * (q.max - q.min + 1)) + q.min;
        break;
      case 'yes_no':
        const answer = Math.random() > 0.5;
        if (q.conditionalFollowUp) {
          data[q.id] = {
            answer,
            followUp: answer
              ? q.conditionalFollowUp.options.filter(() => Math.random() > 0.5).map(o => o.value)
              : [],
          };
        } else {
          data[q.id] = answer;
        }
        break;
      case 'multi_select':
        data[q.id] = q.options.filter(() => Math.random() > 0.5).map(o => o.value);
        break;
      case 'single_select':
        data[q.id] = q.options[Math.floor(Math.random() * q.options.length)].value;
        break;
      case 'free_text':
        data[q.id] = '[Test data placeholder]';
        break;
    }
  }
  return data;
}
```

---

## Admin Dashboard

### Dynamic Answer Display

Replace the hardcoded `QuizAnswersDisplay` with a generic renderer that works for any variant:

```typescript
// components/admin/quiz-answers-display.tsx

function QuizAnswersDisplay({
  variant,
  answers,
}: {
  variant: VariantConfig;
  answers: Record<string, unknown>;
}) {
  // Group questions by type for layout
  const sliders = variant.questions.filter(q => q.type === 'slider');
  const booleans = variant.questions.filter(q => q.type === 'yes_no');
  const selects = variant.questions.filter(q => q.type === 'multi_select' || q.type === 'single_select');
  const freeText = variant.questions.filter(q => q.type === 'free_text');

  return (
    <div>
      {/* Variant badge */}
      <VariantBadge slug={variant.slug} name={variant.name} />

      {/* Sliders */}
      {sliders.map(q => <SliderDisplay key={q.id} question={q} value={answers[q.id]} />)}

      {/* Yes/No grid */}
      <div className="grid grid-cols-2 gap-4">
        {booleans.map(q => <YesNoDisplay key={q.id} question={q} value={answers[q.id]} />)}
      </div>

      {/* Multi-selects */}
      {selects.map(q => <SelectDisplay key={q.id} question={q} value={answers[q.id]} />)}

      {/* Free text */}
      {freeText.map(q => <FreeTextDisplay key={q.id} question={q} value={answers[q.id]} />)}
    </div>
  );
}
```

### Variant Filtering

The admin dashboard gets a variant filter dropdown:

```
[All Variants ▾]  [Refresh]  [Mode Toggle]  [Logout]
```

Filtering calls the API with a `variant` query param, which uses the per-variant Redis index.

### Admin API Changes

```typescript
// GET /api/admin/results?key=xxx&variant=gut&limit=100

if (variant) {
  // Use variant-specific index
  entries = await listQuizEntries(limit, cursor, variant);
} else {
  // Use global index
  entries = await listQuizEntries(limit, cursor);
}
```

---

## Admin PDF

Replace the hardcoded HTML table builder with a generic renderer:

```typescript
function buildAnswersHtml(variant: VariantConfig, answers: Record<string, unknown>): string {
  let html = '<table class="answers-table">';

  for (const q of variant.questions) {
    html += `<tr><td class="label">${escapeHtml(q.question)}</td>`;
    html += `<td class="value">${formatAnswerForHtml(q, answers[q.id])}</td></tr>`;
  }

  html += '</table>';
  return html;
}
```

Uses the same question configs as everything else — zero hardcoding.

---

## API Route Changes

### POST /api/quiz

The route needs minimal changes:

```typescript
export async function POST(req: Request) {
  const body = await req.json();

  // Handle retry case (unchanged logic)
  if (body.submissionId) { /* ... same as before ... */ }

  // New submission: resolve variant
  const variantSlug = body.variant;
  const variant = getVariant(variantSlug);
  if (!variant) {
    return Response.json({ error: `Unknown quiz variant: ${variantSlug}` }, { status: 400 });
  }

  // Validate against variant-specific schema
  const schema = buildSubmissionSchema(variant);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: 'Invalid submission', details: parsed.error.flatten() }, { status: 400 });
  }

  // Save with variant field
  const record = await upsertQuizSubmission({
    variant: variantSlug,
    name: parsed.data.name,
    answers: parsed.data.answers,
  });

  // Build prompt with variant config
  const messages = await buildQuizPrompt(variant, parsed.data.name, parsed.data.answers);

  // Generate (same as before)
  const result = await generateText({ model: anthropic('claude-opus-4-6'), messages });

  // Save result with variant field
  await saveQuizResult({ id: record.id, variant: variantSlug, report: result.text });

  return Response.json({ id: record.id, report: result.text });
}
```

---

## File Structure After Refactor

```
lib/
├── quiz/
│   ├── types.ts                    # QuestionConfig, VariantConfig, QuestionType
│   ├── schema.ts                   # buildSubmissionSchema() — dynamic Zod from config
│   ├── formatAnswers.ts            # Generic answer formatter for prompt
│   └── variants/
│       ├── index.ts                # Registry: getVariant(), getAllVariants()
│       ├── root-cause.ts
│       ├── gut.ts
│       ├── fatigue.ts
│       ├── hormones-women.ts
│       ├── testosterone.ts
│       ├── sleep.ts
│       ├── thyroid.ts
│       ├── brain-fog.ts
│       ├── weight.ts
│       ├── skin.ts
│       └── anxiety.ts
├── quizStorage.ts                  # Updated: variant-scoped localStorage keys
├── utmStorage.ts                   # Unchanged
└── knowledge/                      # Unchanged — shared across all variants
    ├── knowledge.md
    ├── questionaire.md
    └── diet_lifestyle_standardized.md

app/
├── quiz/
│   ├── page.tsx                    # Redirect to /quiz/root-cause
│   └── [variant]/
│       └── page.tsx                # Loads variant config → renders QuizWizard
├── admin/results/
│   └── page.tsx                    # Updated: dynamic answer display + variant filter

components/
├── quiz/
│   ├── quiz-wizard.tsx             # Generic wizard engine
│   ├── question-step.tsx           # Type dispatcher
│   ├── questions/
│   │   ├── slider-question.tsx
│   │   ├── yes-no-question.tsx
│   │   ├── multi-select-question.tsx
│   │   ├── single-select-question.tsx
│   │   ├── free-text-question.tsx
│   │   └── name-step.tsx
│   ├── quiz-result.tsx             # Result display (shared)
│   └── quiz-loading.tsx            # Loading animation (shared)
├── admin/
│   └── quiz-answers-display.tsx    # Generic answer renderer
```

---

## Implementation Order

### Phase 1: Refactor existing quiz into variant system
1. Define `types.ts` — QuestionConfig, VariantConfig
2. Create `variants/root-cause.ts` — migrate existing quiz as first variant config
3. Create `schema.ts` — dynamic Zod builder
4. Create `formatAnswers.ts` — generic formatter
5. Refactor `systemPrompt.ts` to use `buildQuizPrompt()`
6. Refactor `route.ts` to accept variant field
7. Update storage layer — add variant field, dual index
8. Update localStorage — variant-scoped keys with v1 migration
9. Extract quiz UI components from monolithic `page.tsx`
10. Create `[variant]/page.tsx` dynamic route
11. Update admin dashboard — dynamic rendering + variant filter
12. Update admin PDF — generic answer HTML builder
13. **Verify**: existing root cause quiz works identically through the new system

### Phase 2: Build out the 10 new variants
Each variant = one config file. For each:
1. Design the question set (8-12 questions)
2. Write the prompt overlay
3. Write the landing copy and metadata
4. Test with the simulation / test data generator
5. Deploy

### Phase 3: Polish
- OG images per variant
- Landing page / variant selector (if needed)
- Analytics: conversion tracking per variant
- A/B testing hooks (if desired)

---

## Open Design Questions

1. **Should there be a variant landing/index page?** A page at `/quiz` that shows all available quizzes and lets the user pick? Or is each quiz always reached via direct link from content?

2. **Should the name step move to the beginning?** Some quizzes benefit from capturing the name first for immediate personalization of the question framing. Others benefit from name-last to reduce friction.

3. **Email capture?** The current quiz only asks for name. Adding optional email would enable follow-up sequences for people who don't book immediately. This could be a per-variant toggle.

4. **Shared vs unique question pools.** Some questions (energy level, diet, goals) are nearly universal. Should we formalize a "shared question pool" that variants can import, or just let each variant define its questions independently (with duplicate ids where they overlap)?