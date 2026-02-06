from typing import AsyncGenerator, List, Optional, Dict
import cohere
import json

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
        intent_prompt: Optional[str] = None,
        research_prompt: Optional[str] = None,
    ) -> AsyncGenerator[str, None]:
        """Stream completion from Cohere V2 API."""
        formatted_messages = []

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

            formatted_messages.append({
                "role": "system",
                "content": system_content
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

    async def generate_suggested_questions(
        self,
        conversation_history: List[Dict[str, str]],
        last_response: str,
        count: int = 5
    ) -> List[str]:
        """Generate suggested follow-up questions using Cohere."""
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

            response = await self.client.chat(
                model="command-r",  # Updated model
                messages=messages,
                temperature=0.7,
                max_tokens=200
            )

            content = response.message.content[0].text.strip()

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
            print(f"Failed to generate suggested questions (Cohere): {e}")
            return []


# Register the provider
ProviderRegistry.register("cohere", CohereProvider)
