// lib/quiz/variants/allergies.ts

import type { VariantConfig } from "../types";

export const allergiesConfig: VariantConfig = {
  slug: "allergies",
  name: "Allergy & Immune Assessment",
  description:
    "Uncover the root causes behind your allergic symptoms through the lens of gut health and immune regulation",

  questions: [
    {
      id: "allergyTypes",
      type: "multi_select",
      question: "What allergic or immune-related symptoms do you experience?",
      hint: "Select all that apply",
      promptLabel: "Allergic symptoms",
      options: [
        { value: "seasonal", label: "Seasonal allergies (sneezing, itchy eyes, runny nose)" },
        { value: "congestion", label: "Chronic nasal congestion" },
        { value: "food_sensitivities", label: "Food sensitivities or intolerances" },
        { value: "skin_reactions", label: "Skin reactions (hives, rashes, itching)" },
        { value: "histamine_reactions", label: "Histamine reactions (flushing, headaches after wine or aged foods)" },
        { value: "sinus", label: "Sinus issues or post-nasal drip" },
        { value: "asthma", label: "Asthma or breathing issues" },
      ],
    },
    {
      id: "allergyProgression",
      type: "single_select",
      question: "How have your allergies changed over time?",
      promptLabel: "Allergy progression",
      options: [
        { value: "worsening", label: "Getting worse year over year" },
        { value: "new_allergies", label: "Developed new allergies I didn't used to have" },
        { value: "lifelong", label: "Been roughly the same my whole life" },
        { value: "unpredictable", label: "Come and go unpredictably" },
      ],
    },
    {
      id: "allergyTiming",
      type: "multi_select",
      question: "When are your symptoms typically worst?",
      hint: "Select all that apply, or skip if none",
      promptLabel: "Symptom timing",
      required: false,
      options: [
        { value: "spring_summer", label: "Spring/summer (pollen season)" },
        { value: "year_round", label: "Year-round (no seasonal pattern)" },
        { value: "after_food", label: "After eating certain foods" },
        { value: "during_stress", label: "During or after periods of stress" },
        { value: "before_period", label: "Before my period (if applicable)" },
        { value: "morning", label: "Morning/waking" },
      ],
    },
    {
      id: "histamineSymptoms",
      type: "yes_no",
      question:
        "Do you react to high-histamine foods (wine, aged cheese, fermented foods, cured meats)?",
      promptLabel: "Reacts to high-histamine foods",
    },
    {
      id: "medicationUse",
      type: "multi_select",
      question: "How do you currently manage your allergies?",
      hint: "Select all that apply, or skip if none",
      promptLabel: "Current allergy management",
      required: false,
      options: [
        { value: "antihistamines", label: "Daily antihistamines" },
        { value: "nasal_sprays", label: "Nasal sprays (steroid or decongestant)" },
        { value: "allergy_shots", label: "Allergy shots (immunotherapy)" },
        { value: "avoid_foods", label: "Avoid trigger foods" },
        { value: "avoid_environmental", label: "Avoid environmental triggers" },
        { value: "no_treatment", label: "No treatment currently" },
      ],
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
        { value: "gas", label: "Gas" },
        { value: "food_sensitivities", label: "Food sensitivities" },
        { value: "acid_reflux", label: "Acid reflux" },
        { value: "none", label: "None of these" },
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
      id: "stressLevel",
      type: "yes_no",
      question: "Would you describe your current life as highly stressful?",
      promptLabel: "High stress level",
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
      question: "What would life without allergy symptoms look like for you?",
      hint: "What would feeling your best look like?",
      promptLabel: "Health goals",
      placeholder:
        "Example: No more daily antihistamines, eating without fear of reactions, breathing freely...",
      rows: 4,
    },
  ],

  nameField: {
    question: "What's your name?",
    hint: "We'll personalize your assessment with your name",
    placeholder: "Your name",
  },

  headline: "Prism Allergy & Immune Assessment",
  subtitle:
    "Discover what's actually driving your allergic symptoms and why they may be getting worse",
  resultBanner: "Your personalized allergy & immune assessment is ready",
  ctaText: "Book a Free Consultation",
  ctaUrl: "https://prism.miami/consultation",

  promptOverlay: `## Condition Focus: Allergies & Immune Health

This person is dealing with allergic symptoms — seasonal allergies, food sensitivities, histamine reactions, chronic congestion, skin reactions, or some combination. Many have managed with antihistamines for years and accepted allergies as "just part of life." Some have noticed their allergies worsening over time or developing entirely new sensitivities, which is confusing and concerning. Almost none have been told to look at their gut.

Through the bioenergetic lens, allergies are a gut-immune problem. The mechanism is direct: roughly 70% of the immune system resides in the gut. When the gut barrier is compromised, immune regulation breaks down. The system can no longer distinguish harmless substances (pollen, food proteins, environmental particles) from genuine threats, and it mounts inappropriate immune responses. This is not a random malfunction — it's a predictable consequence of gut barrier deterioration. Look for:

- Progressive gut barrier compromise: if their allergies have worsened over time or they've developed new allergies as an adult, progressive gut barrier deterioration is almost certainly the driver. Each year of worsening dysbiosis = further barrier compromise = broader immune dysregulation = more substances triggering reactions. This explanation is often the most powerful insight — it answers the "why is this getting worse?" question nobody else has answered.

- The gut-allergy connection: if they report ANY digestive symptoms alongside allergic symptoms, the gut-immune axis is the central pattern. Research shows people with chronic sinus issues have a 17-fold increase in IBS risk, suggesting a shared inflammatory origin through the gut. This connection reframes their allergies from an immune problem to a gut problem that manifests as immune dysfunction.

- Histamine cycle: gut dysbiosis drives mast cell activation, which releases histamine, which promotes more inflammation, which damages the gut barrier further. If they react to high-histamine foods (wine, aged cheese, fermented foods), this cycle is active. Estrogen amplifies this by promoting mast cell degranulation, which is why some women experience worse allergies at certain points in their cycle. The gut's role in estrogen metabolism (estrobolome) means gut dysbiosis can increase estrogen levels, worsening the histamine cycle.

- Stress and immune shift: chronic stress shifts the immune system toward a Th2-dominant state, which is the allergic phenotype. Stress also increases gut permeability and elevates histamine directly. If their allergies worsen during stressful periods, the stress-immune pathway is active.

- Thyroid and immune regulation: hypothyroidism impairs gut motility (worsening dysbiosis), suppresses immune tolerance mechanisms, and reduces the body's capacity to regulate inflammation. If they report low energy or cold extremities, thyroid suppression may be contributing to their immune dysregulation.

- Silent gut involvement: some people with significant allergies report no obvious digestive symptoms. The gut barrier can be compromised enough to drive immune dysregulation without producing overt GI symptoms. If their other answers (tongue coating, energy, cold extremities) suggest systemic dysfunction, the gut may still be the driver even without digestive complaints. Note this as a possibility without being presumptive.

Frame patterns around the ROOT of the immune dysregulation. Not "your immune system overreacts" (they already know that) but "here's WHY your immune system has lost its ability to regulate itself, and it traces to specific systems that can be identified and addressed." The most powerful insight for this audience is that allergies are not permanent, not genetic destiny, and not something to just manage with medication — they have identifiable causes in the gut, hormonal, and metabolic systems.

The assessment should leave them thinking: "I've been treating the symptom (the allergic reaction) when the actual problem is somewhere else entirely (my gut / my immune regulation / my metabolic health)." That reframe is what drives the consultation booking.`,
};
