# Qodex AI Agent Platform - Implementation Plan

## Project Overview
Qodex is an AI agent platform that enables users to chat with multiple AI providers (OpenAI, Mistral, Claude, Cohere) via SSE streaming. Users can benchmark and compare AI outputs, manage discussions, upload documents for RAG-based queries, and use voice input.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend (React + TypeScript)            │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────────┐│
│  │  Left Sidebar │  │  Chat Area   │  │  Provider Toggles     ││
│  │  - Discussions│  │  - Messages  │  │  - OpenAI/Mistral/    ││
│  │  - Actions    │  │  - Streaming │  │    Claude/Cohere      ││
│  └──────────────┘  └──────────────┘  └────────────────────────┘│
│                              │                                   │
│                    Zustand State Management                      │
└─────────────────────────────────────────────────────────────────┘
                               │
                          REST API + SSE
                               │
┌─────────────────────────────────────────────────────────────────┐
│                     Backend (Python FastAPI)                     │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────────┐│
│  │  SSE Stream  │  │  AI Providers│  │  Pinecone Vector DB   ││
│  │  Handler     │  │  Integration │  │  Connector            ││
│  └──────────────┘  └──────────────┘  └────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18 + TypeScript + Vite |
| Styling | Tailwind CSS + Lucide Icons |
| State Management | Zustand |
| Backend | Python 3.11 + FastAPI |
| SSE | sse-starlette |
| Vector DB | Pinecone |
| AI Providers | OpenAI, Anthropic, Mistral, Cohere SDKs |

---

## Phase 1: Project Setup & Infrastructure

### 1.1 Backend Setup
- [ ] **1.1.1** Create Python virtual environment and project structure
  ```
  backend/
  ├── app/
  │   ├── __init__.py
  │   ├── main.py
  │   ├── config.py
  │   ├── routers/
  │   │   ├── __init__.py
  │   │   ├── chat.py
  │   │   ├── discussions.py
  │   │   └── documents.py
  │   ├── services/
  │   │   ├── __init__.py
  │   │   ├── ai_providers/
  │   │   │   ├── __init__.py
  │   │   │   ├── base.py
  │   │   │   ├── openai_provider.py
  │   │   │   ├── mistral_provider.py
  │   │   │   ├── claude_provider.py
  │   │   │   └── cohere_provider.py
  │   │   ├── pinecone_service.py
  │   │   └── document_service.py
  │   ├── models/
  │   │   ├── __init__.py
  │   │   ├── discussion.py
  │   │   ├── message.py
  │   │   └── document.py
  │   └── utils/
  │       ├── __init__.py
  │       └── streaming.py
  ├── requirements.txt
  └── .env.example
  ```
- [ ] **1.1.2** Install backend dependencies (FastAPI, sse-starlette, python-dotenv, etc.)
- [ ] **1.1.3** Create `.env.example` with all required environment variables
- [ ] **1.1.4** Set up FastAPI application with CORS middleware
- [ ] **1.1.5** Create config.py for environment variable management

#### Guardrail Checkpoint 1.1
```
□ Backend folder structure exists as specified
□ requirements.txt contains all dependencies
□ .env.example documents all required env vars
□ FastAPI app starts without errors (uvicorn app.main:app)
□ CORS is configured for frontend origin
```

### 1.2 Frontend Setup
- [ ] **1.2.1** Initialize React + TypeScript project with Vite
  ```
  frontend/
  ├── src/
  │   ├── components/
  │   │   ├── chat/
  │   │   │   ├── ChatArea.tsx
  │   │   │   ├── ChatInput.tsx
  │   │   │   ├── ChatMessage.tsx
  │   │   │   ├── ProviderToggles.tsx
  │   │   │   ├── FileUpload.tsx
  │   │   │   └── VoiceInput.tsx
  │   │   ├── sidebar/
  │   │   │   ├── Sidebar.tsx
  │   │   │   ├── DiscussionItem.tsx
  │   │   │   └── DiscussionMenu.tsx
  │   │   └── common/
  │   │       ├── Modal.tsx
  │   │       └── Dropdown.tsx
  │   ├── stores/
  │   │   ├── discussionStore.ts
  │   │   ├── chatStore.ts
  │   │   ├── providerStore.ts
  │   │   └── documentStore.ts
  │   ├── services/
  │   │   ├── api.ts
  │   │   ├── sse.ts
  │   │   └── voice.ts
  │   ├── types/
  │   │   └── index.ts
  │   ├── hooks/
  │   │   ├── useSSE.ts
  │   │   └── useVoice.ts
  │   ├── App.tsx
  │   ├── main.tsx
  │   └── index.css
  ├── package.json
  ├── tailwind.config.js
  ├── tsconfig.json
  └── vite.config.ts
  ```
- [ ] **1.2.2** Install frontend dependencies (zustand, lucide-react, tailwindcss, etc.)
- [ ] **1.2.3** Configure Tailwind CSS
- [ ] **1.2.4** Set up project aliases and TypeScript config
- [ ] **1.2.5** Create base App.tsx layout structure

#### Guardrail Checkpoint 1.2
```
□ Frontend starts with `npm run dev`
□ Tailwind CSS classes render correctly
□ TypeScript compiles without errors
□ Folder structure matches specification
□ Lucide icons import and render
```

---

## Phase 2: Core Backend Implementation

### 2.1 AI Provider Integration
- [ ] **2.1.1** Create abstract base class for AI providers (`base.py`)
  ```python
  # Must implement:
  # - async def stream_completion(prompt, context) -> AsyncGenerator[str, None]
  # - def get_provider_name() -> str
  ```
- [ ] **2.1.2** Implement OpenAI provider with streaming
- [ ] **2.1.3** Implement Mistral provider with streaming
- [ ] **2.1.4** Implement Claude (Anthropic) provider with streaming
- [ ] **2.1.5** Implement Cohere provider with streaming
- [ ] **2.1.6** Create provider factory/registry for dynamic provider selection

#### Guardrail Checkpoint 2.1
```
□ Each provider can be instantiated independently
□ Each provider streams responses (test with simple prompt)
□ Provider factory returns correct provider by name
□ All providers handle errors gracefully (no unhandled exceptions)
□ API keys are loaded from environment variables
```

### 2.2 SSE Streaming Endpoint
- [ ] **2.2.1** Create SSE response utility with proper event formatting
- [ ] **2.2.2** Implement `/api/chat/stream` endpoint
  ```
  POST /api/chat/stream
  Body: { discussion_id, message, provider, context_documents[] }
  Response: SSE stream with chunks
  ```
- [ ] **2.2.3** Handle multiple concurrent streams
- [ ] **2.2.4** Implement proper SSE event formatting (data: prefix, double newlines)
- [ ] **2.2.5** Add stream completion event and error handling

#### Guardrail Checkpoint 2.2
```
□ SSE endpoint responds with correct content-type (text/event-stream)
□ Chunks arrive incrementally (not all at once)
□ Stream terminates properly with [DONE] event
□ Errors are sent as SSE events, not HTTP errors
□ curl test: curl -N "http://localhost:8000/api/chat/stream" -d '{"message":"test"}'
```

### 2.3 Discussion Management
- [ ] **2.3.1** Create Discussion model with fields: id, title, created_at, updated_at, messages[]
- [ ] **2.3.2** Create Message model with fields: id, role, content, provider, timestamp
- [ ] **2.3.3** Implement in-memory storage (or SQLite for persistence)
- [ ] **2.3.4** Create discussion CRUD endpoints:
  ```
  GET    /api/discussions           - List all discussions
  GET    /api/discussions/:id       - Get discussion with messages
  POST   /api/discussions           - Create new discussion
  PUT    /api/discussions/:id       - Update discussion (rename)
  DELETE /api/discussions/:id       - Delete discussion
  POST   /api/discussions/:id/messages - Add message to discussion
  ```
- [ ] **2.3.5** Implement discussion activation (set as current/active)

#### Guardrail Checkpoint 2.3
```
□ All CRUD endpoints return proper HTTP status codes
□ Discussion ID can be used to retrieve full conversation
□ Messages are stored with correct provider attribution
□ Delete removes all associated messages
□ List endpoint returns discussions sorted by updated_at
```

### 2.4 Pinecone Vector Database Integration
- [ ] **2.4.1** Set up Pinecone client connection
- [ ] **2.4.2** Create document embedding service (using OpenAI embeddings)
- [ ] **2.4.3** Implement document upload and chunking
- [ ] **2.4.4** Implement vector similarity search
- [ ] **2.4.5** Create document management endpoints:
  ```
  POST   /api/documents/upload      - Upload and embed document
  GET    /api/documents             - List uploaded documents
  DELETE /api/documents/:id         - Delete document and vectors
  POST   /api/documents/search      - Search documents by query
  ```

#### Guardrail Checkpoint 2.4
```
□ Pinecone connection is established on startup
□ Documents are chunked appropriately (< 8000 tokens per chunk)
□ Embeddings are generated and stored in Pinecone
□ Search returns relevant chunks with similarity scores
□ Document deletion removes vectors from Pinecone
```

---

## Phase 3: Frontend Implementation

### 3.1 Zustand State Management
- [ ] **3.1.1** Create `discussionStore.ts`:
  ```typescript
  interface DiscussionStore {
    discussions: Discussion[]
    activeDiscussionId: string | null
    isLoading: boolean
    fetchDiscussions: () => Promise<void>
    createDiscussion: () => Promise<Discussion>
    deleteDiscussion: (id: string) => Promise<void>
    setActiveDiscussion: (id: string) => void
  }
  ```
- [ ] **3.1.2** Create `chatStore.ts`:
  ```typescript
  interface ChatStore {
    messages: Message[]
    isStreaming: boolean
    currentStreamContent: string
    addMessage: (msg: Message) => void
    appendToStream: (chunk: string) => void
    finalizeStream: () => void
    clearMessages: () => void
  }
  ```
- [ ] **3.1.3** Create `providerStore.ts`:
  ```typescript
  interface ProviderStore {
    providers: Provider[]
    activeProviders: string[]  // Multiple can be active for comparison
    toggleProvider: (name: string) => void
    setActiveProviders: (names: string[]) => void
  }
  ```
- [ ] **3.1.4** Create `documentStore.ts` for uploaded document state

#### Guardrail Checkpoint 3.1
```
□ All stores export typed hooks (useDiscussionStore, etc.)
□ State changes trigger re-renders appropriately
□ Stores persist critical state to localStorage if needed
□ No TypeScript errors in store definitions
□ DevTools middleware works for debugging
```

### 3.2 Sidebar Implementation
- [ ] **3.2.1** Create `Sidebar.tsx` container component
- [ ] **3.2.2** Create `DiscussionItem.tsx` with:
  - Discussion title (truncated)
  - Active state indicator
  - Hover state with 3-dot menu button
- [ ] **3.2.3** Create `DiscussionMenu.tsx` dropdown with:
  - "Activate" option
  - "Delete" option with confirmation
- [ ] **3.2.4** Implement "New Chat" button
- [ ] **3.2.5** Style sidebar with proper scrolling, hover states

#### Guardrail Checkpoint 3.2
```
□ Sidebar displays list of discussions
□ Clicking discussion activates it and loads messages
□ 3-dot menu appears on hover
□ Delete shows confirmation before removing
□ Active discussion is visually highlighted
□ New Chat creates and activates new discussion
```

### 3.3 Chat Area Implementation
- [ ] **3.3.1** Create `ChatArea.tsx` container with message list
- [ ] **3.3.2** Create `ChatMessage.tsx` with:
  - User/Assistant role styling
  - Provider badge for assistant messages
  - Markdown rendering for responses
  - Streaming animation (cursor blink)
- [ ] **3.3.3** Implement auto-scroll to latest message
- [ ] **3.3.4** Add empty state for new discussions
- [ ] **3.3.5** Add loading states during API calls

#### Guardrail Checkpoint 3.3
```
□ Messages render with correct role styling
□ Streaming text appears character-by-character
□ Provider badge shows which AI generated response
□ Chat auto-scrolls on new messages
□ Markdown (code blocks, lists, bold) renders correctly
```

### 3.4 Chat Input Implementation
- [ ] **3.4.1** Create `ChatInput.tsx` with textarea:
  - Auto-resize on content
  - Enter to send, Shift+Enter for newline
  - Disabled state during streaming
- [ ] **3.4.2** Create `ProviderToggles.tsx`:
  - 4 toggle buttons (OpenAI, Mistral, Claude, Cohere)
  - Visual active/inactive states
  - At least one must be active
- [ ] **3.4.3** Create `FileUpload.tsx`:
  - File input with icon button
  - Drag-and-drop support
  - File type validation (PDF, TXT, MD)
  - Upload progress indicator
- [ ] **3.4.4** Create `VoiceInput.tsx`:
  - Microphone icon button
  - Recording state indicator
  - Speech-to-text using Web Speech API
- [ ] **3.4.5** Assemble complete input bar layout

#### Guardrail Checkpoint 3.4
```
□ Textarea expands as user types
□ Send button is disabled when input empty or streaming
□ Provider toggles visually indicate state
□ File upload accepts only valid file types
□ Voice input records and transcribes to text
□ All controls are keyboard accessible
```

### 3.5 SSE Integration
- [ ] **3.5.1** Create `useSSE.ts` hook:
  ```typescript
  const useSSE = () => {
    const startStream: (url: string, body: object) => void
    const stopStream: () => void
    // Updates chatStore with chunks
  }
  ```
- [ ] **3.5.2** Handle SSE connection lifecycle
- [ ] **3.5.3** Parse SSE events and update store
- [ ] **3.5.4** Handle connection errors and reconnection
- [ ] **3.5.5** Implement stream cancellation

#### Guardrail Checkpoint 3.5
```
□ SSE connects and receives chunks
□ Chunks are displayed in real-time
□ Stream can be cancelled mid-response
□ Connection errors show user-friendly message
□ Multiple rapid sends don't cause race conditions
```

### 3.6 URL-Based Discussion Routing
- [ ] **3.6.1** Set up React Router (or use URL search params)
- [ ] **3.6.2** Implement `/chat/:discussionId` routing
- [ ] **3.6.3** Load discussion from URL on page load
- [ ] **3.6.4** Update URL when discussion changes
- [ ] **3.6.5** Handle invalid/missing discussion IDs

#### Guardrail Checkpoint 3.6
```
□ URL updates when switching discussions
□ Direct URL access loads correct discussion
□ Invalid discussion ID shows 404 or creates new
□ Browser back/forward works correctly
□ Sharing URL allows access to same discussion
```

---

## Phase 4: Advanced Features

### 4.1 Multi-Provider Comparison Mode
- [ ] **4.1.1** Enable selecting multiple providers simultaneously
- [ ] **4.1.2** Send parallel requests to all active providers
- [ ] **4.1.3** Display responses side-by-side or sequentially
- [ ] **4.1.4** Add timing/benchmark display for each provider
- [ ] **4.1.5** Allow user to rate/compare responses

#### Guardrail Checkpoint 4.1
```
□ Multiple providers can stream simultaneously
□ Each response is clearly labeled with provider
□ Response times are displayed
□ UI handles different response lengths gracefully
```

### 4.2 Document RAG Integration
- [ ] **4.2.1** Integrate document context into chat prompts
- [ ] **4.2.2** Show which documents are being used
- [ ] **4.2.3** Allow selecting/deselecting documents per query
- [ ] **4.2.4** Display source citations in responses
- [ ] **4.2.5** Add document preview capability

#### Guardrail Checkpoint 4.2
```
□ Uploaded documents appear in document list
□ Documents can be toggled for inclusion
□ AI responses include relevant document context
□ Citations link back to source documents
```

---

## Phase 5: Polish & Production Readiness

### 5.1 Error Handling & Edge Cases
- [ ] **5.1.1** Handle API rate limits gracefully
- [ ] **5.1.2** Add retry logic for failed requests
- [ ] **5.1.3** Validate all user inputs
- [ ] **5.1.4** Handle network disconnection
- [ ] **5.1.5** Add proper loading states everywhere

### 5.2 Performance Optimization
- [ ] **5.2.1** Implement message virtualization for long chats
- [ ] **5.2.2** Optimize re-renders with proper memoization
- [ ] **5.2.3** Add request debouncing where appropriate
- [ ] **5.2.4** Implement proper cleanup on unmount

### 5.3 Accessibility
- [ ] **5.3.1** Add proper ARIA labels
- [ ] **5.3.2** Ensure keyboard navigation works
- [ ] **5.3.3** Add focus management for modals
- [ ] **5.3.4** Test with screen readers

### 5.4 Testing
- [ ] **5.4.1** Unit tests for Zustand stores
- [ ] **5.4.2** Integration tests for API endpoints
- [ ] **5.4.3** E2E tests for critical user flows
- [ ] **5.4.4** SSE streaming tests

---

## Environment Variables Reference

### Backend (.env)
```
# AI Providers
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
MISTRAL_API_KEY=...
COHERE_API_KEY=...

# Pinecone
PINECONE_API_KEY=...
PINECONE_ENVIRONMENT=...
PINECONE_INDEX_NAME=qodex-documents

# App Config
CORS_ORIGINS=http://localhost:5173
DEBUG=true
```

### Frontend (.env)
```
VITE_API_URL=http://localhost:8000
```

---

## Final Verification Checklist

### Core Functionality
- [ ] User can create new discussions
- [ ] User can switch between discussions via sidebar
- [ ] User can delete discussions
- [ ] Discussion loads from URL
- [ ] User can type and send messages
- [ ] AI responses stream in real-time
- [ ] User can switch between AI providers
- [ ] Provider toggles work correctly
- [ ] User can upload documents
- [ ] Documents are embedded and searchable
- [ ] Voice input works
- [ ] File upload works

### Technical Requirements
- [ ] SSE streams chunks properly
- [ ] Zustand state management works
- [ ] No TypeScript errors
- [ ] No console errors in production
- [ ] API endpoints return proper status codes
- [ ] All environment variables documented

### Quality Assurance
- [ ] All guardrail checkpoints pass
- [ ] No hardcoded API keys
- [ ] Error messages are user-friendly
- [ ] Loading states prevent user confusion
- [ ] UI is responsive on different screen sizes

---

## Implementation Notes

### Adding New AI Providers (Future Scaling)
1. Create new provider class in `backend/app/services/ai_providers/`
2. Extend `BaseProvider` abstract class
3. Register in provider factory
4. Add toggle in frontend `ProviderToggles.tsx`
5. Add provider to `providerStore.ts`
6. Update environment variables

### File Structure After Complete Implementation
```
Qodex/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py
│   │   ├── config.py
│   │   ├── routers/
│   │   ├── services/
│   │   ├── models/
│   │   └── utils/
│   ├── requirements.txt
│   ├── .env.example
│   └── .env
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── stores/
│   │   ├── services/
│   │   ├── types/
│   │   ├── hooks/
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── package.json
│   ├── tailwind.config.js
│   └── vite.config.ts
├── IMPLEMENTATION_PLAN.md
└── README.md
```

---

## Progress Tracking

| Phase | Status | Completion |
|-------|--------|------------|
| Phase 1: Setup | Complete | 100% |
| Phase 2: Backend | Complete | 100% |
| Phase 3: Frontend | Complete | 100% |
| Phase 4: Advanced | Pending | 0% |
| Phase 5: Polish | Pending | 0% |

**Last Updated:** 2026-01-07
**Current Focus:** Core implementation complete, ready for testing

---

## Completed Items Summary

### Phase 1: Project Setup
- [x] Backend folder structure created
- [x] requirements.txt with all dependencies
- [x] .env.example with all environment variables
- [x] FastAPI application with CORS
- [x] config.py for environment management
- [x] Frontend with Vite + React + TypeScript
- [x] Tailwind CSS configured
- [x] Zustand state management setup

### Phase 2: Core Backend
- [x] AI Provider base class and registry
- [x] OpenAI provider with streaming
- [x] Mistral provider with streaming
- [x] Claude provider with streaming
- [x] Cohere provider with streaming
- [x] SSE streaming endpoint
- [x] Discussion CRUD endpoints
- [x] Pinecone vector DB integration
- [x] Document upload and embedding service

### Phase 3: Frontend Implementation
- [x] Discussion store (Zustand)
- [x] Chat store (Zustand)
- [x] Provider store (Zustand)
- [x] Document store (Zustand)
- [x] Sidebar with discussion list
- [x] Discussion item with dropdown menu
- [x] Chat area with message display
- [x] Chat message with Markdown support
- [x] Provider toggle buttons
- [x] Chat input with auto-resize
- [x] File upload component
- [x] Voice input component
- [x] SSE client and hook
- [x] URL-based routing

### Remaining Work (Phase 4 & 5)
- [ ] Multi-provider comparison mode
- [ ] Document RAG integration UI
- [ ] Error handling improvements
- [ ] Performance optimization
- [ ] Accessibility improvements
- [ ] Testing
