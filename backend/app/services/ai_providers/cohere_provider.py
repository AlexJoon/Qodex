from typing import AsyncGenerator, List, Optional
import cohere

from app.models.message import Message
from .base import BaseProvider, ProviderRegistry


class CohereProvider(BaseProvider):
    """Cohere API provider implementation using V2 API."""

    def __init__(self, api_key: str, model: str = "command-r7b-12-2024"):
        super().__init__(api_key, model)
        self.client = cohere.AsyncClientV2(api_key=api_key)

    @property
    def provider_name(self) -> str:
        return "cohere"

    async def stream_completion(
        self,
        messages: List[Message],
        context: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: int = 4096,
    ) -> AsyncGenerator[str, None]:
        """Stream completion from Cohere V2 API."""
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

        async for event in self.client.chat_stream(
            model=self.model,
            messages=formatted_messages,
            temperature=temperature,
            max_tokens=max_tokens,
        ):
            if hasattr(event, 'delta') and hasattr(event.delta, 'message'):
                if hasattr(event.delta.message, 'content') and event.delta.message.content:
                    if hasattr(event.delta.message.content, 'text'):
                        text = event.delta.message.content.text
                        if text:
                            yield text


# Register the provider
ProviderRegistry.register("cohere", CohereProvider)
