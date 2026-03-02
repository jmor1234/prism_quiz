// lib/quiz/variants/hormones-women.ts

import type { VariantConfig } from "../types";

export const hormonesWomenConfig: VariantConfig = {
  slug: "hormones-women",
  name: "Women's Hormonal Assessment",
  description:
    "Trace hormonal imbalances to their metabolic and gut health origins",

  questions: [
    {
      id: "primaryConcern",
      type: "multi_select",
      question: "What hormonal concerns are you experiencing?",
      hint: "Select all that apply",
      promptLabel: "Hormonal concerns",
      options: [
        { value: "irregular_periods", label: "Irregular periods" },
        { value: "painful_periods", label: "Painful periods/cramps" },
        { value: "heavy_periods", label: "Heavy periods" },
        { value: "pms", label: "PMS (mood, bloating, headaches)" },
        { value: "acne", label: "Acne or skin changes" },
        { value: "hair_thinning", label: "Hair thinning" },
        { value: "weight_gain", label: "Weight gain" },
        { value: "low_libido", label: "Low libido" },
        { value: "hot_flashes", label: "Hot flashes/night sweats" },
      ],
    },
    {
      id: "birthControlHistory",
      type: "single_select",
      question:
        "Have you recently stopped hormonal birth control, or are you currently on it?",
      promptLabel: "Birth control history",
      options: [
        { value: "currently_on", label: "Currently on it" },
        { value: "stopped_recent", label: "Stopped within the past year" },
        { value: "stopped_over_year", label: "Stopped over a year ago" },
        { value: "never_used", label: "Never used it" },
      ],
    },
    {
      id: "cycleRegularity",
      type: "single_select",
      question: "How would you describe your menstrual cycle?",
      promptLabel: "Menstrual cycle regularity",
      options: [
        { value: "regular", label: "Regular (25-35 day cycles)" },
        { value: "irregular", label: "Irregular (unpredictable timing)" },
        { value: "long", label: "Very long cycles (35+ days)" },
        { value: "absent", label: "Absent periods" },
        { value: "not_applicable", label: "Not applicable (menopause/other)" },
      ],
    },
    {
      id: "pmsSymptoms",
      type: "multi_select",
      question:
        "In the week before your period, do you experience any of the following?",
      hint: "Select all that apply, or skip if none",
      promptLabel: "PMS symptoms",
      required: false,
      options: [
        { value: "mood_swings", label: "Mood swings/irritability" },
        { value: "bloating", label: "Bloating/water retention" },
        { value: "breast_tenderness", label: "Breast tenderness" },
        { value: "headaches", label: "Headaches/migraines" },
        { value: "cravings", label: "Food cravings" },
        { value: "anxiety", label: "Anxiety" },
        { value: "insomnia", label: "Insomnia" },
      ],
    },
    {
      id: "weightPattern",
      type: "single_select",
      question: "Where do you tend to gain weight?",
      promptLabel: "Weight distribution",
      options: [
        { value: "hips_thighs", label: "Hips and thighs" },
        { value: "belly", label: "Belly/midsection" },
        { value: "all_over", label: "All over evenly" },
        { value: "dont_gain", label: "I don't tend to gain weight" },
        { value: "weight_loss", label: "I struggle with unintended weight loss" },
      ],
    },
    {
      id: "puffiness",
      type: "yes_no",
      question: "Do you feel \"puffy\" or retain water easily?",
      promptLabel: "Water retention / puffiness",
    },
    {
      id: "digestiveIssues",
      type: "yes_no",
      question:
        "Do you experience bloating, constipation, or other digestive issues?",
      promptLabel: "Digestive issues",
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
        "Example: Coffee and toast for breakfast, salad for lunch, pasta for dinner...",
      rows: 5,
    },
    {
      id: "healthGoals",
      type: "free_text",
      question: "What would hormonal balance look like for you?",
      hint: "What would feeling your best look like?",
      promptLabel: "Health goals",
      placeholder:
        "Example: Regular pain-free periods, stable mood, clear skin, feeling like myself again...",
      rows: 4,
    },
  ],

  nameField: {
    question: "What's your name?",
    hint: "We'll personalize your assessment with your name",
    placeholder: "Your name",
  },

  headline: "Prism Women's Hormonal Assessment",
  subtitle: "Trace hormonal imbalances to their root causes",
  resultBanner: "Your personalized hormonal assessment is ready",
  ctaText: "Book a Free Consultation",
  ctaUrl: "https://prism.miami/consultation",

  promptOverlay: `## Condition Focus: Women's Hormonal Health

This person is dealing with hormonal imbalances — cycle irregularity, PMS, estrogen-related symptoms, post-birth-control disruption, or similar concerns. Many have been offered birth control as the primary solution, which masks symptoms without addressing causes. Some have tried supplements like DIM, vitex, or seed cycling with limited results. Their frustration often includes feeling dismissed by providers who treat hormonal symptoms as inevitable rather than solvable.

Through the bioenergetic lens, hormonal imbalance is downstream of energy metabolism. Look for:

- Estrogen dominance pathways: estrogen stimulates HPA axis activity, promotes histamine release, drives water retention, and increases gut sensitivity. If they report PMS, puffiness, weight gain at hips/thighs, these all converge on excess estrogen as a pattern.
- The gut-estrogen connection: the gut microbiome (estrobolome) regulates estrogen metabolism. Gut dysbiosis impairs estrogen clearance, creating a self-reinforcing cycle. If they report digestive issues alongside hormonal symptoms, this connection is likely central. Estrogen also promotes fungal overgrowth (Candida), which is why candida symptoms often worsen during high-estrogen phases.
- Thyroid-hormone connection: thyroid function drives progesterone production. Low thyroid = low progesterone = relative estrogen excess, even if absolute estrogen levels look normal. Cold extremities or low energy alongside hormonal symptoms strongly suggest this pathway.
- Stress and progesterone: chronic stress diverts progesterone precursors toward cortisol production ("pregnenolone steal"). If they show stress markers (sleep disruption, energy crashes, anxiety), this may be driving their hormonal imbalance.
- Birth control aftermath: if they recently stopped hormonal BC, their gut microbiome, liver detoxification pathways, and nutrient stores (zinc, B vitamins, magnesium) may be disrupted, affecting their body's ability to regulate hormones naturally.

Frame patterns around the SYSTEMS driving the hormonal imbalance. Not "your estrogen is high" but "here's what's causing your body to accumulate estrogen and underproduce progesterone, and how it connects to your other symptoms." The person needs to see that hormonal balance requires addressing the underlying metabolic and gut health picture, not just targeting hormones directly.`,
};
