// lib/quiz/variants/best-life-care.ts
//
// Each Likert question carries its own contextual 5-point option set —
// option `value` stays "1"..."5" so the underlying severity gradient is
// consistent across questions (the LLM can compare severity), while the
// labels and promptLabels are phrased in language specific to that
// question. The two women-only questions (Q10, Q11) prepend an "na" option.

import type { VariantConfig } from "../types";

export const bestLifeCareConfig: VariantConfig = {
  slug: "best-life-care",
  name: "Best Life Care Health Intake",
  description:
    "A deeper look at how you're doing across the systems that drive your health.",

  questions: [
    // 1
    {
      id: "lowAppetite",
      type: "single_select",
      question: "Do you struggle with low appetite?",
      promptLabel: "Low appetite",
      options: [
        { value: "1", label: "My appetite is healthy — I get hungry regularly", promptLabel: "healthy appetite" },
        { value: "2", label: "My appetite is occasionally low", promptLabel: "occasionally low appetite" },
        { value: "3", label: "My appetite is often lower than I'd like", promptLabel: "often low appetite" },
        { value: "4", label: "I rarely feel hungry", promptLabel: "rarely hungry" },
        { value: "5", label: "I almost never have an appetite", promptLabel: "almost never has an appetite" },
      ],
      allowOther: false,
    },
    // 2
    {
      id: "wakeUpDuringSleep",
      type: "single_select",
      question: "Do you tend to wake up when sleeping?",
      promptLabel: "Wakes during sleep",
      options: [
        { value: "1", label: "I sleep through the night", promptLabel: "sleeps through the night" },
        { value: "2", label: "I occasionally wake up", promptLabel: "occasionally wakes" },
        { value: "3", label: "I wake up most nights", promptLabel: "wakes most nights" },
        { value: "4", label: "I wake up multiple times most nights", promptLabel: "wakes multiple times nightly" },
        { value: "5", label: "I rarely sleep through the night", promptLabel: "rarely sleeps through the night" },
      ],
      allowOther: false,
    },
    // 3 — hidden if Q2 says "I sleep through the night"
    {
      id: "wakeUpTiming",
      type: "single_select",
      question:
        "When you wake up during the night, is it within the first few hours of falling asleep, later on, or both?",
      promptLabel: "When wakes occur",
      hideWhen: {
        questionId: "wakeUpDuringSleep",
        is: "1",
        setAnswerTo: "no_wake",
      },
      options: [
        { value: "no_wake", label: "I do not wake up when sleeping", promptLabel: "does not wake up" },
        { value: "early", label: "First few hours", promptLabel: "first few hours" },
        { value: "late", label: "Later in the night", promptLabel: "later in the night" },
        { value: "both", label: "Both", promptLabel: "both" },
      ],
      allowOther: false,
    },
    // 4 — hidden if Q3 = "no_wake" (cascades from Q2 = "1" via Q3 auto-fill)
    {
      id: "wakeUpReasons",
      type: "multi_select",
      question:
        "When you wake up, is it to urinate, eat something, drink something, or seemingly no reason?",
      hint: "Select all that apply",
      promptLabel: "Reasons for waking",
      hideWhen: {
        questionId: "wakeUpTiming",
        is: "no_wake",
        setAnswerTo: ["no_wake"],
      },
      options: [
        { value: "no_wake", label: "I do not wake up when sleeping", promptLabel: "does not wake up" },
        { value: "urinate", label: "Urinate", promptLabel: "to urinate" },
        { value: "eat", label: "Eat something", promptLabel: "to eat" },
        { value: "drink", label: "Drink something", promptLabel: "to drink" },
        { value: "no_reason", label: "Seemingly no reason", promptLabel: "no apparent reason" },
      ],
      allowOther: false,
    },
    // 5 — same condition as Q4
    {
      id: "wakeUpHotSweaty",
      type: "single_select",
      question: "When you wake up, do you find that you are hot or sweaty?",
      promptLabel: "Hot/sweaty on waking",
      hideWhen: {
        questionId: "wakeUpTiming",
        is: "no_wake",
        setAnswerTo: "no_wake",
      },
      options: [
        { value: "no_wake", label: "I do not wake up when sleeping", promptLabel: "does not wake up" },
        { value: "yes", label: "Yes", promptLabel: "yes" },
        { value: "no", label: "No", promptLabel: "no" },
      ],
      allowOther: false,
    },
    // 6
    {
      id: "noDreams",
      type: "single_select",
      question: "Do you NOT dream?",
      promptLabel: "Lack of dreams",
      options: [
        { value: "1", label: "I dream regularly and often remember them", promptLabel: "dreams regularly, recalls them" },
        { value: "2", label: "I dream sometimes but don't always recall", promptLabel: "dreams sometimes, sporadic recall" },
        { value: "3", label: "I rarely remember my dreams", promptLabel: "rarely recalls dreams" },
        { value: "4", label: "I almost never dream or recall dreams", promptLabel: "almost never dreams or recalls" },
        { value: "5", label: "I never dream", promptLabel: "never dreams" },
      ],
      allowOther: false,
    },
    // 7
    {
      id: "troubleFallingAsleep",
      type: "single_select",
      question: "Do you have trouble falling asleep?",
      promptLabel: "Trouble falling asleep",
      options: [
        { value: "1", label: "I fall asleep easily", promptLabel: "falls asleep easily" },
        { value: "2", label: "I sometimes lie awake before falling asleep", promptLabel: "sometimes lies awake briefly" },
        { value: "3", label: "I often have trouble falling asleep", promptLabel: "often has trouble falling asleep" },
        { value: "4", label: "I usually lie awake for a long time before sleep", promptLabel: "usually lies awake a long time" },
        { value: "5", label: "Falling asleep is a major struggle most nights", promptLabel: "major struggle to fall asleep" },
      ],
      allowOther: false,
    },
    // 8
    {
      id: "nonRestfulSleep",
      type: "single_select",
      question: "Do you feel like you DON'T get a restful sleep?",
      promptLabel: "Non-restful sleep",
      options: [
        { value: "1", label: "I wake up feeling rested", promptLabel: "wakes rested" },
        { value: "2", label: "I usually feel rested but sometimes not", promptLabel: "usually rested, sometimes not" },
        { value: "3", label: "I often wake up feeling unrested", promptLabel: "often wakes unrested" },
        { value: "4", label: "I usually wake up feeling exhausted", promptLabel: "usually wakes exhausted" },
        { value: "5", label: "I never feel rested no matter how long I sleep", promptLabel: "never feels rested" },
      ],
      allowOther: false,
    },
    // 9
    {
      id: "coldExtremities",
      type: "single_select",
      question:
        "Do you frequently feel cold, especially at the extremities (fingertips, toes, and nose)?",
      promptLabel: "Cold extremities",
      options: [
        { value: "1", label: "My extremities are usually warm", promptLabel: "extremities usually warm" },
        { value: "2", label: "My extremities get cold occasionally", promptLabel: "extremities occasionally cold" },
        { value: "3", label: "My extremities are often cold", promptLabel: "extremities often cold" },
        { value: "4", label: "My extremities are cold most of the time", promptLabel: "extremities cold most of the time" },
        { value: "5", label: "My extremities are almost always cold, even in warm rooms", promptLabel: "extremities almost always cold, even in warm rooms" },
      ],
      allowOther: false,
    },
    // 10
    {
      id: "menstrualCramps",
      type: "single_select",
      question: "[For women] Do you frequently have painful menstrual cramps?",
      promptLabel: "Painful menstrual cramps",
      options: [
        { value: "na", label: "Not Applicable", promptLabel: "not applicable" },
        { value: "1", label: "My periods are mostly pain-free", promptLabel: "mostly pain-free periods" },
        { value: "2", label: "I have mild cramps occasionally", promptLabel: "mild occasional cramps" },
        { value: "3", label: "I have noticeable cramps most cycles", promptLabel: "noticeable cramps most cycles" },
        { value: "4", label: "I have intense cramps that affect my day", promptLabel: "intense cramps affect daily life" },
        { value: "5", label: "Cramps regularly stop me from functioning", promptLabel: "cramps regularly disabling" },
      ],
      allowOther: false,
    },
    // 11 — hidden if Q10 = "na"
    {
      id: "irregularMenstruationPMS",
      type: "single_select",
      question:
        "[For women] Do you frequently have irregular menstruation or suffer from premenstrual syndrome?",
      promptLabel: "Irregular menstruation / PMS",
      hideWhen: {
        questionId: "menstrualCramps",
        is: "na",
        setAnswerTo: "na",
      },
      options: [
        { value: "na", label: "Not Applicable", promptLabel: "not applicable" },
        { value: "1", label: "My cycle is regular and PMS is minimal", promptLabel: "regular cycle, minimal PMS" },
        { value: "2", label: "I have mild PMS or occasional irregularity", promptLabel: "mild PMS or occasional irregularity" },
        { value: "3", label: "I have noticeable PMS or irregular cycles", promptLabel: "noticeable PMS or irregular cycles" },
        { value: "4", label: "I have severe PMS or significantly irregular cycles", promptLabel: "severe PMS or significantly irregular cycles" },
        { value: "5", label: "My cycles are very irregular or PMS is debilitating", promptLabel: "very irregular or debilitating PMS" },
      ],
      allowOther: false,
    },
    // 12
    {
      id: "chronicCongestionWithoutMucus",
      type: "single_select",
      question: "Do you suffer from chronic congestion without mucus?",
      promptLabel: "Chronic congestion (no mucus)",
      options: [
        { value: "1", label: "My nose feels clear most of the time", promptLabel: "nose usually clear" },
        { value: "2", label: "I get stuffy occasionally", promptLabel: "occasional stuffiness" },
        { value: "3", label: "I'm often congested without anything coming out", promptLabel: "often congested, no mucus" },
        { value: "4", label: "I'm congested most days without mucus", promptLabel: "most days congested, no mucus" },
        { value: "5", label: "I'm constantly stuffed up but nothing comes out", promptLabel: "constantly stuffed without mucus" },
      ],
      allowOther: false,
    },
    // 13
    {
      id: "mucusBuildup",
      type: "single_select",
      question: "Do you frequently experience mucus buildup in the throat or nose?",
      promptLabel: "Mucus buildup (throat/nose)",
      options: [
        { value: "1", label: "I rarely have mucus issues", promptLabel: "rarely has mucus" },
        { value: "2", label: "I get some mucus buildup occasionally", promptLabel: "occasional mucus buildup" },
        { value: "3", label: "I often have mucus in my throat or nose", promptLabel: "often has mucus in throat/nose" },
        { value: "4", label: "I deal with mucus buildup most days", promptLabel: "mucus buildup most days" },
        { value: "5", label: "There's constant mucus I have to clear", promptLabel: "constantly clearing mucus" },
      ],
      allowOther: false,
    },
    // 14
    {
      id: "dentalProblems",
      type: "single_select",
      question:
        "Do you suffer from dental problems such as bad breath, cavities, and gum inflammation?",
      promptLabel: "Dental problems",
      options: [
        { value: "1", label: "My teeth and gums are healthy", promptLabel: "healthy teeth and gums" },
        { value: "2", label: "I have minor dental issues now and then", promptLabel: "minor occasional dental issues" },
        { value: "3", label: "I have ongoing minor issues like occasional cavities or bad breath", promptLabel: "ongoing minor cavities or bad breath" },
        { value: "4", label: "I have frequent cavities, gum problems, or persistent bad breath", promptLabel: "frequent cavities/gum issues/bad breath" },
        { value: "5", label: "I have significant ongoing dental issues", promptLabel: "significant ongoing dental issues" },
      ],
      allowOther: false,
    },
    // 15
    {
      id: "irritability",
      type: "single_select",
      question: "Do you often find that you are irritable or easily agitated?",
      promptLabel: "Irritability / agitation",
      options: [
        { value: "1", label: "I'm generally even-tempered", promptLabel: "generally even-tempered" },
        { value: "2", label: "I get irritable occasionally", promptLabel: "occasionally irritable" },
        { value: "3", label: "I'm often more on edge than I'd like", promptLabel: "often on edge" },
        { value: "4", label: "I'm irritable most days", promptLabel: "irritable most days" },
        { value: "5", label: "I feel agitated almost constantly", promptLabel: "almost constantly agitated" },
      ],
      allowOther: false,
    },
    // 16
    {
      id: "brainFog",
      type: "single_select",
      question:
        "Do you suffer from \"brain fog,\" low energy, or feel like you do not have mental clarity?",
      promptLabel: "Brain fog / low mental clarity",
      options: [
        { value: "1", label: "My thinking feels sharp and clear", promptLabel: "sharp and clear thinking" },
        { value: "2", label: "I have foggy moments occasionally", promptLabel: "occasional foggy moments" },
        { value: "3", label: "I'm often foggy or low-energy", promptLabel: "often foggy or low-energy" },
        { value: "4", label: "Brain fog is a regular part of my day", promptLabel: "brain fog regular part of day" },
        { value: "5", label: "I feel mentally cloudy most of the time", promptLabel: "mentally cloudy most of the time" },
      ],
      allowOther: false,
    },
    // 17
    {
      id: "afternoonCrash",
      type: "single_select",
      question: "Do you tend to have an \"afternoon crash\" after eating lunch?",
      promptLabel: "Afternoon crash after lunch",
      options: [
        { value: "1", label: "I have steady energy after lunch", promptLabel: "steady afternoon energy" },
        { value: "2", label: "I sometimes feel a small dip after lunch", promptLabel: "occasional small afternoon dip" },
        { value: "3", label: "I often feel a clear energy crash after lunch", promptLabel: "often crashes after lunch" },
        { value: "4", label: "I crash hard most afternoons", promptLabel: "crashes hard most afternoons" },
        { value: "5", label: "I'm wiped out almost every afternoon after eating", promptLabel: "wiped out almost every afternoon" },
      ],
      allowOther: false,
    },
    // 18
    {
      id: "hyperAware",
      type: "single_select",
      question: "Do you often feel \"hyper aware,\" jittery, or restless?",
      promptLabel: "Hyper aware / jittery / restless",
      options: [
        { value: "1", label: "I generally feel calm and settled", promptLabel: "calm and settled" },
        { value: "2", label: "I feel jittery now and then", promptLabel: "occasionally jittery" },
        { value: "3", label: "I often feel wired or restless", promptLabel: "often wired or restless" },
        { value: "4", label: "I feel hyper-aware most days", promptLabel: "hyper-aware most days" },
        { value: "5", label: "I feel constantly on edge or wired", promptLabel: "constantly on edge or wired" },
      ],
      allowOther: false,
    },
    // 19
    {
      id: "heartPoundingBreathing",
      type: "single_select",
      question:
        "Do you often notice the sensation of your heart pounding or difficulty breathing?",
      promptLabel: "Heart pounding / difficulty breathing",
      options: [
        { value: "1", label: "I rarely notice my heart or breathing", promptLabel: "rarely notices heart or breathing" },
        { value: "2", label: "I notice it occasionally", promptLabel: "occasionally notices" },
        { value: "3", label: "I often feel my heart pounding or breath catching", promptLabel: "often feels heart pounding or breath catching" },
        { value: "4", label: "I notice these sensations most days", promptLabel: "notices these sensations most days" },
        { value: "5", label: "I feel my heart or breathing struggle almost constantly", promptLabel: "almost constant heart/breathing struggle" },
      ],
      allowOther: false,
    },
    // 20
    {
      id: "anhedonia",
      type: "single_select",
      question:
        "Have you experienced a loss of pleasure in activities you normally enjoy?",
      promptLabel: "Loss of pleasure in usual activities",
      options: [
        { value: "1", label: "I still enjoy the things I love", promptLabel: "still enjoys things" },
        { value: "2", label: "Things feel a little less enjoyable lately", promptLabel: "slightly less enjoyment" },
        { value: "3", label: "I'm noticeably less engaged with things I used to enjoy", promptLabel: "noticeably less engaged" },
        { value: "4", label: "Most things don't bring me much pleasure anymore", promptLabel: "most things bring little pleasure" },
        { value: "5", label: "I don't get pleasure from anything I used to love", promptLabel: "no pleasure from former activities" },
      ],
      allowOther: false,
    },
    // 21
    {
      id: "lowLibido",
      type: "single_select",
      question: "Have you noticed a lack of sexual interest or desire?",
      promptLabel: "Low sexual interest / desire",
      options: [
        { value: "1", label: "My libido feels normal for me", promptLabel: "normal libido" },
        { value: "2", label: "My desire is a bit lower than usual", promptLabel: "slightly lower desire" },
        { value: "3", label: "I've noticed a clear drop in interest", promptLabel: "clear drop in interest" },
        { value: "4", label: "My libido is very low most of the time", promptLabel: "very low libido most of the time" },
        { value: "5", label: "I have essentially no sexual interest", promptLabel: "essentially no sexual interest" },
      ],
      allowOther: false,
    },
    // 22
    {
      id: "skinIssues",
      type: "single_select",
      question: "Do you have skin issues such as dry skin, eczema, or acne?",
      promptLabel: "Skin issues",
      options: [
        { value: "1", label: "My skin is healthy and clear", promptLabel: "healthy clear skin" },
        { value: "2", label: "I have occasional skin flare-ups", promptLabel: "occasional flare-ups" },
        { value: "3", label: "I have ongoing minor skin issues", promptLabel: "ongoing minor skin issues" },
        { value: "4", label: "My skin is regularly dry, broken out, or inflamed", promptLabel: "regularly dry, broken out, or inflamed" },
        { value: "5", label: "I deal with significant skin problems daily", promptLabel: "significant daily skin problems" },
      ],
      allowOther: false,
    },
    // 23 — allows "Unsure" (e.g., undiagnosed but suspected struggles)
    {
      id: "mentalHealthHistory",
      type: "yes_no_with_text",
      question: "Do you have a history of mental health issues?",
      promptLabel: "Mental health history",
      allowUnsure: true,
      textPrompt: "If yes or unsure, please share what you've experienced.",
      placeholder: "e.g., diagnosed anxiety, struggled with depression but never diagnosed…",
      rows: 3,
    },
    // 24 — allows "Unsure" (many users haven't checked or don't know what to look for)
    {
      id: "whiteTongueCoating",
      type: "yes_no",
      question: "Do you notice your tongue has a white coating on it?",
      promptLabel: "White tongue coating",
      allowUnsure: true,
    },
    // 25
    {
      id: "constipation",
      type: "single_select",
      question: "Do you experience constipation?",
      promptLabel: "Constipation",
      options: [
        { value: "1", label: "I have regular, easy bowel movements", promptLabel: "regular easy BMs" },
        { value: "2", label: "I'm sometimes a bit backed up", promptLabel: "occasionally backed up" },
        { value: "3", label: "I'm often constipated", promptLabel: "often constipated" },
        { value: "4", label: "I'm constipated most of the time", promptLabel: "constipated most of the time" },
        { value: "5", label: "I'm severely or persistently constipated", promptLabel: "severely or persistently constipated" },
      ],
      allowOther: false,
    },
    // 26
    {
      id: "bloating",
      type: "single_select",
      question: "Do you experience bloating or distension of your gut?",
      promptLabel: "Bloating / gut distension",
      options: [
        { value: "1", label: "My stomach feels normal after meals", promptLabel: "normal post-meal stomach" },
        { value: "2", label: "I bloat occasionally", promptLabel: "occasional bloating" },
        { value: "3", label: "I bloat after most meals", promptLabel: "bloats after most meals" },
        { value: "4", label: "I bloat severely most days", promptLabel: "severe bloating most days" },
        { value: "5", label: "I feel uncomfortably bloated almost constantly", promptLabel: "constantly uncomfortably bloated" },
      ],
      allowOther: false,
    },
    // 27
    {
      id: "diarrhea",
      type: "single_select",
      question: "Do you experience diarrhea?",
      promptLabel: "Diarrhea",
      options: [
        { value: "1", label: "My stools are normal and consistent", promptLabel: "normal consistent stools" },
        { value: "2", label: "I have loose stools occasionally", promptLabel: "occasional loose stools" },
        { value: "3", label: "I have diarrhea fairly often", promptLabel: "diarrhea fairly often" },
        { value: "4", label: "I have diarrhea most days", promptLabel: "diarrhea most days" },
        { value: "5", label: "I have persistent or daily diarrhea", promptLabel: "persistent daily diarrhea" },
      ],
      allowOther: false,
    },
    // 28 — allows "Unsure" ("I suspect dairy but I'm not 100% sure")
    {
      id: "triggerFoods",
      type: "yes_no_with_text",
      question: "Are you aware of any specific foods that trigger symptoms?",
      promptLabel: "Trigger foods",
      allowUnsure: true,
      textPrompt: "If yes or unsure, please list them.",
      placeholder: "e.g., dairy, gluten, FODMAPs, nightshades, or 'I suspect dairy but I'm not sure'…",
      rows: 3,
    },
    // 29
    {
      id: "acidReflux",
      type: "single_select",
      question: "Do you experience acid reflux?",
      promptLabel: "Acid reflux",
      options: [
        { value: "1", label: "I never have reflux", promptLabel: "never has reflux" },
        { value: "2", label: "I get reflux now and then", promptLabel: "occasional reflux" },
        { value: "3", label: "I have reflux fairly often, especially after some meals", promptLabel: "fairly often, after some meals" },
        { value: "4", label: "I have reflux most days", promptLabel: "reflux most days" },
        { value: "5", label: "I have severe or near-constant reflux", promptLabel: "severe near-constant reflux" },
      ],
      allowOther: false,
    },
    // 30
    {
      id: "symptomsAfterEating",
      type: "single_select",
      question: "Do your symptoms worsen IMMEDIATELY after eating?",
      promptLabel: "Symptoms worsen immediately after eating",
      options: [
        { value: "1", label: "Eating doesn't trigger symptoms for me", promptLabel: "eating doesn't trigger symptoms" },
        { value: "2", label: "I notice slight worsening after some meals", promptLabel: "slight worsening after some meals" },
        { value: "3", label: "My symptoms often flare right after eating", promptLabel: "often flares right after eating" },
        { value: "4", label: "My symptoms get noticeably worse after most meals", promptLabel: "noticeably worse after most meals" },
        { value: "5", label: "Eating reliably and significantly worsens my symptoms", promptLabel: "eating reliably worsens symptoms significantly" },
      ],
      allowOther: false,
    },
    // 31
    {
      id: "loosePoorlyFormedStools",
      type: "yes_no",
      question: "Do you experience loose, messy, or poorly formed bowel movements?",
      promptLabel: "Loose / poorly formed stools",
    },
    // 32
    {
      id: "pastAttempts",
      type: "yes_no_with_text",
      question: "Have you tried anything in the past to alleviate your symptoms?",
      hint:
        "These can be dietary changes, supplements, prescriptions, or anything else.",
      promptLabel: "Past attempts to alleviate symptoms",
      textPrompt:
        "If yes, please list them, and how helpful (or unhelpful) they were. Include specific foods, brands, dosages, and which symptoms they affected.",
      placeholder:
        "e.g., 3 months of low-FODMAP diet — modest help with bloating; magnesium glycinate 400mg nightly — improved sleep…",
      rows: 5,
    },
    // 33
    {
      id: "diagnosedConditions",
      type: "yes_no_with_text",
      question: "Are you currently diagnosed with any medical conditions?",
      promptLabel: "Currently diagnosed conditions",
      textPrompt: "If yes, please list them.",
      placeholder: "e.g., hypothyroidism, IBS, PCOS…",
      rows: 3,
    },
    // 34
    {
      id: "diet",
      type: "free_text",
      question: "Please describe your diet.",
      hint:
        "What foods do you typically eat, and in what amounts? Are these foods prepared by you, pre-packaged, or from a restaurant? At what times do you typically eat?",
      promptLabel: "Diet description",
      placeholder:
        "Example: Eggs and toast for breakfast around 8am, sandwich at noon, home-cooked dinner around 7pm…",
      rows: 6,
    },
    // 35
    {
      id: "lifestyle",
      type: "free_text",
      question: "Please describe your lifestyle.",
      hint:
        "Do you get outside often? Do you exercise? How stressful is your day-to-day life due to work or other factors?",
      promptLabel: "Lifestyle description",
      placeholder:
        "Example: Mostly indoor desk job, walk the dog 30 min/day, gym twice a week, moderate work stress…",
      rows: 5,
    },
    // 36
    {
      id: "topImprovementGoal",
      type: "free_text",
      question: "What about your health specifically do you want to improve the most?",
      promptLabel: "Top health improvement goal",
      placeholder:
        "Example: More consistent energy, better sleep, fewer digestive issues…",
      rows: 4,
    },
    // 37
    {
      id: "traceToEvent",
      type: "free_text",
      question:
        "Can you trace your symptoms back to a specific event or time in your life when they started or worsened?",
      hint:
        "If so, please describe what happened. If not, you can leave this blank.",
      promptLabel: "Possible onset event",
      placeholder:
        "Example: Started after a major illness in 2021 / after my second pregnancy / after a course of antibiotics…",
      rows: 5,
      required: false,
    },
    // 38
    {
      id: "additionalContext",
      type: "free_text",
      question: "Please list any other information you think would help us help you.",
      promptLabel: "Additional context",
      placeholder: "Anything else you'd like us to know.",
      rows: 4,
      required: false,
    },
  ],

  nameField: {
    question: "What's your name?",
    hint: "We'll personalize your assessment with your name",
    placeholder: "Your name",
  },

  headline: "Best Life Care Health Intake",
  subtitle:
    "A deeper look at how you're doing across the systems that drive your health.",
  resultBanner: "Your personalized intake assessment is ready",
  ctaText: "Book a Free Call With Us",
  ctaUrl: "https://prism.miami/consultation",

  promptOverlay: "",
  hidden: true,
};
