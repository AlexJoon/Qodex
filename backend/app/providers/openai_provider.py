from typing import AsyncGenerator, List, Optional, Dict
from openai import AsyncOpenAI
import json

from app.models.message import Message
from .base import BaseProvider, ProviderRegistry


class OpenAIProvider(BaseProvider):
    """OpenAI API provider implementation."""

    def __init__(self, api_key: str, model: str = "gpt-4-turbo-preview"):
        super().__init__(api_key, model)
        self.client = AsyncOpenAI(api_key=api_key)

    @property
    def provider_name(self) -> str:
        return "openai"

    async def stream_completion(
        self,
        messages: List[Message],
        context: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: int = 4096,
        intent_prompt: Optional[str] = None,
    ) -> AsyncGenerator[str, None]:
        """Stream completion from OpenAI."""
        formatted_messages = self._format_messages_for_api(messages, context, intent_prompt)

        stream = await self.client.chat.completions.create(
            model=self.model,
            messages=formatted_messages,
            temperature=temperature,
            max_tokens=max_tokens,
            stream=True,
        )

        async for chunk in stream:
            if chunk.choices and chunk.choices[0].delta.content:
                yield chunk.choices[0].delta.content

    async def generate_suggested_questions(
        self,
        conversation_history: List[Dict[str, str]],
        last_response: str,
        count: int = 5
    ) -> List[str]:
        """Generate suggested follow-up questions using OpenAI."""
        try:
            # Build context-aware prompt
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
                *conversation_history[-6:],  # Last 6 messages for context
                {"role": "assistant", "content": last_response},
                {"role": "user", "content": "Generate suggested follow-up questions."}
            ]

            response = await self.client.chat.completions.create(
                model="gpt-4o-mini",  # Fast, cheap model for question generation
                messages=messages,
                temperature=0.7,
                max_tokens=200
            )

            # Parse JSON response
            content = response.choices[0].message.content.strip()

            # Try to extract JSON array from response
            # Sometimes models wrap JSON in markdown code blocks
            if content.startswith('```'):
                # Extract from code block
                lines = content.split('\n')
                content = '\n'.join(lines[1:-1]) if len(lines) > 2 else content
                content = content.replace('```json', '').replace('```', '').strip()

            questions = json.loads(content)

            # Validate and limit
            if isinstance(questions, list):
                return [q for q in questions if isinstance(q, str)][:count]

            return []

        except Exception as e:
            print(f"Failed to generate suggested questions (OpenAI): {e}")
            return []


# Register the provider
ProviderRegistry.register("openai", OpenAIProvider)
