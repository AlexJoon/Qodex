# Suggested Follow-up Questions Implementation Plan

## Overview
Implement a feature that renders 4-5 AI-generated suggested follow-up questions that:
- Generate in parallel with the AI output streaming
- Display fully when the main output is finished
- Be modular and maintainable with proper validation at each step

## Architecture Summary

### Data Flow
```
1. User sends message → Backend processes with selected provider
2. Provider streams main response chunks via SSE
3. After main response completes, provider generates suggested questions
4. Backend sends suggested_questions SSE event
5. Frontend receives event and stores in chatStore
6. ChatMessage component renders SuggestedQuestions component
7. User clicks question → Auto-fills input and submits
```

### Key Integration Points
- **Message Model**: Add `suggested_questions?: string[]` field
- **SSE Events**: Add new `SSESuggestedQuestionsEvent` type
- **Provider Layer**: Add `generate_suggested_questions()` method to BaseProvider
- **UI Component**: New `SuggestedQuestions.tsx` component after SourcesDisplay

---

## Phase 1: Backend Data Model Updates

### Objective
Update Message model to support suggested questions field

### Files to Modify
1. `backend/app/models/message.py`

### Changes

#### 1.1 Update Message Model
**File**: `backend/app/models/message.py` (lines 34-42)

**Current**:
```python
class Message:
    id: str
    discussion_id: str
    role: str
    content: str
    provider: Optional[str] = None
    timestamp: datetime
    sources: Optional[List[str]] = None
```

**Add**:
```python
class Message:
    id: str
    discussion_id: str
    role: str
    content: str
    provider: Optional[str] = None
    timestamp: datetime
    sources: Optional[List[str]] = None
    suggested_questions: Optional[List[str]] = None  # NEW FIELD
```

### Validation Checklist
- [ ] Message model updated with new field
- [ ] Field is optional (Optional[List[str]])
- [ ] No existing message serialization breaks
- [ ] Backend starts successfully: `cd backend && python -m uvicorn app.main:app --reload`

### Rollback Procedure
If validation fails:
1. Remove `suggested_questions` field from Message class
2. Restart backend
3. Investigate error before proceeding

---

## Phase 2: Backend SSE Event Type

### Objective
Add new SSE event type for suggested questions

### Files to Modify
1. `backend/app/routers/chat.py`

### Changes

#### 2.1 Add Suggested Questions SSE Event
**File**: `backend/app/routers/chat.py` (after line 155, before streaming logic starts)

**Add constants/types at top of file**:
```python
# SSE Event Types
SSE_EVENT_CHUNK = "chunk"
SSE_EVENT_SOURCES = "sources"
SSE_EVENT_SUGGESTED_QUESTIONS = "suggested_questions"  # NEW
SSE_EVENT_DONE = "done"
SSE_EVENT_ERROR = "error"
```

#### 2.2 Add Helper Function
**Add after line 150** (before `async def chat_stream()`):
```python
def format_sse_event(event_type: str, data: Any) -> str:
    """Format data as SSE event"""
    return f"event: {event_type}\ndata: {json.dumps(data)}\n\n"
```

### Validation Checklist
- [ ] Constants defined for all SSE event types
- [ ] Helper function added for SSE formatting
- [ ] Backend starts successfully
- [ ] Existing chat streaming still works (test with a message)

### Rollback Procedure
If validation fails:
1. Remove added constants and helper function
2. Restart backend
3. Fix errors before proceeding

---

## Phase 3: Provider Layer - Question Generation

### Objective
Add question generation capability to provider interface

### Files to Modify
1. `backend/app/services/providers/base.py`
2. `backend/app/services/providers/openai_provider.py`
3. `backend/app/services/providers/mistral_provider.py`
4. `backend/app/services/providers/claude_provider.py`
5. `backend/app/services/providers/cohere_provider.py`

### Changes

#### 3.1 Update BaseProvider Abstract Class
**File**: `backend/app/services/providers/base.py` (add after `stream_completion` method)

**Add**:
```python
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
    raise NotImplementedError("Subclasses must implement generate_suggested_questions")
```

#### 3.2 Implement in OpenAI Provider
**File**: `backend/app/services/providers/openai_provider.py` (add after `stream_completion` method)

**Add**:
```python
async def generate_suggested_questions(
    self,
    conversation_history: List[Dict[str, str]],
    last_response: str,
    count: int = 5
) -> List[str]:
    """Generate suggested follow-up questions using OpenAI"""
    try:
        # Build context-aware prompt
        system_prompt = f"""Based on this conversation, suggest {count} relevant follow-up questions the user might ask.

Return ONLY a JSON array of question strings, nothing else.
Example: ["Question 1?", "Question 2?", "Question 3?"]

Guidelines:
- Questions should be natural and conversational
- Focus on clarifying details, exploring related topics, or going deeper
- Keep questions concise (under 15 words)
- Make them specific to the conversation context
"""

        messages = [
            {"role": "system", "content": system_prompt},
            *conversation_history[-6:],  # Last 6 messages for context
            {"role": "assistant", "content": last_response},
            {"role": "user", "content": "Generate suggested follow-up questions."}
        ]

        response = await asyncio.to_thread(
            self.client.chat.completions.create,
            model="gpt-4o-mini",  # Fast, cheap model for question generation
            messages=messages,
            temperature=0.7,
            max_tokens=200
        )

        # Parse JSON response
        content = response.choices[0].message.content.strip()
        questions = json.loads(content)

        # Validate and limit
        if isinstance(questions, list):
            return [q for q in questions if isinstance(q, str)][:count]

        return []

    except Exception as e:
        print(f"Failed to generate suggested questions: {e}")
        return []
```

#### 3.3 Implement in Mistral Provider
**File**: `backend/app/services/providers/mistral_provider.py` (similar structure)

**Add**:
```python
async def generate_suggested_questions(
    self,
    conversation_history: List[Dict[str, str]],
    last_response: str,
    count: int = 5
) -> List[str]:
    """Generate suggested follow-up questions using Mistral"""
    try:
        system_prompt = f"""Based on this conversation, suggest {count} relevant follow-up questions the user might ask.

Return ONLY a JSON array of question strings, nothing else.
Example: ["Question 1?", "Question 2?", "Question 3?"]

Guidelines:
- Questions should be natural and conversational
- Focus on clarifying details, exploring related topics, or going deeper
- Keep questions concise (under 15 words)
- Make them specific to the conversation context
"""

        messages = [
            {"role": "system", "content": system_prompt},
            *conversation_history[-6:],
            {"role": "assistant", "content": last_response},
            {"role": "user", "content": "Generate suggested follow-up questions."}
        ]

        response = await asyncio.to_thread(
            self.client.chat.complete,
            model="mistral-small-latest",  # Fast model
            messages=messages,
            temperature=0.7,
            max_tokens=200
        )

        content = response.choices[0].message.content.strip()
        questions = json.loads(content)

        if isinstance(questions, list):
            return [q for q in questions if isinstance(q, str)][:count]

        return []

    except Exception as e:
        print(f"Failed to generate suggested questions: {e}")
        return []
```

#### 3.4 Implement in Claude Provider
**File**: `backend/app/services/providers/claude_provider.py` (similar structure)

**Add**:
```python
async def generate_suggested_questions(
    self,
    conversation_history: List[Dict[str, str]],
    last_response: str,
    count: int = 5
) -> List[str]:
    """Generate suggested follow-up questions using Claude"""
    try:
        system_prompt = f"""Based on this conversation, suggest {count} relevant follow-up questions the user might ask.

Return ONLY a JSON array of question strings, nothing else.
Example: ["Question 1?", "Question 2?", "Question 3?"]

Guidelines:
- Questions should be natural and conversational
- Focus on clarifying details, exploring related topics, or going deeper
- Keep questions concise (under 15 words)
- Make them specific to the conversation context
"""

        messages = [
            *conversation_history[-6:],
            {"role": "assistant", "content": last_response},
            {"role": "user", "content": "Generate suggested follow-up questions."}
        ]

        response = await asyncio.to_thread(
            self.client.messages.create,
            model="claude-3-haiku-20240307",  # Fast model
            system=system_prompt,
            messages=messages,
            temperature=0.7,
            max_tokens=200
        )

        content = response.content[0].text.strip()
        questions = json.loads(content)

        if isinstance(questions, list):
            return [q for q in questions if isinstance(q, str)][:count]

        return []

    except Exception as e:
        print(f"Failed to generate suggested questions: {e}")
        return []
```

#### 3.5 Implement in Cohere Provider
**File**: `backend/app/services/providers/cohere_provider.py` (similar structure)

**Add**:
```python
async def generate_suggested_questions(
    self,
    conversation_history: List[Dict[str, str]],
    last_response: str,
    count: int = 5
) -> List[str]:
    """Generate suggested follow-up questions using Cohere"""
    try:
        system_prompt = f"""Based on this conversation, suggest {count} relevant follow-up questions the user might ask.

Return ONLY a JSON array of question strings, nothing else.
Example: ["Question 1?", "Question 2?", "Question 3?"]

Guidelines:
- Questions should be natural and conversational
- Focus on clarifying details, exploring related topics, or going deeper
- Keep questions concise (under 15 words)
- Make them specific to the conversation context
"""

        # Cohere format - concatenate conversation
        conversation_text = "\n".join([
            f"{msg['role']}: {msg['content']}"
            for msg in conversation_history[-6:]
        ])
        conversation_text += f"\nassistant: {last_response}"

        prompt = f"{system_prompt}\n\nConversation:\n{conversation_text}\n\nGenerate suggested follow-up questions."

        response = await asyncio.to_thread(
            self.client.generate,
            model="command",
            prompt=prompt,
            temperature=0.7,
            max_tokens=200
        )

        content = response.generations[0].text.strip()
        questions = json.loads(content)

        if isinstance(questions, list):
            return [q for q in questions if isinstance(q, str)][:count]

        return []

    except Exception as e:
        print(f"Failed to generate suggested questions: {e}")
        return []
```

### Validation Checklist
- [ ] BaseProvider abstract method defined
- [ ] All 4 providers implement the method
- [ ] Each implementation uses appropriate fast model
- [ ] Error handling returns empty list on failure
- [ ] Backend starts successfully
- [ ] Test each provider with a simple question generation (manual test via Python console)

### Rollback Procedure
If validation fails:
1. Remove `generate_suggested_questions` method from all provider files
2. Restart backend
3. Fix errors in one provider at a time

---

## Phase 4: Backend Integration - Chat Router

### Objective
Integrate question generation into chat streaming flow

### Files to Modify
1. `backend/app/routers/chat.py`

### Changes

#### 4.1 Update Chat Stream Function
**File**: `backend/app/routers/chat.py` (modify `chat_stream` function around lines 156-210)

**Current flow**:
1. Send sources event
2. Stream response chunks
3. Send done event

**New flow**:
1. Send sources event
2. Stream response chunks
3. Generate suggested questions (NEW)
4. Send suggested_questions event (NEW)
5. Send done event

**Modify** (after streaming completes, before done event):
```python
# After line ~203 (after full_response is complete)
# Before sending done event

# Generate suggested questions
try:
    # Build conversation history for context
    conversation_history = [
        {"role": msg.role, "content": msg.content}
        for msg in messages  # messages from earlier in function
    ]

    # Generate questions using the provider
    suggested_questions = await provider.generate_suggested_questions(
        conversation_history=conversation_history,
        last_response=full_response,
        count=5
    )

    # Send suggested questions event if any generated
    if suggested_questions:
        yield format_sse_event(
            SSE_EVENT_SUGGESTED_QUESTIONS,
            {"questions": suggested_questions}
        )

        # Store in message object
        assistant_message.suggested_questions = suggested_questions

except Exception as e:
    print(f"Failed to generate suggested questions: {e}")
    # Don't fail the whole request if question generation fails

# Then continue with done event
yield format_sse_event(SSE_EVENT_DONE, {"message": "Stream completed"})
```

### Validation Checklist
- [ ] Question generation integrated after response completes
- [ ] SSE event sent with questions array
- [ ] Questions stored in message object
- [ ] Errors caught and logged without breaking stream
- [ ] Backend starts successfully
- [ ] Test chat stream - verify SSE events received in order (use browser DevTools Network tab to inspect SSE events)

### Rollback Procedure
If validation fails:
1. Remove question generation code from chat_stream
2. Revert to just sending done event
3. Restart backend
4. Fix errors before proceeding

---

## Phase 5: Frontend Type Definitions

### Objective
Update frontend types to support suggested questions

### Files to Modify
1. `frontend/src/types/index.ts`

### Changes

#### 5.1 Update Message Interface
**File**: `frontend/src/types/index.ts` (lines 12-22)

**Current**:
```typescript
export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  sources?: string[];
  provider?: string;
  isLoading?: boolean;
  isStreaming?: boolean;
}
```

**Add**:
```typescript
export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  sources?: string[];
  provider?: string;
  isLoading?: boolean;
  isStreaming?: boolean;
  suggested_questions?: string[];  // NEW FIELD
}
```

#### 5.2 Add SSE Event Type
**File**: `frontend/src/types/index.ts` (after line 106, with other SSE event types)

**Add**:
```typescript
export interface SSESuggestedQuestionsEvent {
  type: 'suggested_questions';
  questions: string[];
}

// Update SSEEvent union type to include new event
export type SSEEvent =
  | SSEChunkEvent
  | SSESourcesEvent
  | SSESuggestedQuestionsEvent  // NEW
  | SSEDoneEvent
  | SSEErrorEvent;
```

### Validation Checklist
- [ ] Message interface updated with new field
- [ ] SSESuggestedQuestionsEvent interface defined
- [ ] SSEEvent union type includes new event
- [ ] TypeScript compiles without errors: `cd frontend && npm run build`
- [ ] No type errors in IDE

### Rollback Procedure
If validation fails:
1. Remove `suggested_questions` field from Message interface
2. Remove SSESuggestedQuestionsEvent type
3. Remove from SSEEvent union
4. Fix TypeScript errors before proceeding

---

## Phase 6: Frontend State Management

### Objective
Update chatStore to handle suggested questions

### Files to Modify
1. `frontend/src/stores/chatStore.ts`

### Changes

#### 6.1 Update addMessage Action
**File**: `frontend/src/stores/chatStore.ts` (no changes needed - already supports arbitrary Message fields)

The existing `addMessage` and `updateMessage` functions in chatStore already handle the full Message object, so `suggested_questions` will be automatically included when we update messages.

### Validation Checklist
- [ ] Verify chatStore.addMessage accepts Message with suggested_questions
- [ ] Verify chatStore.updateMessage accepts Message with suggested_questions
- [ ] TypeScript compiles without errors
- [ ] No runtime errors when starting frontend: `cd frontend && npm run dev`

### Rollback Procedure
No changes needed in this phase - chatStore already supports the new field.

---

## Phase 7: Frontend SSE Handler

### Objective
Handle suggested_questions SSE events

### Files to Modify
1. `frontend/src/hooks/useSSE.ts`

### Changes

#### 7.1 Add Handler in handleSSEEvent
**File**: `frontend/src/hooks/useSSE.ts` (in `handleSSEEvent` function, around line 60-90)

**Current switch statement**:
```typescript
switch (event.type) {
  case 'chunk': // ... handle chunk
  case 'sources': // ... handle sources
  case 'done': // ... finalize stream
  case 'error': // ... handle error
}
```

**Add new case** (before 'done' case):
```typescript
case 'suggested_questions': {
  // Update the current assistant message with suggested questions
  updateMessage(tempMessageId, {
    suggested_questions: event.questions,
  });
  break;
}
```

### Validation Checklist
- [ ] Handler added to switch statement
- [ ] Handler updates message with suggested_questions array
- [ ] TypeScript compiles without errors
- [ ] Frontend starts successfully
- [ ] Test chat stream - verify suggested questions appear in message state (use React DevTools to inspect chatStore)

### Rollback Procedure
If validation fails:
1. Remove the suggested_questions case from switch statement
2. Restart frontend
3. Fix errors before proceeding

---

## Phase 8: Frontend UI Component

### Objective
Create SuggestedQuestions component

### Files to Create
1. `frontend/src/components/chat/SuggestedQuestions.tsx`
2. `frontend/src/components/chat/SuggestedQuestions.css`

### Changes

#### 8.1 Create Component
**File**: `frontend/src/components/chat/SuggestedQuestions.tsx` (NEW FILE)

```typescript
import { MessageCircle } from 'lucide-react';
import './SuggestedQuestions.css';

interface SuggestedQuestionsProps {
  questions: string[];
  onQuestionClick: (question: string) => void;
  isLoading?: boolean;
}

export function SuggestedQuestions({
  questions,
  onQuestionClick,
  isLoading = false
}: SuggestedQuestionsProps) {
  if (!questions || questions.length === 0) {
    return null;
  }

  return (
    <div className="suggested-questions">
      <div className="suggested-questions-header">
        <MessageCircle size={16} />
        <span>Suggested follow-up questions</span>
      </div>

      <div className="suggested-questions-grid">
        {questions.map((question, index) => (
          <button
            key={index}
            className="suggested-question-btn"
            onClick={() => onQuestionClick(question)}
            disabled={isLoading}
            title={question}
          >
            {question}
          </button>
        ))}
      </div>
    </div>
  );
}
```

#### 8.2 Create Styles
**File**: `frontend/src/components/chat/SuggestedQuestions.css` (NEW FILE)

```css
/* Suggested Questions Container */
.suggested-questions {
  margin-top: 16px;
  padding: 16px;
  background-color: var(--gray-50);
  border: 1px solid var(--gray-200);
  border-radius: 8px;
}

/* Header */
.suggested-questions-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  font-size: 13px;
  font-weight: 500;
  color: var(--gray-700);
}

.suggested-questions-header svg {
  color: var(--brand-500);
}

/* Questions Grid */
.suggested-questions-grid {
  display: grid;
  gap: 8px;
  grid-template-columns: 1fr;
}

@media (min-width: 640px) {
  .suggested-questions-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

/* Question Button */
.suggested-question-btn {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  padding: 10px 14px;
  background-color: white;
  border: 1px solid var(--gray-200);
  border-radius: 6px;
  font-size: 14px;
  line-height: 1.4;
  color: var(--gray-700);
  text-align: left;
  cursor: pointer;
  transition: all var(--transition-fast);
  word-break: break-word;
}

.suggested-question-btn:hover:not(:disabled) {
  background-color: var(--brand-50);
  border-color: var(--brand-300);
  color: var(--brand-700);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.suggested-question-btn:active:not(:disabled) {
  transform: scale(0.98);
}

.suggested-question-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
```

### Validation Checklist
- [ ] Component created with proper TypeScript types
- [ ] Styles created following existing CSS patterns
- [ ] Uses existing CSS variables (--gray-*, --brand-*)
- [ ] Responsive grid (1 column mobile, 2 columns desktop)
- [ ] TypeScript compiles without errors
- [ ] Frontend starts successfully
- [ ] Component can be imported without errors

### Rollback Procedure
If validation fails:
1. Delete SuggestedQuestions.tsx and SuggestedQuestions.css
2. Fix errors before proceeding

---

## Phase 9: Frontend Integration

### Objective
Integrate SuggestedQuestions component into ChatMessage

### Files to Modify
1. `frontend/src/components/chat/ChatMessage.tsx`
2. `frontend/src/components/chat/ChatArea.tsx`

### Changes

#### 9.1 Update ChatMessage Component
**File**: `frontend/src/components/chat/ChatMessage.tsx`

**Add import** (line ~8):
```typescript
import { SuggestedQuestions } from './SuggestedQuestions';
```

**Update props interface** (line ~15):
```typescript
interface ChatMessageProps {
  message: Message;
  onQuestionClick?: (question: string) => void;  // NEW PROP
}
```

**Update component signature** (line ~28):
```typescript
export function ChatMessage({ message, onQuestionClick }: ChatMessageProps) {
```

**Add component in render** (after SourcesDisplay, around line 329):
```typescript
{/* Sources Display */}
{message.sources && message.sources.length > 0 && (
  <SourcesDisplay sources={message.sources} />
)}

{/* Suggested Questions - NEW */}
{message.suggested_questions && message.suggested_questions.length > 0 && onQuestionClick && (
  <SuggestedQuestions
    questions={message.suggested_questions}
    onQuestionClick={onQuestionClick}
    isLoading={message.isStreaming || message.isLoading}
  />
)}
```

#### 9.2 Update ChatArea Component
**File**: `frontend/src/components/chat/ChatArea.tsx`

**Add handler function** (around line 50, after other handlers):
```typescript
const handleQuestionClick = (question: string) => {
  // Set the input value
  setInput(question);

  // Auto-submit the question
  handleSubmit(new Event('submit') as any);
};
```

**Update ChatMessage usage** (around line 180, in messages.map):
```typescript
<ChatMessage
  key={message.id}
  message={message}
  onQuestionClick={handleQuestionClick}  // NEW PROP
/>
```

### Validation Checklist
- [ ] SuggestedQuestions imported in ChatMessage
- [ ] ChatMessage accepts onQuestionClick prop
- [ ] SuggestedQuestions rendered after SourcesDisplay
- [ ] Only shown when questions exist and onQuestionClick provided
- [ ] isLoading state passed to disable buttons during streaming
- [ ] ChatArea handler auto-fills input and submits
- [ ] TypeScript compiles without errors
- [ ] Frontend starts successfully

### Rollback Procedure
If validation fails:
1. Remove SuggestedQuestions import and usage from ChatMessage
2. Remove handleQuestionClick from ChatArea
3. Remove onQuestionClick prop passing
4. Restart frontend
5. Fix errors before proceeding

---

## Phase 10: End-to-End Testing

### Objective
Validate the complete feature works end-to-end

### Test Scenarios

#### Test 1: Basic Question Generation
1. Start backend: `cd backend && python -m uvicorn app.main:app --reload`
2. Start frontend: `cd frontend && npm run dev`
3. Navigate to app in browser
4. Start a new conversation
5. Send a message: "What is React?"
6. Wait for response to complete
7. **Verify**: 4-5 suggested questions appear below the response
8. **Verify**: Questions are relevant to React topic
9. **Verify**: Questions are styled correctly with gray background

#### Test 2: Question Click Interaction
1. Continue from Test 1
2. Click on one of the suggested questions
3. **Verify**: Input field auto-fills with the question
4. **Verify**: Question auto-submits
5. **Verify**: New response includes its own suggested questions
6. **Verify**: Previous suggested questions remain visible

#### Test 3: Multiple Providers
1. Test with OpenAI provider (default)
2. Switch to Mistral provider
3. Send message and verify questions appear
4. Switch to Claude provider
5. Send message and verify questions appear
6. Switch to Cohere provider
7. Send message and verify questions appear
8. **Verify**: Each provider generates relevant questions

#### Test 4: Error Handling
1. Temporarily break provider question generation (comment out method)
2. Send a message
3. **Verify**: Main response still works
4. **Verify**: No suggested questions appear (graceful degradation)
5. **Verify**: No error messages shown to user
6. **Verify**: Console logs error but doesn't crash
7. Restore provider method

#### Test 5: Loading States
1. Send a message
2. While response is streaming, **verify**: Suggested questions section does not appear yet
3. When response completes, **verify**: Suggested questions appear
4. Click a suggested question
5. While new response is streaming, **verify**: Previous suggested questions buttons are disabled
6. When new response completes, **verify**: New suggested questions are enabled

#### Test 6: Conversation Context
1. Start conversation: "Tell me about Python"
2. Wait for response and suggested questions
3. Click a suggested question
4. Wait for response and new suggested questions
5. **Verify**: New questions are contextually relevant to the conversation thread
6. Repeat 2-3 more times
7. **Verify**: Questions remain relevant throughout conversation

#### Test 7: Edge Cases
1. Send a very short message: "Hi"
2. **Verify**: Suggested questions still generated (even for simple greeting)
3. Send a very long, complex message (200+ words)
4. **Verify**: Suggested questions generated and relevant
5. Send a message with code snippets
6. **Verify**: Suggested questions handle code context appropriately

#### Test 8: SSE Event Ordering
1. Open browser DevTools → Network tab
2. Filter for EventStream
3. Send a message
4. Click on the SSE connection
5. **Verify** event order in Messages tab:
   - `sources` event (if sources present)
   - Multiple `chunk` events (streaming response)
   - `suggested_questions` event (with questions array)
   - `done` event

#### Test 9: Mobile Responsiveness
1. Open DevTools → Toggle device toolbar (mobile view)
2. Send a message
3. **Verify**: Suggested questions display in single column on mobile
4. Switch to tablet view
5. **Verify**: Questions display in 2-column grid
6. **Verify**: Questions are readable and clickable on touch devices

#### Test 10: Persistence
1. Send a message and wait for suggested questions
2. Refresh the page
3. **Verify**: Conversation history loads
4. **Verify**: Suggested questions from previous messages are still visible
5. **Verify**: Clicking old suggested questions still works

### Validation Checklist
- [ ] All 10 test scenarios pass
- [ ] No console errors in browser
- [ ] No server errors in backend logs
- [ ] Questions are contextually relevant
- [ ] UI is responsive and styled correctly
- [ ] Click interaction works smoothly
- [ ] Error handling works gracefully
- [ ] SSE events in correct order
- [ ] Mobile responsive
- [ ] Data persists across page refreshes

### Known Issues / Limitations
Document any issues discovered during testing:
- [ ] None identified yet

---

## Rollback Strategy (Complete Feature)

If the entire feature needs to be rolled back:

### Backend Rollback
1. Remove `suggested_questions` field from `backend/app/models/message.py`
2. Remove SSE event constants from `backend/app/routers/chat.py`
3. Remove question generation integration from `chat_stream()` function
4. Remove `generate_suggested_questions()` method from all provider files:
   - `base.py`
   - `openai_provider.py`
   - `mistral_provider.py`
   - `claude_provider.py`
   - `cohere_provider.py`
5. Restart backend

### Frontend Rollback
1. Remove `suggested_questions` field from `frontend/src/types/index.ts` Message interface
2. Remove `SSESuggestedQuestionsEvent` type and from SSEEvent union
3. Remove suggested_questions case from `frontend/src/hooks/useSSE.ts`
4. Delete `frontend/src/components/chat/SuggestedQuestions.tsx`
5. Delete `frontend/src/components/chat/SuggestedQuestions.css`
6. Remove SuggestedQuestions import and usage from `frontend/src/components/chat/ChatMessage.tsx`
7. Remove `onQuestionClick` prop from ChatMessage interface and usage
8. Remove `handleQuestionClick` from `frontend/src/components/chat/ChatArea.tsx`
9. Remove `onQuestionClick` prop passing in ChatArea
10. Rebuild frontend: `npm run build`

---

## Success Criteria

The feature is considered successfully implemented when:

1. ✅ Backend generates 4-5 relevant suggested questions after each AI response
2. ✅ Questions are sent via SSE `suggested_questions` event
3. ✅ Questions are stored in Message model
4. ✅ All 4 providers (OpenAI, Mistral, Claude, Cohere) implement question generation
5. ✅ Frontend displays questions in styled component below each assistant message
6. ✅ Questions are responsive (1 column mobile, 2 columns desktop)
7. ✅ Clicking a question auto-fills input and submits
8. ✅ Questions are contextually relevant to conversation
9. ✅ Feature degrades gracefully if question generation fails
10. ✅ All 10 test scenarios pass without errors
11. ✅ Code follows existing patterns and conventions
12. ✅ No performance degradation in message streaming

---

## Estimated Implementation Time

- **Phase 1-2** (Backend Models & Events): 15 minutes
- **Phase 3** (Provider Layer): 45 minutes (15 min per provider after base)
- **Phase 4** (Backend Integration): 20 minutes
- **Phase 5-7** (Frontend Types & State): 15 minutes
- **Phase 8** (UI Component): 30 minutes
- **Phase 9** (Frontend Integration): 20 minutes
- **Phase 10** (Testing): 45 minutes

**Total**: ~3 hours for complete implementation and testing

---

## Next Steps

1. Get approval on this implementation plan
2. Execute phases sequentially, validating each phase before proceeding
3. Test thoroughly at each phase boundary
4. Document any deviations or issues encountered
5. Perform final end-to-end testing
6. Deploy to production

---

## Notes

- This implementation maintains modularity by keeping question generation logic in the provider layer
- Error handling ensures main response stream never fails due to question generation
- Questions are generated using fast, cost-effective models (gpt-4o-mini, mistral-small, claude-haiku)
- UI follows existing design patterns (similar to SourcesDisplay)
- Feature is additive - no breaking changes to existing functionality
- Graceful degradation if providers don't support question generation
