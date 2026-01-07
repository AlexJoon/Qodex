# Document Sources Display - Implementation Plan

Display document chips/tags showing which documents were used to formulate each AI response.

**Status: ✅ COMPLETE**

---

## Overview

When the RAG pipeline retrieves context from Pinecone, we'll capture the source documents and display them as clickable chips below each AI response in the chat UI.

**Target UX:**
```
┌─────────────────────────────────────────────────────┐
│ 🤖 Qodex                                            │
│                                                     │
│ Based on the syllabi, climate finance courses       │
│ typically cover carbon markets, green bonds, and    │
│ ESG integration frameworks...                       │
│                                                     │
│ ┌──────────────────┐ ┌─────────────────┐           │
│ │ 📄 Climate-Fin.. │ │ 📄 ESG-Syllab.. │ +2 more  │
│ └──────────────────┘ └─────────────────┘           │
└─────────────────────────────────────────────────────┘
```

---

## Phase 1: Backend Changes ✅

### 1.1 Update Message Model
- [x] Add `sources` field to Message model in `backend/app/models/message.py`
- [x] Define `DocumentSource` schema with: `id`, `filename`, `score`, `chunk_preview`

### 1.2 Modify Chat Router
- [x] Capture search results before passing to AI provider in `backend/app/routers/chat.py`
- [x] Include sources in SSE stream as a separate event type (`type: "sources"`)
- [x] Send sources event before streaming begins

### 1.3 Update SSE Response Format
- [x] Add new SSE event type for sources in `backend/app/utils/streaming.py`
- [x] Format: `data: {"type": "sources", "documents": [...]}`

**Checkpoint 1:** Backend returns source documents in SSE stream ✅

---

## Phase 2: Frontend Type Updates ✅

### 2.1 Update TypeScript Types
- [x] Add `DocumentSource` interface to `frontend/src/types/index.ts`
- [x] Update `Message` type to include optional `sources: DocumentSource[]`

### 2.2 Update SSE Client
- [x] Handle new `sources` event type in `frontend/src/services/sse.ts`
- [x] Parse and return source documents from stream

**Checkpoint 2:** Frontend can receive and parse source documents ✅

---

## Phase 3: State Management ✅

### 3.1 Update Chat Store
- [x] Modify `useChatStore` to store sources with messages
- [x] Add `currentStreamSources` state for streaming messages
- [x] Update `finalizeStream` to include sources in saved message

### 3.2 Update useSSE Hook
- [x] Capture sources from SSE stream in `frontend/src/hooks/useSSE.ts`
- [x] Pass sources to chat store when received

**Checkpoint 3:** Sources are stored with messages in state ✅

---

## Phase 4: UI Components ✅

### 4.1 Create DocumentChip Component
- [x] Create `frontend/src/components/chat/SourcesDisplay.tsx` (includes DocumentChip)
- [x] Props: `filename`, `score`, `onClick?`
- [x] Truncate long filenames with ellipsis
- [x] Show relevance indicator (percentage badge)

### 4.2 Create SourcesDisplay Component
- [x] Create `frontend/src/components/chat/SourcesDisplay.tsx`
- [x] Show first 3 chips inline
- [x] "+N more" button to expand/show all
- [x] Expandable state to reveal all sources

### 4.3 Style Components
- [x] Create `frontend/src/components/chat/SourcesDisplay.css`
- [x] Chip styling: rounded, subtle background, file icon
- [x] Hover states and transitions
- [x] Responsive layout (wrap on mobile)

**Checkpoint 4:** Source chips component is built and styled ✅

---

## Phase 5: Integration ✅

### 5.1 Integrate into ChatMessage
- [x] Import SourcesDisplay into `ChatMessage.tsx`
- [x] Render below message body for assistant messages
- [x] Only show when `message.sources` exists and has items

### 5.2 Handle Streaming State
- [x] Pass `currentStreamSources` to streaming message in `ChatArea.tsx`
- [x] Sources appear as soon as they're received from backend

**Checkpoint 5:** Sources display in chat UI ✅

---

## Phase 6: Polish & Edge Cases ✅

### 6.1 Empty States
- [x] Handle case when no documents are selected (no sources shown)
- [x] Handle case when search returns no relevant results (no sources shown)

### 6.2 Accessibility
- [x] Title attribute on chips shows full filename and match percentage

### 6.3 Performance
- [x] Components use basic React patterns (can add memoization later if needed)

**Checkpoint 6:** Feature is complete ✅

---

## File Changes Summary

| File | Action |
|------|--------|
| `backend/app/models/message.py` | Added `DocumentSource` class and `sources` field |
| `backend/app/models/__init__.py` | Export `DocumentSource` |
| `backend/app/routers/chat.py` | Capture & emit sources in SSE stream |
| `frontend/src/types/index.ts` | Added `DocumentSource` and `SSESourcesEvent` types |
| `frontend/src/stores/chatStore.ts` | Added `currentStreamSources` and `setStreamSources` |
| `frontend/src/hooks/useSSE.ts` | Handle sources event from stream |
| `frontend/src/components/chat/SourcesDisplay.tsx` | New component |
| `frontend/src/components/chat/SourcesDisplay.css` | New styles |
| `frontend/src/components/chat/ChatMessage.tsx` | Integrate SourcesDisplay |
| `frontend/src/components/chat/ChatArea.tsx` | Pass sources to streaming message |

---

## Testing Checklist

- [ ] Upload a document and verify it appears in sources
- [ ] Select multiple documents and verify all relevant ones appear
- [ ] Verify sources don't appear for non-RAG messages
- [ ] Test with 1, 2, 3, 5+ source documents
- [ ] Verify chip truncation works correctly
- [ ] Test expand/collapse functionality
- [ ] Verify streaming message shows sources correctly
- [ ] Test on mobile viewport

---

## Future Enhancements (Out of Scope)

- Click chip to highlight relevant passage
- Inline citations with `[1]` markers
- "View in document" modal
- Source confidence threshold filtering
