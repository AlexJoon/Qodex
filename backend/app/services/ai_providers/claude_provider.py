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
            system_message = (
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

        for msg in messages:
            # Skip empty messages
            if not msg.content or not msg.content.strip():
                continue

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
