# Quiz Agent: Architecture & Design

## Purpose

A single-shot AI agent that takes 10 health quiz answers from a prospective client and produces a personalized health assessment identifying their most important health patterns through the bioenergetic lens. The assessment builds trust and curiosity, driving the prospect to book a free consultation.

**Funnel position:** Ad Click → Quiz → **Agent Analysis** → Book Consultation CTA

---

## Design Philosophy

The agent has no hardcoded logic, no symptom-to-pattern mappings, no decision trees. Instead, it is given:

1. A **theory of health** (the bioenergetic model)
2. A **symptom interpretation vocabulary** (what each symptom implies mechanistically)
3. A **dietary/lifestyle framework** (how to evaluate eating and habits)
4. **10 data points** (the client's answers)

The agent's job is **pattern recognition through a theoretical lens**. The prompt instruction "analyze holistically" and "let the data guide" means the agent decides which patterns emerge, how many to surface, and how to connect them. This is intentional: the same set of symptoms in different combinations should produce different patterns, because the underlying causes differ.

This approach trades determinism for intelligence. A rule-based system would produce the same output for the same inputs every time. This agent reasons, and its output reflects the specific constellation of symptoms it sees.

---

## End-to-End Flow

```
Client completes 10 questions on /quiz
                    │
                    ▼
         POST /api/quiz
         Validate with Zod schema
                    │
                    ▼
         Save submission to storage
         (before LLM call — no data loss)
                    │
                    ▼
         buildQuizSystemPrompt()
         ├── Load 3 knowledge files (cached after first load)
         ├── Format quiz answers into readable text
         └── Assemble single prompt with knowledge + answers + instructions
                    │
                    ▼
         generateText() — single-shot, no streaming
         Model: claude-opus-4-6
                    │
                    ▼
         Save result to storage
                    │
                    ▼
         Return { id, report } to client
         Client renders markdown assessment + booking button
```

**On failure:** The submission is already saved. The error response includes the `submissionId`, which the client stores in localStorage. On retry, the endpoint fetches the stored submission and regenerates without creating a duplicate.

---

## The Three Knowledge Sources

Each knowledge file serves a distinct role in the agent's reasoning. They are injected into the prompt via XML tags, with the tag names as the only hint to the agent about how to use them.

### 1. Bioenergetic Knowledge (`knowledge.md`)

**XML tag:** `<bioenergetic_knowledge>`
**Role:** The agent's worldview — the theoretical model through which it interprets everything.

**Core model — a layered hierarchy:**

```
Root Causes (stress, toxins, diet, lifestyle, pathogens, genetics)
    → Impaired Energy Metabolism (the central thesis)
        → Consequences (inflammation, oxidative stress, lack of metabolites)
            → Molecular/Cellular Changes
                → Disease Manifestations
```

**Three pillars explored in depth:**

| Pillar | Core idea | Scope |
|--------|-----------|-------|
| **Gut Health** | Not just digestion — immune hub, neurotransmitter factory, inflammation driver | 17 conditions traced to gut dysfunction, treatment frameworks (antimicrobials, probiotics, motility, barrier repair) |
| **Stress** | Biological process, not psychological. HPA axis, adrenaline, cortisol | Blood sugar as key trigger, nutrient protocols, lifestyle interventions, hormonal drivers (serotonin, estrogen, histamine) |
| **Thyroid & Energy** | Mitochondria as ground zero. Thyroid hormones drive metabolism | T4→T3 conversion, testing limitations, nutrients, supplementation, liver/gut connection |

**How the agent uses it:** This is the lens for pattern identification. When symptoms cluster around a pillar (e.g., cold extremities + fatigue + brain fog → thyroid/energy), the agent draws from this knowledge to explain *why* those symptoms are connected and what they suggest about the client's underlying health.

The interconnections between pillars are critical: gut dysfunction impairs energy metabolism, which suppresses thyroid function, which worsens gut motility, which increases stress. The agent is expected to see these cascades.

---

### 2. Symptom Interpretation Guide (`questionaire.md`)

**XML tag:** `<symptom_interpretation_guide>`
**Role:** A lookup vocabulary that maps specific symptoms to their mechanistic implications.

Contains **33 question-implication pairs** — deliberately broader than the 10 quiz questions. This gives the agent a richer interpretive vocabulary than what's directly asked.

**Format per entry:**
```
Question: [What is asked]
Implication: [What the answer suggests mechanistically]
```

**Examples of the interpretive depth:**

| Symptom | Implication (from guide) |
|---------|------------------------|
| Afternoon crash after eating | Reliance on adaptive stress hormones (decline after meals). Bacteria feed on ingested food, producing endotoxin and lactic acid that inhibit energy metabolism. |
| Waking at night to eat | Poor liver function — the liver stores carbs for overnight energy. Night hypoglycemia activates stress systems. Bacterial endotoxin damages the liver. |
| Waking at night to urinate | Poor salt intake/retention, disrupted sleep schedule, or low zinc/vitamin C/copper — nutrients that regulate anti-diuretic hormone. |
| Cold extremities | Hypothyroidism. |
| Brain fog | Hypothyroidism, deficient neurosteroids, neuroinflammation, elevated serotonin and lactic acid. |

**How the agent uses it:** When the agent reads "crashes after lunch: Yes", it doesn't just note the symptom — it understands the *mechanism* (stress hormone reliance + bacterial endotoxin). This mechanistic understanding is what enables holistic pattern recognition, because different symptoms with shared underlying mechanisms cluster into patterns.

**Quiz-to-guide mapping:**

| Quiz Question | Relevant Guide Entries |
|---------------|----------------------|
| Energy level (1-10) | #12 (brain fog/energy), gut knowledge (chronic fatigue) |
| Crash after lunch | #13 (afternoon energy crash) |
| Difficulty waking | #6 (sleep patterns) |
| Wake at night + reasons | #6 detailed sub-entries (eat→liver, pee→salt/minerals, no reason→gut irritation) |
| Brain fog | #12 (hypothyroidism, neurosteroids, serotonin, lactic acid) |
| Bowel issues | #23 (diarrhea), #29 (dry stools), and others |
| Cold extremities | #7 (hypothyroidism) |
| White tongue coating | Gut knowledge (dysbiosis indicator) |
| Typical eating | `diet_lifestyle_standardized.md` |
| Health goals | Personalization — no guide entry, used for framing |

---

### 3. Diet & Lifestyle Framework (`diet_lifestyle_standardized.md`)

**XML tag:** `<diet_lifestyle_context>`
**Role:** Gives the agent a framework for evaluating the client's free-text eating pattern answer.

**Covers (57 lines, concise):**
- Sleep/wake consistency and circadian rhythm
- Sunlight exposure (detailed biological mechanisms — vitamin D, infrared, blue light)
- Blue light avoidance at night
- Grounding/earthing
- **Diet fundamentals:**
  - Avoid polyunsaturated fats (seed oils) — suppresses metabolic rate, promotes inflammation, hypothyroidism
  - Avoid food/supplement additives (citric acid, gums, dyes, fortified iron)
  - Don't restrict salt — activates stress systems, impairs glucose metabolism

**How the agent uses it:** When a client writes "I eat oatmeal for breakfast, a sandwich for lunch, and pasta for dinner", the agent can evaluate this through the framework: high PUFA exposure if using seed oils, potential issues with processed grains, possible inadequate protein/animal fat, etc. The lifestyle section also informs pattern explanations (e.g., connecting poor sleep to circadian disruption).

---

## The Input: Quiz Answers

### The 10 Questions

| # | Question | Type | What it reveals |
|---|----------|------|-----------------|
| 1 | Energy levels | Slider (1-10) | Baseline metabolic state |
| 2 | Crash after lunch? | Yes/No | Stress hormone reliance, bacterial activity |
| 3 | Difficulty waking? | Yes/No | Sleep quality, stress hormones, thyroid |
| 4 | Wake at night? Why? | Yes/No + multi-select | Liver function, mineral status, gut irritation |
| 5 | Brain fog? | Yes/No | Thyroid, neuroinflammation, serotonin |
| 6 | Bowel issues? | Multi-select | Gut dysbiosis, motility, stress |
| 7 | Cold extremities? | Yes/No | Thyroid function |
| 8 | White tongue coating? | Yes/No | Gut dysbiosis marker |
| 9 | Typical eating | Free text | Diet quality through bioenergetic lens |
| 10 | Health goals | Free text | Personalization anchor |

Plus: **Name** (required) — used for personalization if real, ignored if fake.

### Answer Formatting

The `formatAnswers()` function transforms structured data into readable text with contextual annotations:

```
**Name:** Sarah
**Energy Level:** 4/10 (low)
**Crash after lunch:** Yes
**Difficulty waking in the morning:** Yes
**Wakes in the middle of the night:** Yes (to eat, to urinate)
**Brain fog / impaired cognition:** Yes
**Bowel issues:** straining, incomplete emptying
**Frequently cold (extremities):** Yes
**White tongue coating:** Yes
**Typical eating pattern:**
Oatmeal, sandwich, pasta...
**Health goals:**
More energy, better sleep...
```

Key formatting choices:
- Energy level gets a qualifier: `(low)` ≤4, `(moderate)` 5-6, `(good)` 7+
- Wake reasons are humanized: `eat` → `to eat`, `pee` → `to urinate`, `no_reason` → `for no apparent reason`
- Bowel issues are expanded: `incomplete` → `incomplete emptying`, `smell` → `excessive smell/messiness`
- Free text fields are preserved verbatim

---

## The Prompt Architecture

The entire prompt is delivered as a **single user message** (not a system message). Structure:

### 1. Context (Role Definition)
```
You are assisting Prism Health, a bioenergetic health practice.
A prospective client has just completed a brief health assessment quiz.
Your role is to analyze their answers holistically and identify the most
important health patterns through the bioenergetic lens.
```

Sets the identity, the situation, and the intent in three sentences.

### 2. Knowledge Foundation
Three XML-tagged blocks injected sequentially:
- `<bioenergetic_knowledge>` — the worldview
- `<symptom_interpretation_guide>` — the interpretation vocabulary
- `<diet_lifestyle_context>` — the lifestyle evaluation framework

No instructions about how to use each source. The XML tag names are the only signal.

### 3. Client's Quiz Answers
The formatted answer block. Placed after knowledge so the agent reads the theory before the data.

### 4. Task Instructions
```
Analyze the answers holistically. Identify the meaningful patterns that
emerge — how symptoms interconnect, what they suggest about underlying
energy and metabolism. Let the data guide how many patterns you surface.
```

Key phrase: **"let the data guide"** — the agent decides the number and nature of patterns.

### 5. Output Format
- Warm, professional tone
- "We" language (speaking as Prism)
- Concise and accessible — prospect, not clinical report
- Markdown structure: heading → personalized opening → pattern sections → closing

### 6. Closing Guidance
Every assessment **must** end with a consultation invitation. Specific requirements:
- Quiz identifies patterns, but a real conversation goes deeper
- Consultation is free, no obligation
- They'll speak with a real person
- **No booking link** in the text (a button is provided separately below the assessment)
- Tone: invitation, not pressure
- Connect to their specific patterns
- Be honest about the quiz's limitations (builds trust)

### 7. Constraints
- No recommendations or protocols
- No citations
- Brief and engaging
- Focus on insight and connection, not diagnosis
- No em dashes (—) in output
- Smart name handling: use real names to personalize; ignore fake names ("test", "asdf", etc.)

---

## How the Agent Reasons

The agent performs a single cognitive pass:

```
1. Absorb the bioenergetic model (what causes what, how systems interconnect)

2. Absorb the symptom interpretation guide (what each symptom implies mechanistically)

3. Absorb the diet/lifestyle framework (how to evaluate eating patterns)

4. Read the client's 10 answers

5. For each answer, activate the relevant interpretations:
   - "Cold extremities: Yes" → hypothyroidism
   - "Brain fog: Yes" → hypothyroidism OR neuroinflammation OR serotonin
   - "White tongue: Yes" → gut dysbiosis
   - "Wakes to eat" → liver dysfunction, night hypoglycemia

6. Identify convergences — where multiple symptoms point to the same root:
   - Cold + brain fog + low energy + difficulty waking → thyroid/energy pattern
   - White tongue + bowel issues + brain fog → gut dysbiosis pattern
   - Crash after lunch + wake at night + difficulty waking → stress/blood sugar pattern

7. Evaluate the diet through the framework:
   - Seed oils? Processed food? Adequate protein? Salt restriction?
   - Does the diet explain or reinforce the patterns?

8. Select the patterns that best explain the symptom constellation
   - Prioritize patterns where symptoms interconnect (not isolated findings)
   - Connect to the client's stated health goals

9. Write each pattern with a clear title and brief explanation
   - Reference their specific answers
   - Explain the connection through the bioenergetic lens
   - Keep it accessible — no jargon, no clinical depth

10. Close with a natural invitation to explore further in a free consultation
```

The power of this approach: the same symptom (e.g., brain fog) can participate in different patterns depending on what accompanies it. Brain fog + cold extremities points to thyroid. Brain fog + white tongue + bowel issues points to gut. The agent resolves this based on the full picture.

---

## The Output

### Format
```markdown
## Your Health Assessment

[Personalized opening using their name if real]

### [Pattern Title]
[2-3 sentences explaining the pattern, referencing their specific answers,
connecting to the bioenergetic model]

### [Pattern Title]
[...]

[Additional patterns as they naturally emerge]

---

[Closing invitation to free consultation]
```

### What's included
- Personalized greeting (if real name)
- Pattern titles that are clear and meaningful
- Brief explanations that reference their specific answers
- Connection to their stated health goals
- Warm, trust-building consultation invitation

### What's excluded
- Recommendations or protocols (that's what the consultation is for)
- Citations or research references
- Clinical language or diagnosis
- Booking links (button is rendered separately by the frontend)
- Em dashes

---

## Technical Integration

| Aspect | Detail |
|--------|--------|
| **Model** | `claude-opus-4-6` via `@ai-sdk/anthropic` |
| **Method** | `generateText()` — single-shot, non-streaming |
| **Message format** | Single user message (not system message) |
| **Knowledge caching** | Files loaded once, cached in module-level variables |
| **Timeout** | 60 seconds (`maxDuration`) |
| **Validation** | Zod schema (`quizSubmissionSchema`) |
| **Storage** | Dev: filesystem. Prod: Upstash Redis |
| **Error recovery** | Submission saved before LLM call. `submissionId` returned on error for retry. Existing results short-circuit regeneration. |

### Retry Flow
```
Submit → Save → LLM fails → Return { error, submissionId }
                                        │
                              Client stores submissionId in localStorage
                                        │
                              Retry → POST { submissionId }
                                        │
                              Fetch stored submission → Check for existing result
                                        │
                              If exists: return immediately
                              If not: regenerate with stored data
```

---

## Why This Works

The agent succeeds because of a deliberate asymmetry: **deep knowledge, minimal data, constrained output**.

- The knowledge is comprehensive (thousands of words across three documents) — this gives the agent enough theoretical depth to reason about interconnections
- The input is minimal (10 questions) — this forces the agent to identify what matters most, not enumerate everything
- The output is constrained (brief patterns, no recommendations) — this creates a gap between "here's what we see" and "here's what to do about it," which is exactly what drives the consultation booking

The agent doesn't need to be right about everything. It needs to be *insightful enough* that the prospect thinks: "they see something real about my health, and I want to know more."
