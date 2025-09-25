import { readFileSync } from 'fs';
import { join } from 'path';

// Load bioenergetic knowledge once at module initialization
// This runs server-side so synchronous loading is fine
const KNOWLEDGE_PATH = join(process.cwd(), 'app/api/chat/data/knowledge.md');

export const BIOENERGETIC_KNOWLEDGE = readFileSync(KNOWLEDGE_PATH, 'utf-8');

// Export key concepts for reference (not for prompt injection)
export const BIOENERGETIC_CONCEPTS = {
  pillars: ['gut_health', 'stress', 'thyroid_energy'],

  hierarchyLevels: [
    'root_causes',
    'energy_metabolism',
    'consequences',
    'molecular_cellular',
    'manifestations'
  ],

  rootCauses: [
    'stress',
    'toxins',
    'pathogens',
    'genetics',
    'diet',
    'lifestyle'
  ],

  // Core search terms that emerge from the knowledge
  searchTerms: [
    'mitochondrial', 'metabolic', 'gut-brain axis', 'HPA axis',
    'cortisol', 'thyroid', 'intestinal permeability', 'microbiome',
    'inflammation', 'oxidative stress', 'energy metabolism', 'dysbiosis',
    'serotonin', 'dopamine', 'vagus nerve', 'endotoxin'
  ]
};