import { useProviderStore } from '../../stores/providerStore';
import { ProviderName } from '../../types';
import './ProviderToggles.css';

export function ProviderToggles() {
  const { providers, activeProvider, setActiveProvider } = useProviderStore();

  return (
    <div className="provider-toggles">
      {providers.map((provider) => {
        const isActive = provider.name === activeProvider;
        const isConfigured = provider.configured;

        return (
          <button
            key={provider.name}
            className={`provider-toggle ${provider.name} ${isActive ? 'active' : ''} ${!isConfigured ? 'disabled' : ''}`}
            onClick={() => setActiveProvider(provider.name)}
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
