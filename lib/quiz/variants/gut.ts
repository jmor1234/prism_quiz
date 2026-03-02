// lib/quiz/variants/gut.ts

import type { VariantConfig } from "../types";

export const gutConfig: VariantConfig = {
  slug: "gut",
  name: "Gut Health Assessment",
  description:
    "Discover what's really driving your digestive issues through the lens of energy metabolism",

  questions: [
    {
      id: "digestiveDistress",
      type: "multi_select",
      question: "What digestive symptoms do you experience most?",
      hint: "Select all that apply",
      promptLabel: "Primary digestive symptoms",
      options: [
        { value: "bloating", label: "Bloating" },
        { value: "gas", label: "Gas/flatulence" },
        { value: "abdominal_pain", label: "Abdominal pain" },
        { value: "diarrhea", label: "Diarrhea" },
        { value: "constipation", label: "Constipation" },
        { value: "acid_reflux", label: "Acid reflux/heartburn" },
        { value: "nausea", label: "Nausea" },
      ],
    },
    {
      id: "symptomTiming",
      type: "single_select",
      question: "When do your digestive symptoms tend to be worst?",
      promptLabel: "Symptom timing",
      options: [
        { value: "immediately", label: "Immediately after eating" },
        { value: "delayed", label: "1-3 hours after eating" },
        { value: "between_meals", label: "Between meals" },
        { value: "no_pattern", label: "No clear pattern" },
      ],
    },
    {
      id: "foodSensitivities",
      type: "yes_no",
      question:
        "Have you developed new food sensitivities or intolerances in recent years?",
      promptLabel: "New food sensitivities",
    },
    {
      id: "bowelRelief",
      type: "yes_no",
      question: "Do your symptoms improve after a bowel movement?",
      promptLabel: "Symptoms improve after bowel movement",
    },
    {
      id: "whiteTongue",
      type: "yes_no",
      question:
        "Do you notice a white coating on your tongue, especially in the morning?",
      promptLabel: "White tongue coating",
    },
    {
      id: "stoolQuality",
      type: "multi_select",
      question: "How would you describe your typical bowel movements?",
      hint: "Select all that apply, or skip if none",
      promptLabel: "Stool quality",
      required: false,
      options: [
        { value: "straining", label: "Straining" },
        { value: "loose", label: "Loose/diarrhea" },
        { value: "alternating", label: "Alternating between constipation and diarrhea" },
        { value: "incomplete", label: "Incomplete emptying" },
        { value: "smell", label: "Excessive smell/mess", promptLabel: "excessive smell/messiness" },
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
      id: "brainFogMood",
      type: "yes_no",
      question:
        "Do you experience brain fog, low mood, or difficulty concentrating?",
      promptLabel: "Brain fog or mood issues",
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
        "Example: Coffee and toast for breakfast, salad for lunch, pasta for dinner...",
      rows: 5,
    },
    {
      id: "healthGoals",
      type: "free_text",
      question:
        "What would resolution of your digestive issues look like for you?",
      hint: "What would feeling your best look like?",
      promptLabel: "Health goals",
      placeholder:
        "Example: No more bloating after meals, regular digestion, eating without anxiety...",
      rows: 4,
    },
  ],

  nameField: {
    question: "What's your name?",
    hint: "We'll personalize your assessment with your name",
    placeholder: "Your name",
  },

  headline: "Prism Gut Health Assessment",
  subtitle: "Discover the root causes of your digestive issues",
  resultBanner: "Your personalized gut health assessment is ready",
  ctaText: "Book a Free Consultation",
  ctaUrl: "https://prism.miami/consultation",

  promptOverlay: `## Condition Focus: Gut Health

This person is specifically concerned about digestive issues. They likely experience some combination of bloating, irregular bowel movements, food sensitivities, or abdominal discomfort. Many have been told they have IBS or SIBO without getting real resolution. Some have been through elimination diets, probiotics, and digestive enzymes with limited lasting improvement.

Through the bioenergetic lens, gut dysfunction is never isolated. It is both a consequence and a driver of systemic dysfunction. Look for how their symptoms connect to:

- Energy metabolism: thyroid function drives gut motility, enzyme secretion, stomach acid production, and gut immune function. If they report low energy or cold extremities alongside gut symptoms, the thyroid-gut connection is likely central.
- Stress cascades: cortisol and adrenaline suppress digestive function directly. Serotonin produced in response to gut irritation creates a self-reinforcing cycle of sensitivity, pain, and motility disruption. If they report brain fog or mood issues, excess gut-derived serotonin may be affecting the brain.
- Dietary factors: polyunsaturated fats promote gut inflammation and suppress metabolic rate. Additives damage the gut barrier. These are often invisible drivers the person hasn't considered.
- Microbial overgrowth patterns: symptom timing (immediate vs delayed), tongue coating, stool quality, and food sensitivity development all point to where and what type of overgrowth exists.

When identifying patterns, frame them in terms of what is DRIVING the gut dysfunction, not just describing it. The insight they need is: your gut problems aren't random, they're connected to deeper systems. The patterns should show them WHY their gut is dysfunctional, connecting to energy metabolism, stress, thyroid, or diet as root causes.

The strongest assessment connects their stated digestive symptoms to something they didn't realize was related — their energy, their cold hands, their brain fog — through the bioenergetic framework. That connection is what drives the consultation booking.`,
};
