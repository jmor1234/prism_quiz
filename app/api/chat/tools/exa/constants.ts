export const EXA_CATEGORIES = [
  'company',
  'research paper', 
  'news',
  'linkedin profile',
  'github',
  'tweet',
  'movie',
  'song',
  'personal site',
  'pdf',
  'financial report'
] as const;

export type ExaCategory = typeof EXA_CATEGORIES[number]; 


