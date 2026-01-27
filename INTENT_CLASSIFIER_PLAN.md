# Intent-Aware Prompt Routing — Implementation Plan

## Overview

Add a lightweight intent classifier to the main chat pipeline that detects the user's question type, selects a domain-specific prompt template, and surfaces the detected intent as a visual chip in the message header (between "Qodex" and the provider chip).

**Zero-latency approach:** Pattern matching via regex — no LLM call, no added network round-trip.

---

## Architecture

```
User message
    │
    ▼
┌─────────────────────┐
│  Intent Classifier   │  ← NEW: backend/app/services/intent_classifier.py
│  (regex patterns)    │
└────────┬────────────┘
         │ returns: { intent: "case_study", label: "Case Study", prompt_suffix: "..." }
         ▼
┌─────────────────────┐
│  chat.py endpoint    │  ← MODIFIED: passes intent to provider + emits intent SSE event
└────────┬────────────┘
         │
         ├──► SSE event: { type: "intent", intent: "case_study", label: "Case Study" }
         │
         ├──► base.py _format_messages_for_api() ← MODIFIED: appends intent prompt suffix
         │
         ▼
┌─────────────────────┐
│  Provider streams    │  ← UNCHANGED: same stream_completion call
│  response chunks     │
└─────────────────────┘
```

**Frontend flow:**

```
SSE "intent" event
    │
    ▼
store.ts: currentStreamIntent ← NEW field
    │
    ▼
useSSE.ts: handles "intent" event ← MODIFIED
    │
    ▼
ChatMessage.tsx: renders intent chip ← MODIFIED (between "Qodex" and provider chip)
    │
    ▼
ChatMessage.css: intent chip styles ← MODIFIED
```

---

## Files Changed

| File | Action | Description |
|------|--------|-------------|
| `backend/app/services/intent_classifier.py` | **CREATE** | Intent classifier + prompt templates |
| `backend/app/api/routes/chat.py` | MODIFY | Classify intent, emit SSE event, pass to provider |
| `backend/app/providers/base.py` | MODIFY | Accept `intent_prompt` param in `_format_messages_for_api` |
| `backend/app/models/message.py` | MODIFY | Add `intent` field to Message model |
| `frontend/src/shared/types/index.ts` | MODIFY | Add `intent` to Message + new SSEIntentEvent type |
| `frontend/src/features/chat/store.ts` | MODIFY | Add `currentStreamIntent` state + actions |
| `frontend/src/shared/hooks/useSSE.ts` | MODIFY | Handle `intent` SSE event |
| `frontend/src/features/chat/components/ChatMessage.tsx` | MODIFY | Render intent chip |
| `frontend/src/features/chat/components/ChatMessage.css` | MODIFY | Intent chip styling |

---

## Step 1: Create Intent Classifier

**File:** `backend/app/services/intent_classifier.py`

```python
"""
Lightweight intent classifier for user messages.
Uses regex pattern matching — zero latency, no LLM call.
"""
import re
from dataclasses import dataclass
from typing import Optional


@dataclass
class IntentResult:
    """Result of intent classification."""
    intent: str          # Machine key: "summarize", "case_study", etc.
    label: str           # Display label: "Summary", "Case Study", etc.
    prompt_suffix: str   # Appended to system prompt


# Intent definitions: (intent_key, display_label, patterns, prompt_suffix)
INTENT_DEFINITIONS = [
    {
        "intent": "summarize",
        "label": "Summary",
        "patterns": [
            r"\bsummar(y|ize|ise)\b",
            r"\boverview\b",
            r"\bwhat is this (about|document)\b",
            r"\bkey (points|takeaways|findings)\b",
            r"\btl;?dr\b",
            r"\bgist\b",
            r"\bhigh[- ]?level\b",
            r"\bmain (ideas?|themes?|points?)\b",
        ],
        "prompt_suffix": (
            "\n\n## Output Structure — Summary\n"
            "Structure your response with clear markdown headings:\n"
            "### Key Findings\n"
            "- Bullet the most important findings or claims (3-5 points)\n"
            "### Methodology\n"
            "- Briefly describe the approach, data sources, or framework used\n"
            "### Implications\n"
            "- What does this mean for climate policy, education, or practice?\n"
            "### Limitations\n"
            "- Note any caveats, gaps, or scope boundaries\n\n"
            "Use precise language. Distinguish between evidence-backed claims and interpretive statements."
        ),
    },
    {
        "intent": "explain",
        "label": "Explainer",
        "patterns": [
            r"\bexplain\b",
            r"\bsimpl(er|ify|e terms)\b",
            r"\bbreak (it |this )?down\b",
            r"\bwhat does .+ mean\b",
            r"\bdefine\b",
            r"\bin (plain|simple|layman|everyday) (terms|language|words)\b",
            r"\bhelp me understand\b",
            r"\bwhat is .+ in the context\b",
        ],
        "prompt_suffix": (
            "\n\n## Output Structure — Explanation\n"
            "Write for someone encountering this topic for the first time:\n"
            "- Define all technical terms inline using parenthetical definitions\n"
            "- Use concrete analogies to ground abstract concepts\n"
            "- Build from foundational ideas to complex ones\n"
            "- Use short paragraphs (2-3 sentences max)\n"
            "- Highlight cause-and-effect relationships explicitly\n"
            "- End with a 'Key Takeaway' sentence that captures the core idea\n\n"
            "Avoid jargon without explanation. If a term is domain-specific, explain it."
        ),
    },
    {
        "intent": "compare",
        "label": "Comparison",
        "patterns": [
            r"\bcompar(e|ison|ing)\b",
            r"\bdifferen(ce|t|ces|tiate)\b",
            r"\bcontrast\b",
            r"\bversus\b|\bvs\.?\b",
            r"\bhow (does|do) .+ differ\b",
            r"\bsimilarit(y|ies)\b",
            r"\brelat(e|ionship) between\b",
        ],
        "prompt_suffix": (
            "\n\n## Output Structure — Comparison\n"
            "Structure your comparison clearly:\n"
            "### Dimensions of Comparison\n"
            "- Identify the key dimensions or criteria being compared\n"
            "### Analysis\n"
            "- For each dimension, present both sides with evidence from sources\n"
            "- Use a markdown table if comparing more than 2 items across 3+ dimensions\n"
            "### Synthesis\n"
            "- What patterns emerge? Where do they converge or diverge?\n"
            "- What are the practical implications of these differences?\n\n"
            "Be balanced — present each perspective with equal rigor."
        ),
    },
    {
        "intent": "case_study",
        "label": "Case Study",
        "patterns": [
            r"\bcase stud(y|ies)\b",
            r"\breal[- ]?world example\b",
            r"\bpractical (example|application|scenario)\b",
            r"\bapplication of\b",
            r"\bhow (is|are|was|were) .+ (used|applied|implemented)\b",
            r"\bin practice\b",
            r"\bscenario\b",
        ],
        "prompt_suffix": (
            "\n\n## Output Structure — Case Study\n"
            "Frame your response as a structured case study:\n"
            "### Context\n"
            "- Setting, timeframe, and relevant background\n"
            "### Stakeholders\n"
            "- Who is involved and what are their roles or interests?\n"
            "### Key Challenge\n"
            "- What problem or question is being addressed?\n"
            "### Evidence & Analysis\n"
            "- What do the sources reveal? Include data points where available\n"
            "### Outcomes\n"
            "- What happened? What were the results or lessons learned?\n"
            "### Discussion Questions\n"
            "- Pose 2-3 questions suitable for classroom discussion\n\n"
            "Ground all claims in the source material. Flag any inferences clearly."
        ),
    },
    {
        "intent": "generate_questions",
        "label": "Assessment",
        "patterns": [
            r"\b(generate|create|write|give me|suggest|come up with) .*(questions?|quiz|exam|test|assessment)\b",
            r"\bquiz me\b",
            r"\btest me\b",
            r"\bquestions? (about|on|for|from)\b",
            r"\bassessment\b",
            r"\bexam (prep|questions?)\b",
            r"\bstudy (guide|questions?)\b",
            r"\bwhat questions? could\b",
        ],
        "prompt_suffix": (
            "\n\n## Output Structure — Assessment Questions\n"
            "Generate questions at multiple cognitive levels (Bloom's Taxonomy):\n"
            "### Recall & Comprehension\n"
            "- 2-3 questions testing factual knowledge and understanding\n"
            "### Application & Analysis\n"
            "- 2-3 questions requiring application to new scenarios or analytical reasoning\n"
            "### Synthesis & Evaluation\n"
            "- 1-2 questions requiring integration of multiple concepts or critical evaluation\n"
            "### Answer Key\n"
            "- Provide concise model answers or key points for each question\n\n"
            "Questions should be specific to the source content, not generic. "
            "Include the cognitive level label in parentheses after each question."
        ),
    },
    {
        "intent": "critique",
        "label": "Critique",
        "patterns": [
            r"\bcritiqu(e|ing)\b",
            r"\bweakness(es)?\b",
            r"\blimitation(s)?\b",
            r"\bstrength(s)?\b",
            r"\bgap(s)? in\b",
            r"\bbias(es)?\b",
            r"\bshortcoming(s)?\b",
            r"\bcritical (analysis|review|assessment)\b",
            r"\bevaluat(e|ion)\b",
        ],
        "prompt_suffix": (
            "\n\n## Output Structure — Critical Analysis\n"
            "Provide a balanced critical assessment:\n"
            "### Strengths\n"
            "- What does this do well? What is the strongest evidence or argument?\n"
            "### Weaknesses & Gaps\n"
            "- What is missing, underdeveloped, or potentially biased?\n"
            "- Are there methodological concerns?\n"
            "### Alternative Perspectives\n"
            "- What would critics or other schools of thought say?\n"
            "### Overall Assessment\n"
            "- Weigh the strengths against weaknesses\n"
            "- How should a reader calibrate their confidence in the claims?\n\n"
            "Distinguish between factual gaps and interpretive disagreements."
        ),
    },
    {
        "intent": "methodology",
        "label": "Methodology",
        "patterns": [
            r"\bmethodolog(y|ies|ical)\b",
            r"\bresearch (design|method|approach)\b",
            r"\bhow (did|do) they (study|research|measure|collect|analyze)\b",
            r"\bdata (collection|source|set)\b",
            r"\bsampl(e|ing)\b",
            r"\bexperimental (design|setup)\b",
            r"\bframework\b",
        ],
        "prompt_suffix": (
            "\n\n## Output Structure — Methodology Review\n"
            "Describe the research methodology clearly:\n"
            "### Research Design\n"
            "- What type of study is this? (qualitative, quantitative, mixed methods, meta-analysis, etc.)\n"
            "### Data & Sources\n"
            "- What data was collected or used? What is the sample/scope?\n"
            "### Analytical Approach\n"
            "- How was the data analyzed? What tools or frameworks were applied?\n"
            "### Validity & Reliability\n"
            "- How robust is the methodology? Any concerns about generalizability?\n\n"
            "Be specific about what the sources actually describe vs. what you are inferring."
        ),
    },
    {
        "intent": "lesson_plan",
        "label": "Lesson Plan",
        "patterns": [
            r"\blesson plan\b",
            r"\bteaching (plan|strategy|approach|activity|activities)\b",
            r"\bhow (to|would you|should I) teach\b",
            r"\bclassroom (activity|activities|exercise|discussion)\b",
            r"\bcurriculum\b",
            r"\blearning (objectives?|outcomes?|goals?)\b",
            r"\bcourse (design|structure|outline)\b",
            r"\bpedagog(y|ical)\b",
            r"\binstructional\b",
        ],
        "prompt_suffix": (
            "\n\n## Output Structure — Lesson Plan\n"
            "Design a practical teaching resource:\n"
            "### Learning Objectives\n"
            "- 2-4 specific, measurable objectives (use action verbs)\n"
            "### Key Concepts\n"
            "- List the core concepts students should understand\n"
            "### Teaching Activities\n"
            "- Describe 2-3 activities with format (lecture, discussion, group work, etc.)\n"
            "- Include estimated time for each\n"
            "### Discussion Prompts\n"
            "- 3-4 open-ended questions to drive classroom conversation\n"
            "### Assessment Ideas\n"
            "- How could instructors evaluate student understanding?\n"
            "### Recommended Readings\n"
            "- Reference relevant sources from the documents\n\n"
            "Target a graduate-level audience unless otherwise specified."
        ),
    },
]


def classify_intent(message: str) -> IntentResult:
    """
    Classify the user's message into an intent category.
    Returns the first matching intent, or a general fallback.

    Uses case-insensitive regex matching — zero latency.
    """
    message_lower = message.lower().strip()

    for definition in INTENT_DEFINITIONS:
        for pattern in definition["patterns"]:
            if re.search(pattern, message_lower):
                return IntentResult(
                    intent=definition["intent"],
                    label=definition["label"],
                    prompt_suffix=definition["prompt_suffix"],
                )

    # Fallback: general intent — enhanced base prompt for climate/education domain
    return IntentResult(
        intent="general",
        label="General",
        prompt_suffix=(
            "\n\n## Response Guidelines\n"
            "- Use clear markdown formatting with headings and bullet points where appropriate\n"
            "- Ground all claims in the source material with inline citations [N]\n"
            "- When relevant, note implications for climate policy, education, or practice\n"
            "- Distinguish between what sources state directly and your interpretive synthesis\n"
            "- If the sources don't cover the question adequately, say so explicitly"
        ),
    )
```

---

## Step 2: Modify Backend Provider Base

**File:** `backend/app/providers/base.py`

**Change:** `_format_messages_for_api` accepts an optional `intent_prompt` parameter and appends it to the system message.

```python
def _format_messages_for_api(
    self, messages: List[Message], context: Optional[str] = None, intent_prompt: Optional[str] = None
) -> List[Dict[str, str]]:
    """Format messages for the API, optionally including context with citation instructions."""
    formatted = []

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
```

**Also:** Each provider's `stream_completion` must pass `intent_prompt` through to `_format_messages_for_api`. Add `intent_prompt: Optional[str] = None` parameter to the abstract method and all 4 implementations (openai, claude, mistral, cohere).

---

## Step 3: Modify Chat Endpoint

**File:** `backend/app/api/routes/chat.py`

**Changes:**

1. Import the classifier at the top:
   ```python
   from app.services.intent_classifier import classify_intent
   ```

2. After adding the user message (line ~83), classify the intent:
   ```python
   # Classify user intent for structured output
   intent_result = classify_intent(request.message)
   ```

3. In the `generate()` SSE function, emit the intent event before sources (after title, before sources):
   ```python
   # Emit intent event
   intent_data = {
       "type": "intent",
       "intent": intent_result.intent,
       "label": intent_result.label
   }
   yield f"data: {json.dumps(intent_data)}\n\n"
   ```

4. Pass `intent_prompt` to `stream_completion`:
   ```python
   async for chunk in create_sse_response(
       provider.stream_completion(
           messages=context_messages,
           context=context,
           temperature=request.temperature,
           max_tokens=request.max_tokens,
           intent_prompt=intent_result.prompt_suffix,  # NEW
       ),
       provider=request.provider,
       send_done=False
   ):
   ```

5. Store intent on the assistant message:
   ```python
   assistant_message = Message(
       ...
       intent=intent_result.intent,  # NEW
   )
   ```

---

## Step 4: Add Intent to Message Model

**File:** `backend/app/models/message.py`

Add one field to the `Message` class:

```python
class Message(MessageBase):
    ...
    intent: Optional[str] = None  # Detected intent: "summarize", "case_study", etc.
```

---

## Step 5: Update Frontend Types

**File:** `frontend/src/shared/types/index.ts`

1. Add `intent` to `Message`:
   ```typescript
   export interface Message {
     ...
     intent?: string;  // Detected intent: "summarize", "case_study", etc.
   }
   ```

2. Add new SSE event type:
   ```typescript
   export interface SSEIntentEvent {
     type: 'intent';
     intent: string;
     label: string;
   }
   ```

3. Add to union:
   ```typescript
   export type SSEEvent = SSEChunkEvent | SSESourcesEvent | SSEIntentEvent | ...;
   ```

---

## Step 6: Update Chat Store

**File:** `frontend/src/features/chat/store.ts`

1. Add to `ChatState`:
   ```typescript
   currentStreamIntent: { intent: string; label: string } | null;
   ```

2. Add to `ChatActions`:
   ```typescript
   setStreamIntent: (intent: string, label: string) => void;
   ```

3. Add implementation:
   ```typescript
   currentStreamIntent: null,

   setStreamIntent: (intent: string, label: string) => {
     set({ currentStreamIntent: { intent, label } });
   },
   ```

4. In `startStream`, reset: `currentStreamIntent: null`

5. In `finalizeStream`, include intent in the message:
   ```typescript
   intent: state.currentStreamIntent?.intent || undefined,
   ```

6. In `cancelStream`, reset: `currentStreamIntent: null`

---

## Step 7: Handle Intent SSE Event

**File:** `frontend/src/shared/hooks/useSSE.ts`

Add handler in the event loop (after `sources`, before `chunk`):

```typescript
} else if (event.type === 'intent') {
  setStreamIntent(event.intent, event.label);
}
```

---

## Step 8: Render Intent Chip in ChatMessage

**File:** `frontend/src/features/chat/components/ChatMessage.tsx`

In the message header (line ~292), between "Qodex" and the provider chip:

```tsx
<span className="message-author">{isUser ? 'You' : 'Qodex'}</span>

{/* Intent chip - shown for assistant messages */}
{!isUser && message.intent && message.intent !== 'general' && (
  <span className={`message-intent ${message.intent}`}>
    {intentLabels[message.intent] || message.intent}
  </span>
)}

{/* Provider chip */}
{!isUser && message.provider && (
  <span className={`message-provider ${message.provider}`}>
    {providerNames[message.provider] || message.provider}
  </span>
)}
```

Add the label mapping:

```typescript
const intentLabels: Record<string, string> = {
  summarize: 'Summary',
  explain: 'Explainer',
  compare: 'Comparison',
  case_study: 'Case Study',
  generate_questions: 'Assessment',
  critique: 'Critique',
  methodology: 'Methodology',
  lesson_plan: 'Lesson Plan',
};
```

**Note:** The "General" intent chip is intentionally hidden — it's the default and showing it on every message would be noise. Only specialized intents get a chip.

---

## Step 9: Style the Intent Chip

**File:** `frontend/src/features/chat/components/ChatMessage.css`

```css
/* Intent Chip */
.message-intent {
  font-size: 12px;
  font-weight: 500;
  padding: 2px 8px;
  border-radius: 10px;
  background-color: #f0fdf4;
  color: #166534;
  border: 1px solid #bbf7d0;
}

.message-intent.case_study {
  background-color: #fef3c7;
  color: #92400e;
  border-color: #fde68a;
}

.message-intent.summarize {
  background-color: #eff6ff;
  color: #1e40af;
  border-color: #bfdbfe;
}

.message-intent.explain {
  background-color: #faf5ff;
  color: #6b21a8;
  border-color: #e9d5ff;
}

.message-intent.compare {
  background-color: #ecfeff;
  color: #155e75;
  border-color: #a5f3fc;
}

.message-intent.generate_questions {
  background-color: #fff1f2;
  color: #9f1239;
  border-color: #fecdd3;
}

.message-intent.critique {
  background-color: #fff7ed;
  color: #9a3412;
  border-color: #fed7aa;
}

.message-intent.methodology {
  background-color: #f0fdf4;
  color: #166534;
  border-color: #bbf7d0;
}

.message-intent.lesson_plan {
  background-color: #fdf4ff;
  color: #86198f;
  border-color: #f0abfc;
}
```

---

## Step 10: Pass Intent Through Provider Implementations

Each of the 4 providers needs the `intent_prompt` parameter added to `stream_completion`:

**Files:**
- `backend/app/providers/openai_provider.py`
- `backend/app/providers/claude_provider.py`
- `backend/app/providers/mistral_provider.py`
- `backend/app/providers/cohere_provider.py`

**Change in each:** Add `intent_prompt: Optional[str] = None` to the method signature and pass it through to `_format_messages_for_api(messages, context, intent_prompt)`.

---

## Visual Result

Message header will look like:

```
┌─────────────────────────────────────────────────┐
│ 🤖 Qodex  [Case Study]  [Claude]  1.2s  ⟳ ⬇ 📋 │
│                                                 │
│ ### Context                                     │
│ Sustainable finance emerged as a key theme...   │
│                                                 │
│ ### Stakeholders                                │
│ - Central banks and financial regulators [1]    │
│ - Institutional investors [2]                   │
│ ...                                             │
└─────────────────────────────────────────────────┘
```

The intent chip appears **only** for specialized intents (not "General"), so regular questions look exactly as they do today. The chip uses a distinct color per intent type, visually differentiated from the provider chip.

---

## What Does NOT Change

- No new API endpoints
- No new frontend routes
- No changes to Pinecone / RAG retrieval
- No changes to SSE streaming infrastructure
- No changes to suggested questions generation
- No changes to document chat (Qodex Dive)
- No changes to citation handling
- Provider selection and switching unchanged

---

## Testing Checklist

- [ ] "Summarize this paper" → Summary chip + structured output with Key Findings / Methodology / Implications / Limitations
- [ ] "What case studies exist on sustainable finance?" → Case Study chip + Context / Stakeholders / Evidence / Discussion Questions
- [ ] "Generate quiz questions from this" → Assessment chip + Bloom's taxonomy levels + answer key
- [ ] "Compare the two approaches" → Comparison chip + dimensions + table if applicable
- [ ] "Explain carbon pricing in simple terms" → Explainer chip + inline definitions + analogies
- [ ] "What are the limitations of this study?" → Critique chip + Strengths / Weaknesses / Alternative Perspectives
- [ ] "How did they collect the data?" → Methodology chip + Research Design / Data / Analytical Approach
- [ ] "Help me design a lesson on this topic" → Lesson Plan chip + Learning Objectives / Activities / Discussion Prompts
- [ ] "Tell me about climate change" → No chip (General) + enhanced base formatting
- [ ] Streaming: chip appears early (before chunks), persists after finalization
- [ ] Provider switching: intent chip independent of provider chip
