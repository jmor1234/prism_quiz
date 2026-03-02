// lib/quiz/variants/weight.ts

import type { VariantConfig } from "../types";

export const weightConfig: VariantConfig = {
  slug: "weight",
  name: "Weight & Body Composition Assessment",
  description:
    "Uncover the metabolic reasons your body resists weight loss",

  questions: [
    {
      id: "weightStruggle",
      type: "single_select",
      question: "What best describes your situation?",
      promptLabel: "Weight situation",
      options: [
        { value: "cant_lose", label: "Can't lose weight despite diet and exercise" },
        { value: "gain_easily", label: "Gain weight very easily" },
        { value: "regain", label: "Lost weight before but it always comes back" },
        { value: "gaining_unchanged", label: "Gaining weight without changing habits" },
        { value: "stuck", label: "Weight seems stuck regardless of what I try" },
      ],
    },
    {
      id: "weightDistribution",
      type: "single_select",
      question: "Where do you tend to carry excess weight?",
      promptLabel: "Weight distribution",
      options: [
        { value: "belly", label: "Belly/midsection" },
        { value: "hips_thighs", label: "Hips and thighs" },
        { value: "all_over", label: "All over evenly" },
        { value: "face_neck", label: "Face/neck puffiness" },
      ],
    },
    {
      id: "dietHistory",
      type: "multi_select",
      question: "What approaches have you tried?",
      hint: "Select all that apply, or skip if none",
      promptLabel: "Diet approaches tried",
      required: false,
      options: [
        { value: "calorie_counting", label: "Calorie counting/restriction" },
        { value: "keto", label: "Keto/low-carb" },
        { value: "fasting", label: "Intermittent fasting" },
        { value: "intense_exercise", label: "Intense exercise programs" },
        { value: "medication", label: "Weight loss medications" },
      ],
    },
    {
      id: "appetite",
      type: "single_select",
      question: "How would you describe your appetite?",
      promptLabel: "Appetite pattern",
      options: [
        { value: "low", label: "Low appetite (have to force myself to eat)" },
        { value: "normal", label: "Normal appetite" },
        { value: "cravings", label: "Strong cravings (especially sugar or salt)" },
        { value: "always_hungry", label: "Always hungry despite eating enough" },
      ],
    },
    {
      id: "puffinessRetention",
      type: "yes_no",
      question: "Do you feel \"puffy\" or retain water easily?",
      promptLabel: "Water retention / puffiness",
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
        "Do you experience bloating, constipation, or other digestive issues?",
      promptLabel: "Digestive issues",
    },
    {
      id: "stressAndSleep",
      type: "single_select",
      question: "How is your stress and sleep?",
      promptLabel: "Stress and sleep",
      options: [
        { value: "high_stress_poor_sleep", label: "High stress and poor sleep" },
        { value: "high_stress_ok_sleep", label: "High stress but sleep okay" },
        { value: "low_stress_poor_sleep", label: "Low stress but poor sleep" },
        { value: "both_good", label: "Both are good" },
      ],
    },
    {
      id: "typicalEating",
      type: "free_text",
      question: "Describe a typical day of eating for you",
      hint: "Include breakfast, lunch, dinner, snacks, and drinks — be as specific as you can",
      promptLabel: "Typical eating pattern",
      placeholder:
        "Example: Coffee and toast for breakfast, salad for lunch, pasta for dinner...",
      rows: 5,
    },
    {
      id: "healthGoals",
      type: "free_text",
      question:
        "What would your ideal relationship with your weight and body look like?",
      hint: "What would feeling your best look like?",
      promptLabel: "Health goals",
      placeholder:
        "Example: Losing weight without constant restriction, stable energy, feeling comfortable in my body...",
      rows: 4,
    },
  ],

  nameField: {
    question: "What's your name?",
    hint: "We'll personalize your assessment with your name",
    placeholder: "Your name",
  },

  headline: "Prism Weight & Body Composition Assessment",
  subtitle: "Uncover why your body resists weight loss",
  resultBanner: "Your personalized weight assessment is ready",
  ctaText: "Book a Free Consultation",
  ctaUrl: "https://prism.miami/consultation",

  promptOverlay: `## Condition Focus: Weight & Body Composition

This person is struggling with weight despite conscious effort. Many have been through cycles of restrictive dieting, intense exercise, and frustration. Some have been told to "just eat less and move more." Others have tried keto, fasting, or calorie counting with temporary results that don't last. Their relationship with food and their body may be strained by repeated failure.

Through the bioenergetic lens, weight is a metabolic output, not a willpower problem. The body stores fat when metabolic conditions make it advantageous. Look for:

- Metabolic rate suppression: this is the central issue. If they report cold extremities, low energy, or any thyroid indicators alongside weight struggles, their metabolic rate is likely suppressed — the body literally cannot burn energy efficiently. No caloric deficit overcomes a crashed metabolism; it only crashes it further.
- Diet-induced metabolic damage: caloric restriction, keto, and fasting all suppress thyroid function (T3 production), increase stress hormones, and lower metabolic rate as an adaptive response. If they've dieted repeatedly, each cycle may have further suppressed their metabolism. This is often the most important insight — their weight loss efforts are the cause, not the cure.
- Stress and cortisol: chronic stress drives visceral fat storage (belly fat) through cortisol-mediated insulin resistance. If they carry weight in the midsection and report high stress, this pathway is likely active.
- Estrogen and fat storage: estrogen promotes fat storage, particularly at hips and thighs, and promotes water retention (puffiness). Gut dysbiosis impairs estrogen clearance, and polyunsaturated fats promote estrogen activity. If they report puffiness or hip/thigh weight alongside digestive issues, the gut-estrogen-fat connection is likely central.
- Gut and metabolic dysfunction: endotoxin from gut dysbiosis induces insulin resistance and promotes weight gain directly. Gut bacteria also affect calorie extraction from food and hormonal signaling around appetite.

Handle this topic with extra sensitivity. Weight is deeply personal and often tied to shame and self-blame. Frame patterns in terms of metabolic systems and biology, never implying laziness or lack of discipline. The core message should be: your body isn't broken and you're not failing — your metabolism is responding to specific conditions, and those conditions can be identified and changed. The patterns should help them see that addressing the root cause (not more restriction) is the path forward.`,
};
