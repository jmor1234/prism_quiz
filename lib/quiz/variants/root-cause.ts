// lib/quiz/variants/root-cause.ts

import type { VariantConfig } from "../types";

export const rootCauseConfig: VariantConfig = {
  slug: "root-cause",
  name: "Root Cause Health Assessment",
  description:
    "Trace health symptoms to root causes through energy metabolism, gut health, and stress cascades",

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
      id: "crashAfterLunch",
      type: "yes_no",
      question: "Do you tend to crash in energy after lunch?",
      promptLabel: "Crash after lunch",
    },
    {
      id: "difficultyWaking",
      type: "yes_no",
      question: "Do you have difficulty getting up in the morning?",
      promptLabel: "Difficulty waking in the morning",
    },
    {
      id: "wakeAtNight",
      type: "yes_no",
      question: "Do you wake up in the middle of the night?",
      promptLabel: "Wakes in the middle of the night",
      conditionalFollowUp: {
        prompt: "If so, why? (select all that apply)",
        options: [
          { value: "no_reason", label: "No apparent reason", promptLabel: "for no apparent reason" },
          { value: "eat", label: "To eat" },
          { value: "drink", label: "To drink" },
          { value: "pee", label: "To urinate" },
        ],
      },
    },
    {
      id: "brainFog",
      type: "yes_no",
      question:
        "Do you experience brain fog, or impaired motivation, cognitive function, or memory?",
      promptLabel: "Brain fog / impaired cognition",
    },
    {
      id: "bowelIssues",
      type: "multi_select",
      question:
        "Do you experience any of the following with your bowel movements?",
      hint: "Select all that apply, or skip if none",
      promptLabel: "Bowel issues",
      required: false,
      options: [
        { value: "straining", label: "Straining" },
        { value: "pain", label: "Pain" },
        { value: "incomplete", label: "Incomplete emptying" },
        { value: "diarrhea", label: "Diarrhea" },
        { value: "smell", label: "Excessive smell/mess", promptLabel: "excessive smell/messiness" },
      ],
    },
    {
      id: "coldExtremities",
      type: "yes_no",
      question:
        "Do you frequently get cold, especially at the fingers, toes, nose, or ears?",
      promptLabel: "Frequently cold (extremities)",
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
      question: "What health goals are you looking to achieve?",
      hint: "What would feeling your best look like for you?",
      promptLabel: "Health goals",
      placeholder: "Example: More energy, better sleep, improved focus...",
      rows: 4,
    },
  ],

  nameField: {
    question: "What's your name?",
    hint: "We'll personalize your assessment with your name",
    placeholder: "Your name",
  },

  headline: "Prism Health Assessment",
  subtitle: "Trace your symptoms to their root causes",
  resultBanner: "Your personalized assessment is ready",
  ctaText: "Book a Free Consultation",
  ctaUrl: "https://prism.miami/consultation",

  promptOverlay: "",

  ogImage: "/25.png",
};
