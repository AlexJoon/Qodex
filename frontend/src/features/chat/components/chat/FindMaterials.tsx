import { useMemo } from 'react';
import { ExternalLink, FileSearch } from 'lucide-react';
import { extractLinks } from '@/shared/utils/extractLinks';
import './FindMaterials.css';

interface FindMaterialsProps {
  documentContent: string;
}

export function FindMaterials({ documentContent }: FindMaterialsProps) {
  const links = useMemo(() => extractLinks(documentContent), [documentContent]);

  if (links.length === 0) {
    return (
      <div className="find-materials-empty">
        <FileSearch size={32} />
        <p>No links found in this document</p>
      </div>
    );
  }

  return (
    <div className="find-materials">
      <div className="materials-count">{links.length} link{links.length !== 1 ? 's' : ''} found</div>
      <div className="materials-list">
        {links.map((link, i) => (
          <a
            key={i}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className="material-card"
          >
            <div className="material-text">
              <span className="material-label">{link.label || link.display}</span>
              {link.label && <span className="material-url">{link.display}</span>}
            </div>
            <ExternalLink size={14} className="material-icon" />
          </a>
        ))}
      </div>
    </div>
  );
}
