// lib/quiz/variants/skin.ts

import type { VariantConfig } from "../types";

export const skinConfig: VariantConfig = {
  slug: "skin",
  name: "Skin Health Assessment",
  description:
    "Trace persistent skin issues to their gut health and metabolic origins",

  questions: [
    {
      id: "skinConditions",
      type: "multi_select",
      question: "What skin issues are you dealing with?",
      hint: "Select all that apply",
      promptLabel: "Skin conditions",
      options: [
        { value: "acne", label: "Acne" },
        { value: "eczema", label: "Eczema" },
        { value: "psoriasis", label: "Psoriasis" },
        { value: "dry_flaky", label: "Dry/flaky skin" },
        { value: "rosacea", label: "Rosacea" },
        { value: "dandruff", label: "Dandruff/scalp issues" },
        { value: "rashes", label: "Unexplained rashes" },
      ],
    },
    {
      id: "skinOnset",
      type: "single_select",
      question: "When did your skin issues start or significantly worsen?",
      promptLabel: "Skin issue onset",
      options: [
        { value: "puberty", label: "Puberty/adolescence" },
        { value: "post_bc", label: "After stopping birth control" },
        { value: "post_stress", label: "After a period of stress" },
        { value: "post_diet", label: "After a dietary change" },
        { value: "post_antibiotics", label: "After antibiotics" },
        { value: "gradual", label: "Gradually over time" },
        { value: "always", label: "Always had them" },
      ],
    },
    {
      id: "skinLocation",
      type: "multi_select",
      question: "Where are your skin issues primarily located?",
      hint: "Select all that apply",
      promptLabel: "Skin issue location",
      options: [
        { value: "jawline_chin", label: "Face (jawline/chin)" },
        { value: "forehead_cheeks", label: "Face (forehead/cheeks)" },
        { value: "chest_back", label: "Chest or back" },
        { value: "arms_legs", label: "Arms or legs" },
        { value: "scalp", label: "Scalp" },
        { value: "hands", label: "Hands" },
      ],
    },
    {
      id: "topicalHistory",
      type: "multi_select",
      question: "What have you tried for your skin?",
      hint: "Select all that apply, or skip if none",
      promptLabel: "Treatments tried",
      required: false,
      options: [
        { value: "topicals", label: "Topical creams/retinoids" },
        { value: "antibiotics", label: "Antibiotics" },
        { value: "accutane", label: "Accutane/isotretinoin" },
        { value: "birth_control", label: "Birth control (for skin)" },
        { value: "dietary_changes", label: "Dietary changes" },
        { value: "probiotics", label: "Probiotics" },
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
        { value: "food_sensitivities", label: "Food sensitivities" },
        { value: "gas", label: "Gas" },
        { value: "acid_reflux", label: "Acid reflux" },
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
      id: "foodSkinConnection",
      type: "yes_no",
      question: "Do certain foods seem to trigger or worsen your skin?",
      promptLabel: "Food triggers skin issues",
    },
    {
      id: "hormonalPattern",
      type: "single_select",
      question:
        "(If applicable) Do your skin issues worsen around your menstrual cycle?",
      promptLabel: "Hormonal skin pattern",
      options: [
        { value: "before_period", label: "Yes — worse before my period" },
        { value: "around_ovulation", label: "Yes — worse around ovulation" },
        { value: "no_pattern", label: "No pattern related to cycle" },
        { value: "not_applicable", label: "Not applicable" },
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
      question: "What would clear, healthy skin mean for your life?",
      hint: "What would feeling your best look like?",
      promptLabel: "Health goals",
      placeholder:
        "Example: Clear skin without makeup, confidence going out, not worrying about flare-ups...",
      rows: 4,
    },
  ],

  nameField: {
    question: "What's your name?",
    hint: "We'll personalize your assessment with your name",
    placeholder: "Your name",
  },

  headline: "Prism Skin Health Assessment",
  subtitle: "Trace skin issues to their internal origins",
  resultBanner: "Your personalized skin health assessment is ready",
  ctaText: "Book a Free Consultation",
  ctaUrl: "https://prism.miami/consultation",

  promptOverlay: `## Condition Focus: Skin Health

This person is dealing with persistent skin issues — acne, eczema, psoriasis, or similar conditions. Many have been through dermatologists, topical treatments, antibiotics, and possibly Accutane. Some have been told their skin is "just genetics" or "hormonal" without getting deeper answers. The visual nature of skin problems makes them particularly distressing — this person is often highly motivated to find a real solution.

Through the bioenergetic lens, the skin is a window into internal health. Nearly all chronic skin conditions trace back to gut dysfunction, hormonal imbalance, or both. Look for:

- The gut-skin axis: this is the central connection. Intestinal permeability (leaky gut) allows endotoxin and inflammatory compounds to enter the bloodstream, triggering skin inflammation. Acne, eczema, psoriasis, and dandruff are all strongly associated with gut dysbiosis in the research. If they report ANY digestive symptoms alongside skin issues, this connection is almost certainly active.
- Estrogen and skin: estrogen excess promotes inflammatory skin conditions through histamine release and immune activation. Jawline acne, premenstrual skin flares, and post-birth-control skin changes all point to estrogen involvement. The gut's role in estrogen metabolism (estrobolome) ties this back to gut health.
- Microbial connections: the knowledge base links dental problems, tongue coating, and digestive symptoms to the same microbial overgrowth driving skin issues. Dandruff (Malassezia yeast) may reflect gut fungal imbalance. These connections help the agent draw a more complete picture.
- Prior treatment effects: antibiotics and Accutane both significantly disrupt the gut microbiome. If their skin worsened after these treatments (common long-term pattern), the treatment itself may have deepened the gut dysfunction driving the original skin problem.
- Dietary inflammatory drivers: PUFAs promote inflammation that manifests in the skin. Food sensitivities suggest gut permeability. The diet question is especially important for skin variants.

Frame patterns around the gut-skin connection as the primary insight. Most people with skin issues have never been told to look at their gut. The reframe is: your skin is not the problem — it's showing you that something deeper is going on. The patterns should connect their skin condition to the internal systems driving it.`,
};
