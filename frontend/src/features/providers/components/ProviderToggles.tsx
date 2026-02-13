import { useState } from 'react';
import { MoreVertical } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { useProviderStore } from '../store';
import { ProviderName } from '@/shared/types';
import './ProviderToggles.css';

interface ProviderTogglesProps {
  selectedProvider?: ProviderName;
  onProviderChange?: (name: ProviderName) => void;
  compact?: boolean;
}

export function ProviderToggles({ selectedProvider, onProviderChange, compact = false }: ProviderTogglesProps = {}) {
  const { providers, activeProvider, setActiveProvider } = useProviderStore();
  const [isMobileModalOpen, setIsMobileModalOpen] = useState(false);

  const currentProvider = selectedProvider || activeProvider;
  const handleProviderChange = onProviderChange || setActiveProvider;

  const handleMobileProviderSelect = (name: ProviderName) => {
    handleProviderChange(name);
    setIsMobileModalOpen(false);
  };

  const activeProviderObj = providers.find(p => p.name === currentProvider);

  return (
    <>
      {/* Desktop: Regular toggles */}
      <div className={`provider-toggles ${compact ? 'compact' : ''}`}>
        {providers.map((provider) => {
          const isActive = provider.name === currentProvider;
          const isConfigured = provider.configured;

          return (
            <button
              key={provider.name}
              className={`provider-toggle ${provider.name} ${isActive ? 'active' : ''} ${!isConfigured ? 'disabled' : ''}`}
              onClick={() => handleProviderChange(provider.name)}
              disabled={!isConfigured}
              title={
                isConfigured
                  ? `${provider.display_name} (${provider.model})`
                  : `${provider.display_name} - Not configured`
              }
            >
              {provider.display_name}
            </button>
          );
        })}
      </div>

      {/* Mobile: 3-dot icon button */}
      <button
        className="provider-mobile-btn"
        onClick={() => setIsMobileModalOpen(true)}
        title="Select AI Model"
      >
        <span className="provider-mobile-current">{activeProviderObj?.display_name}</span>
        <MoreVertical size={18} />
      </button>

      {/* Mobile Modal */}
      <Modal
        isOpen={isMobileModalOpen}
        onClose={() => setIsMobileModalOpen(false)}
        title="Select AI Model"
        size="sm"
      >
        <div className="provider-modal-list">
          {providers.map((provider) => {
            const isActive = provider.name === currentProvider;
            const isConfigured = provider.configured;

            return (
              <button
                key={provider.name}
                className={`provider-modal-option ${provider.name} ${isActive ? 'active' : ''}`}
                onClick={() => handleMobileProviderSelect(provider.name)}
                disabled={!isConfigured}
              >
                <div className="provider-modal-option-content">
                  <span className="provider-modal-option-name">{provider.display_name}</span>
                  <span className="provider-modal-option-model">{provider.model}</span>
                </div>
                {isActive && <span className="provider-modal-option-check">✓</span>}
              </button>
            );
          })}
        </div>
      </Modal>
    </>
  );
}
