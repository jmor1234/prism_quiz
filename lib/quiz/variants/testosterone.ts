// lib/quiz/variants/testosterone.ts

import type { VariantConfig } from "../types";

export const testosteroneConfig: VariantConfig = {
  slug: "testosterone",
  name: "Men's Hormone & Performance Assessment",
  description:
    "Discover what's actually suppressing your testosterone and hormonal vitality",

  questions: [
    {
      id: "primaryConcerns",
      type: "multi_select",
      question: "What are you experiencing?",
      hint: "Select all that apply",
      promptLabel: "Primary concerns",
      options: [
        { value: "low_energy", label: "Low energy/fatigue" },
        { value: "muscle_difficulty", label: "Difficulty building or maintaining muscle" },
        { value: "low_libido", label: "Low libido or sexual performance" },
        { value: "brain_fog", label: "Brain fog or poor focus" },
        { value: "body_fat", label: "Increased body fat" },
        { value: "low_motivation", label: "Low motivation/drive" },
        { value: "mood_issues", label: "Mood issues (irritability, low mood)" },
      ],
    },
    {
      id: "muscleRecovery",
      type: "yes_no",
      question:
        "Has your ability to build muscle or recover from workouts declined?",
      promptLabel: "Muscle building / recovery declined",
    },
    {
      id: "bodyFatPattern",
      type: "single_select",
      question: "Where do you tend to accumulate body fat?",
      promptLabel: "Body fat distribution",
      options: [
        { value: "belly", label: "Belly/midsection" },
        { value: "chest", label: "Chest (gynecomastia)" },
        { value: "all_over", label: "All over evenly" },
        { value: "no_excess", label: "I don't accumulate excess fat" },
      ],
    },
    {
      id: "libidoMorningErections",
      type: "yes_no",
      question:
        "Have you noticed a decline in libido or morning erections?",
      promptLabel: "Libido / morning erection decline",
    },
    {
      id: "stressRecovery",
      type: "yes_no",
      question:
        "Do you feel wired but tired — mentally stimulated but physically exhausted?",
      promptLabel: "Wired but tired",
    },
    {
      id: "sleepQuality",
      type: "single_select",
      question: "How is your sleep?",
      promptLabel: "Sleep quality",
      options: [
        { value: "good", label: "Sleep well and wake refreshed" },
        { value: "falling_asleep", label: "Difficulty falling asleep" },
        { value: "waking_night", label: "Wake during the night" },
        { value: "not_rested", label: "Sleep enough hours but don't feel rested" },
      ],
    },
    {
      id: "digestiveHealth",
      type: "multi_select",
      question: "Do you experience any digestive issues?",
      hint: "Select all that apply, or skip if none",
      promptLabel: "Digestive issues",
      required: false,
      options: [
        { value: "bloating", label: "Bloating" },
        { value: "constipation", label: "Constipation" },
        { value: "diarrhea", label: "Diarrhea" },
        { value: "gas", label: "Gas" },
        { value: "food_sensitivities", label: "Food sensitivities" },
      ],
    },
    {
      id: "energyLevel",
      type: "slider",
      question: "Rate your average energy levels throughout the day",
      hint: "1 = barely able to function, 10 = perfect energy all day",
      promptLabel: "Energy Level",
      min: 1,
      max: 10,
      default: 5,
      lowLabel: "Exhausted",
      highLabel: "Energized",
      qualifiers: [
        { max: 4, label: "low" },
        { max: 6, label: "moderate" },
        { max: 10, label: "good" },
      ],
    },
    {
      id: "coldExtremities",
      type: "yes_no",
      question:
        "Do you frequently feel cold, especially at your fingers, toes, or nose?",
      promptLabel: "Frequently cold (extremities)",
    },
    {
      id: "typicalEating",
      type: "free_text",
      question: "Describe a typical day of eating for you",
      hint: "Include breakfast, lunch, dinner, snacks, and drinks",
      promptLabel: "Typical eating pattern",
      placeholder:
        "Example: Eggs for breakfast, chicken and rice for lunch, steak and vegetables for dinner...",
      rows: 5,
    },
    {
      id: "healthGoals",
      type: "free_text",
      question:
        "What would optimal hormonal health and performance look like for you?",
      hint: "What would feeling your best look like?",
      promptLabel: "Health goals",
      placeholder:
        "Example: High energy, strong in the gym, sharp focus, healthy libido, lean body composition...",
      rows: 4,
    },
  ],

  nameField: {
    question: "What's your name?",
    hint: "We'll personalize your assessment with your name",
    placeholder: "Your name",
  },

  headline: "Prism Men's Hormone Assessment",
  subtitle: "Discover what's suppressing your hormonal vitality",
  resultBanner: "Your personalized hormone assessment is ready",
  ctaText: "Book a Free Consultation",
  ctaUrl: "https://prism.miami/consultation",

  promptOverlay: `## Condition Focus: Men's Hormones & Testosterone

This person wants to optimize testosterone, build muscle, or restore masculine vitality. They've likely tried the standard playbook: lift heavy, sleep more, take zinc and ashwagandha, maybe vitamin D. Some may be considering or already on TRT. The frustration is that they're "doing everything right" and still not seeing results, or they don't want to depend on exogenous hormones.

Through the bioenergetic lens, testosterone is downstream of energy metabolism — it's a luxury hormone the body produces when metabolic conditions are favorable. Look for:

- Gut inflammation and testosterone: endotoxin from gut dysbiosis directly suppresses testicular testosterone synthesis. This is backed by research and is often the missing piece. If they report ANY digestive symptoms alongside low T concerns, the gut-testosterone connection is likely central. This is often the biggest "I never considered that" moment.
- Stress hormone competition: cortisol and testosterone share precursor pathways. Chronic stress, including from overtraining, caloric restriction, and poor sleep, diverts resources from testosterone production. If they feel "wired but tired," stress hormones are likely running the show.
- Thyroid and metabolic rate: thyroid function sets the metabolic floor. If metabolic rate is low (cold extremities, low energy, poor recovery), the body simply doesn't have the metabolic capacity to produce optimal testosterone. No supplement fixes this.
- Estrogen conversion: body fat, especially visceral fat, contains aromatase that converts testosterone to estrogen. Gut-derived endotoxin also increases aromatase activity. If they accumulate chest fat or have gut issues, estrogen conversion may be silently lowering their effective testosterone.
- Dietary factors: PUFAs directly suppress androgen production. Caloric restriction increases stress hormones. Low-carb diets reduce T3 (thyroid) which reduces testosterone. Many men optimizing for testosterone are inadvertently eating diets that suppress it.

Frame patterns around WHY their testosterone is low, not just confirming it. The reframe is: your T isn't low because you need a supplement or injection — it's low because your body's energy system is compromised, and that's suppressing hormone production as a downstream consequence. Connect their symptoms to the underlying metabolic, gut, or stress picture that's driving the hormonal deficit.`,
};
