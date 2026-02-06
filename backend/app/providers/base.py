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
        intent_prompt: Optional[str] = None,
        research_prompt: Optional[str] = None,
    ) -> AsyncGenerator[str, None]:
        """
        Stream a completion response.

        Args:
            messages: List of conversation messages
            context: Optional RAG context to include
            temperature: Sampling temperature
            max_tokens: Maximum tokens to generate
            intent_prompt: Optional intent-specific prompt suffix to append to system message
            research_prompt: Optional research depth prompt to control response thoroughness

        Yields:
            String chunks of the response
        """
        pass

    @abstractmethod
    async def generate_suggested_questions(
        self,
        conversation_history: List[Dict[str, str]],
        last_response: str,
        count: int = 5
    ) -> List[str]:
        """
        Generate suggested follow-up questions based on conversation context.

        Args:
            conversation_history: List of message dicts with 'role' and 'content'
            last_response: The assistant's most recent response
            count: Number of questions to generate (default 5)

        Returns:
            List of suggested question strings (max `count` items)
        """
        pass

    def _format_messages_for_api(
        self,
        messages: List[Message],
        context: Optional[str] = None,
        intent_prompt: Optional[str] = None,
        research_prompt: Optional[str] = None,
    ) -> List[Dict[str, str]]:
        """Format messages for the API, optionally including context with citation instructions."""
        formatted = []

        # Add system message with context if provided
        if context:
            system_content = (
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

            # Append research depth instructions (controls thoroughness)
            if research_prompt:
                system_content += research_prompt

            # Append intent-specific output structure if present
            if intent_prompt:
                system_content += intent_prompt

            formatted.append({
                "role": "system",
                "content": system_content
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
