// lib/quiz/variants/thyroid.ts

import type { VariantConfig } from "../types";

export const thyroidConfig: VariantConfig = {
  slug: "thyroid",
  name: "Thyroid & Metabolism Assessment",
  description:
    "Understand why you still feel hypothyroid even when labs look normal",

  questions: [
    {
      id: "thyroidSymptoms",
      type: "multi_select",
      question: "Which of these do you experience?",
      hint: "Select all that apply",
      promptLabel: "Thyroid symptoms",
      options: [
        { value: "fatigue", label: "Constant fatigue regardless of sleep" },
        { value: "cold_sensitivity", label: "Sensitivity to cold" },
        { value: "weight_gain", label: "Unexplained weight gain" },
        { value: "brain_fog", label: "Brain fog or poor memory" },
        { value: "hair_loss", label: "Hair thinning or loss" },
        { value: "dry_skin", label: "Dry skin" },
        { value: "low_mood", label: "Low mood or depression" },
        { value: "constipation", label: "Constipation" },
      ],
    },
    {
      id: "thyroidHistory",
      type: "single_select",
      question: "What's your thyroid history?",
      promptLabel: "Thyroid history",
      options: [
        { value: "diagnosed_medicated", label: "Diagnosed hypothyroid and on medication" },
        { value: "diagnosed_unmedicated", label: "Diagnosed but not on medication" },
        { value: "suspected", label: "Suspected but not diagnosed" },
        { value: "tested_normal", label: "Had thyroid tested — told it's normal" },
        { value: "never_tested", label: "Never had thyroid tested" },
      ],
    },
    {
      id: "coldSensitivity",
      type: "single_select",
      question: "How would you describe your sensitivity to cold?",
      promptLabel: "Cold sensitivity",
      options: [
        { value: "always_cold", label: "I'm always cold" },
        { value: "extremities", label: "My extremities (hands, feet, nose) are often cold" },
        { value: "morning", label: "I'm cold mainly in the morning" },
        { value: "not_bothered", label: "Cold doesn't bother me much" },
      ],
    },
    {
      id: "weightPattern",
      type: "single_select",
      question: "What's happening with your weight?",
      promptLabel: "Weight pattern",
      options: [
        { value: "gaining", label: "Gaining weight despite eating well and exercising" },
        { value: "cant_lose", label: "Can't lose weight no matter what I try" },
        { value: "slow_metabolism", label: "Weight is stable but metabolism feels slow" },
        { value: "no_concern", label: "No weight concerns" },
      ],
    },
    {
      id: "hairSkinNails",
      type: "multi_select",
      question: "Have you noticed changes in your hair, skin, or nails?",
      hint: "Select all that apply, or skip if none",
      promptLabel: "Hair/skin/nail changes",
      required: false,
      options: [
        { value: "hair_thinning", label: "Hair thinning or loss" },
        { value: "dry_skin", label: "Dry or flaky skin" },
        { value: "brittle_nails", label: "Brittle nails" },
        { value: "eyebrow_thinning", label: "Outer eyebrow thinning" },
      ],
    },
    {
      id: "energyPattern",
      type: "single_select",
      question: "When is your energy typically worst?",
      promptLabel: "Energy pattern",
      options: [
        { value: "morning", label: "Morning (impossible to get going)" },
        { value: "all_day", label: "Consistent low energy all day" },
        { value: "after_eating", label: "Energy crashes after eating" },
        { value: "evening", label: "Evening (crash very early)" },
      ],
    },
    {
      id: "digestiveIssues",
      type: "yes_no",
      question:
        "Do you experience constipation, bloating, or slow digestion?",
      promptLabel: "Digestive issues (constipation/bloating)",
    },
    {
      id: "stressLevel",
      type: "yes_no",
      question:
        "Would you say your life has been particularly stressful recently?",
      promptLabel: "Recent significant stress",
    },
    {
      id: "dietType",
      type: "single_select",
      question: "Which best describes your eating approach?",
      promptLabel: "Dietary approach",
      options: [
        { value: "low_carb", label: "Low-carb or keto" },
        { value: "calorie_restricted", label: "Calorie-restricted / dieting" },
        { value: "standard", label: "Standard diet (no specific approach)" },
        { value: "high_protein", label: "High protein focused" },
        { value: "plant_based", label: "Plant-based / vegetarian / vegan" },
      ],
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
      question: "What would optimal metabolic health look like for you?",
      hint: "What would feeling your best look like?",
      promptLabel: "Health goals",
      placeholder:
        "Example: Normal body temperature, steady energy, healthy weight, mental clarity...",
      rows: 4,
    },
  ],

  nameField: {
    question: "What's your name?",
    hint: "We'll personalize your assessment with your name",
    placeholder: "Your name",
  },

  headline: "Prism Thyroid & Metabolism Assessment",
  subtitle: "Understand why you still feel hypothyroid",
  resultBanner: "Your personalized thyroid assessment is ready",
  ctaText: "Book a Free Consultation",
  ctaUrl: "https://prism.miami/consultation",

  promptOverlay: `## Condition Focus: Thyroid & Metabolism

This person suspects or knows they have thyroid dysfunction. Many have been tested and told their levels are "normal" based on TSH alone. Some are on levothyroxine (T4-only medication) and still symptomatic. They feel cold, tired, foggy, and frustrated that no one can explain why.

Through the bioenergetic lens, the thyroid is the metabolic thermostat — when it's suppressed, everything slows down. But thyroid dysfunction is usually a symptom of deeper issues, not the root cause itself. Look for:

- Testing limitations: if they've been told their thyroid is normal, explain (in the pattern, not as a recommendation) that TSH alone misses most functional hypothyroidism. T4-to-T3 conversion, reverse T3, and free T3 are often where the dysfunction lives. This is often validating — "someone finally sees what I've been saying."
- Liver-thyroid connection: the liver converts most T4 to active T3. Gut-derived endotoxin damages the liver. If they have digestive issues alongside thyroid symptoms, the gut-liver-thyroid cascade is likely central. This is one of the most powerful connections to surface.
- Stress and thyroid: chronic stress increases reverse T3, which blocks active T3 at the receptor. It also suppresses TSH, making labs look "normal" even when thyroid function is impaired. If they report significant stress, this pathway explains how stress directly causes hypothyroid symptoms.
- Dietary suppression: low-carb diets, caloric restriction, and fasting all directly reduce T3 production. Many people with thyroid issues are on restrictive diets that are actively suppressing their thyroid function. This is often the most actionable insight.
- Nutrient factors: selenium, zinc, vitamin D, vitamin A, and iodine all play roles in thyroid hormone production and conversion. The typical eating pattern reveals potential deficiencies.
- The cascade to other symptoms: thyroid suppression explains gut motility issues (constipation), hair/skin changes, weight gain, brain fog, and mood issues all through one mechanism. Connecting these seemingly separate symptoms to one root is the key insight.

Frame patterns so the person understands that their thyroid symptoms have identifiable upstream causes — stress, gut health, diet, liver function — and that addressing those causes is what actually restores thyroid function. Not just "your thyroid is low" but "here's what's suppressing your thyroid."`,
};
