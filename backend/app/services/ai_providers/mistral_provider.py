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
                "content": f"Use the following context to help answer the user's question:\n\n{context}\n\nProvide accurate and helpful responses based on this context when relevant."
            })

        # Add conversation messages
        for msg in messages:
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
