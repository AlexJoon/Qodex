from abc import ABC, abstractmethod
from typing import AsyncGenerator, Dict, List, Optional, Type
from app.models.message import Message


class BaseProvider(ABC):
    """Abstract base class for AI providers."""

    def __init__(self, api_key: str, model: str):
        self.api_key = api_key
        self.model = model

    @property
    @abstractmethod
    def provider_name(self) -> str:
        """Return the name of the provider."""
        pass

    @abstractmethod
    async def stream_completion(
        self,
        messages: List[Message],
        context: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: int = 4096,
    ) -> AsyncGenerator[str, None]:
        """
        Stream a completion response.

        Args:
            messages: List of conversation messages
            context: Optional RAG context to include
            temperature: Sampling temperature
            max_tokens: Maximum tokens to generate

        Yields:
            String chunks of the response
        """
        pass

    def _format_messages_for_api(
        self, messages: List[Message], context: Optional[str] = None
    ) -> List[Dict[str, str]]:
        """Format messages for the API, optionally including context with citation instructions."""
        formatted = []

        # Add system message with context if provided
        if context:
            formatted.append({
                "role": "system",
                "content": (
                    "Use the following context to help answer the user's question. "
                    "Each source is numbered. When you reference information from a specific source, "
                    "add a citation marker [N] immediately after the relevant statement, where N is the source number.\n\n"
                    "[Sources for reference]\n"
                    f"{context}\n\n"
                    "Guidelines:\n"
                    "- Add [N] citations inline where information comes from source N\n"
                    "- Multiple sources can be cited together like [1][2]\n"
                    "- Be precise - cite at the claim level, not just at the end of paragraphs\n"
                    "- Natural placement - citations should feel unobtrusive\n\n"
                    "Now provide an accurate and helpful response with inline citations."
                )
            })

        # Add conversation messages (filter out empty messages)
        for msg in messages:
            if msg.content and msg.content.strip():
                formatted.append({
                    "role": msg.role.value,
                    "content": msg.content
                })

        return formatted


class ProviderRegistry:
    """Registry for AI providers."""

    _providers: Dict[str, Type[BaseProvider]] = {}
    _instances: Dict[str, BaseProvider] = {}

    @classmethod
    def register(cls, name: str, provider_class: Type[BaseProvider]) -> None:
        """Register a provider class."""
        cls._providers[name.lower()] = provider_class

    @classmethod
    def get_provider(
        cls, name: str, api_key: str, model: str
    ) -> BaseProvider:
        """Get or create a provider instance."""
        cache_key = f"{name}:{model}"

        if cache_key not in cls._instances:
            provider_class = cls._providers.get(name.lower())
            if not provider_class:
                raise ValueError(f"Unknown provider: {name}")
            cls._instances[cache_key] = provider_class(api_key, model)

        return cls._instances[cache_key]

    @classmethod
    def list_providers(cls) -> List[str]:
        """List all registered provider names."""
        return list(cls._providers.keys())

    @classmethod
    def clear_instances(cls) -> None:
        """Clear cached provider instances."""
        cls._instances.clear()
