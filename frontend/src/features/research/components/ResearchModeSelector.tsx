import { useResearchModeStore } from '../store';
import { ResearchMode } from '@/shared/types';
import { Search, Sparkles, BookOpen } from 'lucide-react';
import './ResearchModeSelector.css';

const MODE_ICONS: Record<ResearchMode, React.ReactNode> = {
  quick: <Search size={14} />,
  enhanced: <Sparkles size={14} />,
  deep: <BookOpen size={14} />,
};

interface ResearchModeSelectorProps {
  compact?: boolean;
}

export function ResearchModeSelector({ compact = false }: ResearchModeSelectorProps) {
  const { modes, activeMode, setActiveMode } = useResearchModeStore();

  return (
    <div className={`research-mode-selector ${compact ? 'compact' : ''}`}>
      {modes.map((modeConfig) => {
        const isActive = modeConfig.mode === activeMode;

        return (
          <button
            key={modeConfig.mode}
            className={`research-mode-toggle ${modeConfig.mode} ${isActive ? 'active' : ''}`}
            onClick={() => setActiveMode(modeConfig.mode)}
            title={modeConfig.description}
            type="button"
          >
            {MODE_ICONS[modeConfig.mode]}
            <span className="mode-label">{modeConfig.label}</span>
            {!compact && (
              <span className="mode-sources">{modeConfig.top_k}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
