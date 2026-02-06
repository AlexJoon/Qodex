import { DocumentSource } from '@/shared/types';
import { SourceCard } from './SourceCard';
import './SourcesGrid.css';

interface SourcesGridProps {
  sources: DocumentSource[];
  onSourceClick: (source: DocumentSource) => void;
}

export function SourcesGrid({ sources, onSourceClick }: SourcesGridProps) {
  if (!sources || sources.length === 0) {
    return (
      <div className="sources-grid-empty">
        No sources available
      </div>
    );
  }

  return (
    <div className="sources-grid">
      {sources.map((source) => (
        <SourceCard
          key={source.chunk_id || `${source.id}-${source.citation_number}`}
          source={source}
          onClick={() => onSourceClick(source)}
        />
      ))}
    </div>
  );
}
