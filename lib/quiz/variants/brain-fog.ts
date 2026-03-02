// lib/quiz/variants/brain-fog.ts

import type { VariantConfig } from "../types";

export const brainFogConfig: VariantConfig = {
  slug: "brain-fog",
  name: "Brain Fog & Cognitive Assessment",
  description:
    "Find the metabolic and inflammatory roots of your cognitive symptoms",

  questions: [
    {
      id: "cognitiveSymptoms",
      type: "multi_select",
      question: "What best describes your experience?",
      hint: "Select all that apply",
      promptLabel: "Cognitive symptoms",
      options: [
        { value: "concentration", label: "Difficulty concentrating or focusing" },
        { value: "memory", label: "Poor short-term memory" },
        { value: "mental_fatigue", label: "Mental fatigue (thinking feels effortful)" },
        { value: "low_motivation", label: "Low motivation or drive" },
        { value: "slow_processing", label: "Slow processing speed" },
        { value: "word_finding", label: "Word-finding difficulties" },
      ],
    },
    {
      id: "cognitivePattern",
      type: "single_select",
      question: "When is your mental clarity typically worst?",
      promptLabel: "Cognitive clarity pattern",
      options: [
        { value: "morning", label: "Morning (takes hours to \"boot up\")" },
        { value: "after_meals", label: "After meals" },
        { value: "afternoon", label: "Afternoon slump" },
        { value: "all_day", label: "Consistently foggy all day" },
        { value: "fluctuates", label: "Fluctuates unpredictably" },
      ],
    },
    {
      id: "motivationDrive",
      type: "yes_no",
      question:
        "Have you lost motivation or pleasure in activities you used to enjoy?",
      promptLabel: "Loss of motivation / pleasure",
    },
    {
      id: "irritability",
      type: "yes_no",
      question:
        "Do you find yourself more irritable or emotionally reactive than usual?",
      promptLabel: "Increased irritability",
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
      id: "digestiveIssues",
      type: "yes_no",
      question:
        "Do you experience any digestive issues (bloating, constipation, food sensitivities, etc.)?",
      promptLabel: "Digestive issues",
    },
    {
      id: "sleepQuality",
      type: "single_select",
      question: "Do you wake feeling rested?",
      promptLabel: "Sleep quality",
      options: [
        { value: "yes", label: "Yes — I sleep well" },
        { value: "not_rested", label: "I sleep enough but don't feel rested" },
        { value: "not_enough", label: "I don't sleep enough" },
        { value: "disrupted", label: "My sleep is frequently disrupted" },
      ],
    },
    {
      id: "whiteTongue",
      type: "yes_no",
      question:
        "Do you notice a white coating on your tongue, especially in the morning?",
      promptLabel: "White tongue coating",
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
      question:
        "What would mental clarity and peak cognitive function look like for you?",
      hint: "What would feeling your best look like?",
      promptLabel: "Health goals",
      placeholder:
        "Example: Sharp focus at work, quick recall, clear thinking, motivation to tackle projects...",
      rows: 4,
    },
  ],

  nameField: {
    question: "What's your name?",
    hint: "We'll personalize your assessment with your name",
    placeholder: "Your name",
  },

  headline: "Prism Brain Fog Assessment",
  subtitle: "Find the roots of your cognitive symptoms",
  resultBanner: "Your personalized cognitive assessment is ready",
  ctaText: "Book a Free Consultation",
  ctaUrl: "https://prism.miami/consultation",

  promptOverlay: `## Condition Focus: Brain Fog & Cognitive Function

This person is struggling with mental clarity, focus, memory, or motivation. Many are younger than you'd expect for cognitive complaints and remember being sharper. Some have attributed it to stress, aging, or screen time without finding real solutions. Others have tried nootropics, meditation, or "brain health" supplements. The frustration is often compounded because cognitive issues affect their work, relationships, and identity.

Through the bioenergetic lens, the brain is the most metabolically demanding organ — it consumes roughly 20% of the body's energy. When energy metabolism is impaired, cognitive function is among the first casualties. Look for:

- Thyroid and brain metabolism: the brain depends on adequate thyroid hormone for processing speed, memory consolidation, and mood regulation. If they report cold extremities or low energy alongside brain fog, thyroid suppression is likely the primary driver. Hypothyroidism is one of the most common and most underdiagnosed causes of cognitive decline.
- Gut-brain axis: neuroinflammation from gut-derived endotoxin directly impairs cognitive function. Certain gut bacteria overproduce D-lactic acid, which is literally neurotoxic and mimics intoxication. If they report digestive issues or white tongue coating alongside brain fog, the gut is likely driving neuroinflammation.
- Serotonin excess: elevated gut-derived serotonin impairs cognition, suppresses dopamine (reducing motivation and pleasure), and disrupts sleep architecture. If they report brain fog with low motivation AND non-restorative sleep, serotonin excess is a strong candidate. This is the opposite of what most people believe about serotonin.
- Lactic acid and neurochemistry: elevated lactic acid impairs energy metabolism in the brain specifically. It also drives anxiety and irritability. If brain fog comes with irritability, lactic acid accumulation may be involved.
- Blood sugar and cognitive function: post-meal brain fog suggests blood sugar dysregulation and stress hormone reliance. The brain is exquisitely sensitive to glucose availability.

Frame patterns so the person understands that brain fog is not "just stress" or inevitable — it has specific metabolic and inflammatory causes that can be identified and addressed. The insight is connecting their cognitive symptoms to upstream causes they haven't considered: gut health, thyroid function, or metabolic state.`,
};
