import { Search, Sparkles, BookOpen } from 'lucide-react';
import type { ResearchMode } from '@/shared/types';

export interface ResearchModeUIConfig {
  icon: typeof Search;
  label: string;
  description: string;
  rangeLabel: string;
}

export const RESEARCH_MODE_UI: Record<ResearchMode, ResearchModeUIConfig> = {
  quick: {
    icon: Search,
    label: 'Quick',
    description: 'Focused search across your most relevant sources',
    rangeLabel: 'up to 7',
  },
  enhanced: {
    icon: Sparkles,
    label: 'Enhanced',
    description: 'Broader search to find and connect more sources',
    rangeLabel: 'up to 12',
  },
  deep: {
    icon: BookOpen,
    label: 'Deep Research',
    description: 'Widest net for the most thorough, exhaustive analysis',
    rangeLabel: 'up to 16',
  },
};
