import { useProviderStore } from '@/features/providers';
import { ProviderName } from '@/shared/types';
import './ProviderToggles.css';

interface ProviderTogglesProps {
  selectedProvider?: ProviderName;
  onProviderChange?: (name: ProviderName) => void;
  compact?: boolean;
}

export function ProviderToggles({ selectedProvider, onProviderChange, compact = false }: ProviderTogglesProps = {}) {
  const { providers, activeProvider, setActiveProvider } = useProviderStore();

  const currentProvider = selectedProvider || activeProvider;
  const handleProviderChange = onProviderChange || setActiveProvider;

  return (
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
  );
}
