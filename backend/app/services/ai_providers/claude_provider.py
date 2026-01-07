from typing import AsyncGenerator, List, Optional
from anthropic import AsyncAnthropic

from app.models.message import Message
from .base import BaseProvider, ProviderRegistry


class ClaudeProvider(BaseProvider):
    """Anthropic Claude API provider implementation."""

    def __init__(self, api_key: str, model: str = "claude-sonnet-4-20250514"):
        super().__init__(api_key, model)
        self.client = AsyncAnthropic(api_key=api_key)

    @property
    def provider_name(self) -> str:
        return "claude"

    async def stream_completion(
        self,
        messages: List[Message],
        context: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: int = 4096,
    ) -> AsyncGenerator[str, None]:
        """Stream completion from Claude."""
        # Claude uses a different message format
        system_message = None
        formatted_messages = []

        if context:
            system_message = f"Use the following context to help answer the user's question:\n\n{context}\n\nProvide accurate and helpful responses based on this context when relevant."

        for msg in messages:
            if msg.role.value == "system":
                # Combine system messages
                if system_message:
                    system_message = f"{system_message}\n\n{msg.content}"
                else:
                    system_message = msg.content
            else:
                formatted_messages.append({
                    "role": msg.role.value,
                    "content": msg.content
                })

        # Ensure we have at least one user message
        if not formatted_messages:
            formatted_messages = [{"role": "user", "content": "Hello"}]

        async with self.client.messages.stream(
            model=self.model,
            max_tokens=max_tokens,
            system=system_message or "",
            messages=formatted_messages,
        ) as stream:
            async for text in stream.text_stream:
                yield text


# Register the provider
ProviderRegistry.register("claude", ClaudeProvider)
