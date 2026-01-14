from typing import AsyncGenerator, List, Optional, Dict
from mistralai import Mistral
import json

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

    async def generate_suggested_questions(
        self,
        conversation_history: List[Dict[str, str]],
        last_response: str,
        count: int = 5
    ) -> List[str]:
        """Generate suggested follow-up questions using Mistral."""
        try:
            system_prompt = f"""Based on this conversation, suggest {count} relevant follow-up questions the user might ask.

Return ONLY a JSON array of question strings, nothing else.
Example: ["Question 1?", "Question 2?", "Question 3?"]

Guidelines:
- Questions should be natural and conversational
- Focus on clarifying details, exploring related topics, or going deeper
- Keep questions concise (under 15 words)
- Make them specific to the conversation context"""

            messages = [
                {"role": "system", "content": system_prompt},
                *conversation_history[-6:],
                {"role": "assistant", "content": last_response},
                {"role": "user", "content": "Generate suggested follow-up questions."}
            ]

            response = await self.client.chat.complete_async(
                model="mistral-small-latest",  # Fast model
                messages=messages,
                temperature=0.7,
                max_tokens=200
            )

            content = response.choices[0].message.content.strip()

            # Try to extract JSON array from response
            if content.startswith('```'):
                lines = content.split('\n')
                content = '\n'.join(lines[1:-1]) if len(lines) > 2 else content
                content = content.replace('```json', '').replace('```', '').strip()

            questions = json.loads(content)

            if isinstance(questions, list):
                return [q for q in questions if isinstance(q, str)][:count]

            return []

        except Exception as e:
            print(f"Failed to generate suggested questions (Mistral): {e}")
            return []


# Register the provider
ProviderRegistry.register("mistral", MistralProvider)
