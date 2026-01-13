from typing import AsyncGenerator, List, Optional
from mistralai import Mistral

from app.models.message import Message
from .base import BaseProvider, ProviderRegistry


class MistralProvider(BaseProvider):
    """Mistral AI API provider implementation."""

    def __init__(self, api_key: str, model: str = "mistral-large-latest"):
        super().__init__(api_key, model)
        self.client = Mistral(api_key=api_key)

    @property
    def provider_name(self) -> str:
        return "mistral"

    async def stream_completion(
        self,
        messages: List[Message],
        context: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: int = 4096,
    ) -> AsyncGenerator[str, None]:
        """Stream completion from Mistral."""
        formatted_messages = []

        # Add system message with context if provided
        if context:
            formatted_messages.append({
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
                formatted_messages.append({
                    "role": msg.role.value,
                    "content": msg.content
                })

        async_response = await self.client.chat.stream_async(
            model=self.model,
            messages=formatted_messages,
            temperature=temperature,
            max_tokens=max_tokens,
        )

        async for chunk in async_response:
            if chunk.data.choices and chunk.data.choices[0].delta.content:
                yield chunk.data.choices[0].delta.content


# Register the provider
ProviderRegistry.register("mistral", MistralProvider)
