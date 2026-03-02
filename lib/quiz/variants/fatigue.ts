// lib/quiz/variants/fatigue.ts

import type { VariantConfig } from "../types";

export const fatigueConfig: VariantConfig = {
  slug: "fatigue",
  name: "Energy & Fatigue Assessment",
  description:
    "Uncover the root causes behind persistent fatigue and low energy",

  questions: [
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
      id: "energyPattern",
      type: "single_select",
      question: "When is your energy typically at its worst?",
      promptLabel: "Energy pattern",
      options: [
        { value: "morning", label: "Morning (hard to get going)" },
        { value: "after_meals", label: "After meals" },
        { value: "afternoon", label: "Afternoon (2-4pm crash)" },
        { value: "evening", label: "Evening (crash early)" },
        { value: "all_day", label: "Consistently low all day" },
      ],
    },
    {
      id: "crashAfterEating",
      type: "yes_no",
      question: "Do you tend to crash in energy after eating?",
      promptLabel: "Crash after eating",
    },
    {
      id: "difficultyWaking",
      type: "yes_no",
      question:
        "Do you have difficulty getting up in the morning, even after enough sleep?",
      promptLabel: "Difficulty waking",
    },
    {
      id: "exerciseTolerance",
      type: "yes_no",
      question:
        "Has your ability to exercise or recover from physical activity declined?",
      promptLabel: "Exercise tolerance declined",
    },
    {
      id: "coldExtremities",
      type: "yes_no",
      question:
        "Do you frequently feel cold, especially at your fingers, toes, or nose?",
      promptLabel: "Frequently cold (extremities)",
    },
    {
      id: "digestiveIssues",
      type: "multi_select",
      question: "Do you experience any digestive issues?",
      hint: "Select all that apply, or skip if none",
      promptLabel: "Digestive issues",
      required: false,
      options: [
        { value: "bloating", label: "Bloating" },
        { value: "constipation", label: "Constipation" },
        { value: "diarrhea", label: "Diarrhea" },
        { value: "acid_reflux", label: "Acid reflux" },
        { value: "food_sensitivities", label: "Food sensitivities" },
      ],
    },
    {
      id: "brainFog",
      type: "yes_no",
      question: "Do you experience brain fog or difficulty concentrating?",
      promptLabel: "Brain fog",
    },
    {
      id: "sleepQuality",
      type: "yes_no",
      question: "Do you wake up in the middle of the night?",
      promptLabel: "Wakes in the middle of the night",
      conditionalFollowUp: {
        prompt: "If so, why? (select all that apply)",
        options: [
          { value: "eat", label: "To eat" },
          { value: "pee", label: "To urinate" },
          {
            value: "no_reason",
            label: "No apparent reason",
            promptLabel: "for no apparent reason",
          },
        ],
      },
    },
    {
      id: "typicalEating",
      type: "free_text",
      question: "Describe a typical day of eating for you",
      hint: "Include breakfast, lunch, dinner, snacks, and drinks",
      promptLabel: "Typical eating pattern",
      placeholder:
        "Example: Coffee and toast for breakfast, salad for lunch, pasta for dinner...",
      rows: 5,
    },
    {
      id: "healthGoals",
      type: "free_text",
      question: "What would having your energy back look like for you?",
      hint: "What would feeling your best look like?",
      promptLabel: "Health goals",
      placeholder:
        "Example: Waking up refreshed, consistent energy all day, being able to exercise again...",
      rows: 4,
    },
  ],

  nameField: {
    question: "What's your name?",
    hint: "We'll personalize your assessment with your name",
    placeholder: "Your name",
  },

  headline: "Prism Energy & Fatigue Assessment",
  subtitle: "Uncover the root causes of persistent fatigue",
  resultBanner: "Your personalized energy assessment is ready",
  ctaText: "Book a Free Consultation",
  ctaUrl: "https://prism.miami/consultation",

  promptOverlay: `## Condition Focus: Energy & Fatigue

This person is dealing with persistent fatigue that hasn't responded to conventional approaches. Many have had basic bloodwork done and been told everything is "normal." Some have tried B12, iron, sleep optimization, or stimulants without lasting improvement. Their frustration is real — they remember having energy and don't understand why it's gone.

Through the bioenergetic lens, fatigue IS the core signal. Energy metabolism is the central thesis. Look for:

- Thyroid and metabolic rate: cold extremities, difficulty waking, brain fog alongside fatigue all point to suppressed thyroid function. Remember that standard TSH testing misses most thyroid dysfunction — the person may have been told their thyroid is fine when T4-to-T3 conversion is impaired.
- Gut-energy cascade: digestive symptoms alongside fatigue suggest endotoxin from gut dysbiosis is directly suppressing mitochondrial energy production. This is often the missing piece — they're addressing fatigue as an energy problem when it's actually a gut problem.
- Stress and blood sugar: post-meal crashes indicate reliance on stress hormones for energy. When someone eats and crashes, their baseline energy was being maintained by adrenaline and cortisol, which decline when food signals safety. This is a critical insight most people have never heard.
- Dietary factors: caloric restriction, fasting, and low-carb approaches actively suppress thyroid function and increase stress hormones. Many fatigued people are inadvertently making themselves worse through diets they believe are healthy.
- Sleep quality: night waking prevents the deep recovery that energy production depends on. If stress hormones or gut irritation are disrupting sleep, daytime energy cannot recover regardless of hours in bed.

Frame patterns around the ROOT of their energy deficit. Not "you're tired because you sleep poorly" but "your sleep is disrupted because X, which also explains your fatigue through Y mechanism." The person needs to understand that fatigue is a symptom of an underlying system failure, not a standalone problem to solve with more coffee or supplements.`,
};
