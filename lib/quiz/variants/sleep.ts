// lib/quiz/variants/sleep.ts

import type { VariantConfig } from "../types";

export const sleepConfig: VariantConfig = {
  slug: "sleep",
  name: "Sleep Assessment",
  description:
    "Identify the metabolic and hormonal patterns disrupting your sleep",

  questions: [
    {
      id: "sleepProblem",
      type: "multi_select",
      question: "What best describes your sleep issue?",
      hint: "Select all that apply",
      promptLabel: "Sleep issues",
      options: [
        { value: "falling_asleep", label: "Difficulty falling asleep" },
        { value: "waking_night", label: "Waking during the night" },
        { value: "waking_early", label: "Waking too early" },
        { value: "not_rested", label: "Sleeping enough hours but not feeling rested" },
        { value: "nightmares", label: "Nightmares or disturbing dreams" },
        { value: "daytime_sleepiness", label: "Can't stay awake during the day" },
      ],
    },
    {
      id: "wakeTimingNight",
      type: "single_select",
      question: "If you wake during the night, when does it typically happen?",
      promptLabel: "Night waking timing",
      options: [
        { value: "first_few_hours", label: "Within first few hours" },
        { value: "middle", label: "Middle of the night (2-4am)" },
        { value: "early_morning", label: "Early morning (4-6am)" },
        { value: "multiple", label: "Multiple times" },
        { value: "dont_wake", label: "I don't wake during the night" },
      ],
    },
    {
      id: "wakeReasons",
      type: "multi_select",
      question: "When you wake at night, what do you notice?",
      hint: "Select all that apply, or skip if none",
      promptLabel: "Night waking symptoms",
      required: false,
      options: [
        { value: "urinate", label: "Need to urinate" },
        { value: "hungry", label: "Hungry/need to eat" },
        { value: "heart_racing", label: "Heart racing or anxious" },
        { value: "hot_sweaty", label: "Hot or sweaty" },
        { value: "mind_racing", label: "Mind racing" },
        { value: "no_reason", label: "No apparent reason — just awake", promptLabel: "no apparent reason — just awake" },
      ],
    },
    {
      id: "sleepRestoration",
      type: "yes_no",
      question: "Do you dream?",
      promptLabel: "Dreams",
    },
    {
      id: "nighttimeRoutine",
      type: "yes_no",
      question:
        "Do you typically use screens (phone, TV, computer) within an hour of bed?",
      promptLabel: "Screen use before bed",
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
      id: "crashAfterEating",
      type: "yes_no",
      question: "Do you tend to crash in energy after eating?",
      promptLabel: "Crash after eating",
    },
    {
      id: "digestiveIssues",
      type: "yes_no",
      question:
        "Do you experience any digestive issues (bloating, constipation, reflux, etc.)?",
      promptLabel: "Digestive issues",
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
      question: "Describe a typical day of eating, including your last meal timing relative to bed",
      hint: "Include breakfast, lunch, dinner, snacks, drinks, and when you eat your last meal",
      promptLabel: "Typical eating pattern",
      placeholder:
        "Example: Coffee and toast for breakfast, salad for lunch, pasta for dinner around 7pm, bed at 10pm...",
      rows: 5,
    },
    {
      id: "healthGoals",
      type: "free_text",
      question: "What would great sleep look like for you?",
      hint: "What would feeling your best look like?",
      promptLabel: "Health goals",
      placeholder:
        "Example: Falling asleep easily, sleeping through the night, waking refreshed...",
      rows: 4,
    },
  ],

  nameField: {
    question: "What's your name?",
    hint: "We'll personalize your assessment with your name",
    placeholder: "Your name",
  },

  headline: "Prism Sleep Assessment",
  subtitle: "Identify what's really disrupting your sleep",
  resultBanner: "Your personalized sleep assessment is ready",
  ctaText: "Book a Free Consultation",
  ctaUrl: "https://prism.miami/consultation",

  promptOverlay: `## Condition Focus: Sleep

This person's primary struggle is sleep — difficulty falling asleep, staying asleep, or getting restorative sleep. Many have tried melatonin, magnesium, sleep hygiene protocols, CBT-I, or prescription sleep aids. Some get "enough hours" but wake exhausted. Their sleep problem is likely affecting every other aspect of their life.

Through the bioenergetic lens, sleep is not a standalone system to optimize — it's a reflection of metabolic, hormonal, and nervous system state. Look for:

- Stress hormone disruption: the timing and nature of their sleep disturbance reveals which stress pathway is dominant. Early waking with heart racing = adrenaline. Difficulty falling asleep with racing mind = cortisol. Hot and sweaty = estrogen. The questionnaire guide has detailed mappings for each wake pattern.
- Blood sugar and liver function: waking to eat or waking in the 2-4am window often signals that the liver's glycogen stores are depleted, causing blood sugar to drop and stress hormones to spike. Bacterial endotoxin damages the liver, connecting gut health to this pattern.
- Serotonin and sleep architecture: excess gut-derived serotonin can make someone drowsy but produces "hibernation state" sleep that isn't restorative. If they sleep enough hours but don't feel rested and don't dream, serotonin excess is likely. This should be converted to melatonin for proper restorative sleep.
- Gut-sleep connection: intestinal irritation from dysbiosis or undigested food activates the central nervous system, causing unexplained night waking. If they report digestive issues alongside sleep problems, the gut is likely disrupting sleep directly.
- Thyroid and circadian rhythm: thyroid hormones regulate circadian rhythm. Hypothyroidism impairs the body's ability to maintain proper sleep-wake cycles.
- Environmental factors: blue light exposure at night directly suppresses melatonin. This is the simplest factor but still worth noting when present.

Frame patterns around what is CAUSING their sleep disruption, not sleep hygiene tips they've already tried. The insight is: your sleep isn't broken because of your bedtime routine — it's disrupted because of specific metabolic and hormonal processes that are active at night, and those processes have identifiable root causes.`,
};
