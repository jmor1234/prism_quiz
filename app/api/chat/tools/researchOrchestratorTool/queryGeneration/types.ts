export interface QueryGenerationPromptInput {
  focusedObjective: string;
  focusAreas: string[];
  keyEntities: string[];
  currentDate?: string;
  recommendedCategories?: string[];
  timeConstraints?: {
    startDate?: string;
    endDate?: string;
    recencyRequired: 'high' | 'medium' | 'low';
  };
}


