// lib/quiz/variants/anxiety.ts

import type { VariantConfig } from "../types";

export const anxietyConfig: VariantConfig = {
  slug: "anxiety",
  name: "Anxiety & Mood Assessment",
  description:
    "Discover the biological roots of anxiety and mood disturbance",

  questions: [
    {
      id: "moodSymptoms",
      type: "multi_select",
      question: "What are you experiencing?",
      hint: "Select all that apply",
      promptLabel: "Mood/anxiety symptoms",
      options: [
        { value: "persistent_anxiety", label: "Persistent anxiety or worry" },
        { value: "panic_attacks", label: "Panic attacks or sudden anxiety spikes" },
        { value: "low_mood", label: "Low mood or depression" },
        { value: "irritability", label: "Irritability or anger" },
        { value: "mood_swings", label: "Mood swings" },
        { value: "low_motivation", label: "Low motivation or apathy" },
        { value: "hypervigilant", label: "Feeling \"on edge\" or hypervigilant" },
      ],
    },
    {
      id: "anxietyPattern",
      type: "single_select",
      question: "When is your anxiety or mood typically worst?",
      promptLabel: "Anxiety timing",
      options: [
        { value: "morning", label: "Morning" },
        { value: "after_eating", label: "After eating" },
        { value: "afternoon_evening", label: "Afternoon/evening" },
        { value: "night", label: "At night (especially in bed)" },
        { value: "before_period", label: "Before my period (if applicable)" },
        { value: "no_pattern", label: "No clear pattern" },
      ],
    },
    {
      id: "physicalSymptoms",
      type: "multi_select",
      question:
        "Do you experience any physical symptoms alongside your mood?",
      hint: "Select all that apply, or skip if none",
      promptLabel: "Physical symptoms with mood",
      required: false,
      options: [
        { value: "heart_racing", label: "Heart racing or pounding" },
        { value: "breathing", label: "Difficulty breathing" },
        { value: "jitteriness", label: "Jitteriness or restlessness" },
        { value: "nausea", label: "Nausea" },
        { value: "muscle_tension", label: "Muscle tension" },
        { value: "sweating", label: "Sweating" },
      ],
    },
    {
      id: "medicationHistory",
      type: "single_select",
      question:
        "Have you used or are you using medication for mood or anxiety?",
      promptLabel: "Medication history",
      options: [
        { value: "current_ssri", label: "Currently on SSRIs or similar" },
        { value: "previous_medication", label: "Previously tried medication" },
        { value: "current_benzo", label: "Currently on anti-anxiety medication (benzos, etc.)" },
        { value: "not_current", label: "Not currently on medication" },
        { value: "never_tried", label: "Never tried medication" },
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
        { value: "diarrhea", label: "Diarrhea" },
        { value: "constipation", label: "Constipation" },
        { value: "nausea", label: "Nausea" },
        { value: "acid_reflux", label: "Acid reflux" },
        { value: "food_sensitivities", label: "Food sensitivities" },
      ],
    },
    {
      id: "sleepQuality",
      type: "single_select",
      question: "How is your sleep?",
      promptLabel: "Sleep quality",
      options: [
        { value: "falling_asleep", label: "Difficulty falling asleep (mind racing)" },
        { value: "waking_anxious", label: "Wake during the night anxious" },
        { value: "not_rested", label: "Sleep enough but don't feel rested" },
        { value: "fine", label: "Sleep is fine" },
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
      id: "coldExtremities",
      type: "yes_no",
      question:
        "Do you frequently feel cold, especially at your fingers, toes, or nose?",
      promptLabel: "Frequently cold (extremities)",
    },
    {
      id: "bloodSugarSigns",
      type: "yes_no",
      question:
        "Do you get shaky, irritable, or anxious when you go too long without eating?",
      promptLabel: "Blood sugar sensitivity",
    },
    {
      id: "typicalEating",
      type: "free_text",
      question: "Describe a typical day of eating for you",
      hint: "Include breakfast, lunch, dinner, snacks, drinks, and meal timing",
      promptLabel: "Typical eating pattern",
      placeholder:
        "Example: Coffee for breakfast, sandwich for lunch around 1pm, dinner at 7pm...",
      rows: 5,
    },
    {
      id: "healthGoals",
      type: "free_text",
      question: "What would emotional balance and calm feel like for you?",
      hint: "What would feeling your best look like?",
      promptLabel: "Health goals",
      placeholder:
        "Example: Feeling calm and grounded, sleeping peacefully, enjoying life without constant worry...",
      rows: 4,
    },
  ],

  nameField: {
    question: "What's your name?",
    hint: "We'll personalize your assessment with your name",
    placeholder: "Your name",
  },

  headline: "Prism Anxiety & Mood Assessment",
  subtitle: "Discover the biological roots of anxiety",
  resultBanner: "Your personalized mood assessment is ready",
  ctaText: "Book a Free Consultation",
  ctaUrl: "https://prism.miami/consultation",

  promptOverlay: `## Condition Focus: Anxiety & Mood

This person is struggling with anxiety, depression, mood instability, or related symptoms. Many have been offered SSRIs or are currently on them. Some have done therapy, meditation, breathwork, and other approaches without full resolution. Their experience of anxiety or low mood is real and often debilitating — they deserve to have it taken seriously as a biological phenomenon, not dismissed as psychological.

Through the bioenergetic lens, anxiety and mood disturbances are primarily biological, not psychological. The brain is downstream of the body's metabolic and inflammatory state. Look for:

- The serotonin reframe: this is Prism's most distinctive insight for this population. Conventional medicine treats anxiety and depression as serotonin deficiency (hence SSRIs). The bioenergetic model recognizes that excess gut-derived serotonin is often the problem, not the solution. Serotonin produced in response to gut irritation stimulates the HPA axis, increases cortisol, promotes anxiety-like states, and displaces dopamine (reducing motivation and pleasure). If they report digestive issues alongside mood symptoms, this pathway is likely active. Handle this carefully — never tell someone to stop medication, but the mechanistic explanation is valuable.
- Gut-brain axis: gut inflammation directly affects brain function through the vagus nerve, endotoxin-mediated neuroinflammation, and microbial metabolites. The research consistently shows gut dysbiosis correlates with anxiety and depression. If they report digestive symptoms, the gut-mood connection is the primary pattern to surface.
- Blood sugar and anxiety: this is often the most immediately validating insight. When blood sugar drops, stress hormones (adrenaline, cortisol) spike to compensate. This creates anxiety, shakiness, irritability, and panic that feels like a psychiatric symptom but is actually metabolic. If they get anxious when they skip meals or their anxiety spikes after eating (paradoxical — the stress hormones that were maintaining them decline when food arrives, then endotoxin from gut flora produces a delayed anxiety response), blood sugar is involved.
- Stress hormone cascade: lactic acid directly causes panic symptoms. Elevated adrenaline causes hypervigilance and physical anxiety symptoms (heart racing, difficulty breathing). Estrogen stimulates HPA axis activity. These are biological drivers, not character flaws.
- Thyroid and mood: hypothyroidism causes anxiety and depression through neurosteroid deficiency. If they report cold extremities or low energy, thyroid involvement should be surfaced.

Handle this variant with particular care. Mood and anxiety issues carry stigma. Many people have been told their symptoms are "just anxiety" or "in their head." The most powerful thing the assessment can do is validate that their experience has biological roots, identify the likely systems involved, and show them that addressing the biology (not just managing the psychology) is a real path forward. Never dismiss or minimize their experience, and never suggest stopping any medication.`,
};
