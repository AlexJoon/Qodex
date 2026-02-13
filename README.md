# Qodex - AI-Powered Knowledge Base Chat Platform

Qodex is an enterprise-grade AI chat platform with multi-provider support, retrieval-augmented generation (RAG), and intelligent document processing. Built for educational institutions and knowledge-intensive organizations, Qodex enables users to have meaningful conversations with AI models while seamlessly integrating with their document repositories.

## 🌟 Key Features

### **Multi-Provider AI Chat**
- Switch between OpenAI (GPT-4.1), Claude (Sonnet 4.5), Mistral (Large), and Cohere (Command)
- Real-time SSE streaming responses with graceful truncation
- Provider-specific optimizations and prompt engineering
- Visual provider selection with mobile-responsive modal interface

### **Advanced RAG Pipeline**
- **Pinecone Vector Database**: Semantic search with cosine similarity (text-embedding-3-small, 1536 dims)
- **Entity-First Retrieval**: N-gram extraction with instructor name matching to prevent cross-contamination
- **Research Modes**: Quick (7 sources), Enhanced (12 sources), Deep (16 sources)
- **Intent Classification**: 8 specialized intents (Summarize, Explain, Compare, Case Study, etc.) with zero-latency regex matching
- **Smart Context Injection**: Token-aware chunking (500 tokens/chunk, 50 token overlap) with structure preservation

### **Document & Attachment Management**
- **Global Knowledge Base**: Upload PDFs, DOCX, TXT, MD files (10MB limit) for shared semantic search
- **Conversation Attachments**: Discussion-scoped files for targeted questions without Pinecone indexing
- **Inline Citations**: `[N]` markers with clickable source previews and chunk highlighting
- **Document Preview**: Modal with full-text view and navigable chunks

### **User Authentication & Personalization**
- **Supabase Auth**: Email/password with JWT verification and email confirmation
- **User Profiles**: Avatar selection (20+ icons), display name, preferred name
- **Row-Level Security**: User-scoped discussions and messages with PostgreSQL RLS
- **Session Persistence**: LocalStorage + Zustand for seamless experience

### **Intelligent Conversation Management**
- **Discussion System**: Create, rename, delete conversations with auto-generated titles
- **Message History**: Persistent storage with Supabase, includes tokens/latency metrics
- **Suggested Questions**: AI-generated follow-up questions (max 4) based on conversation context
- **URL Routing**: Share and bookmark specific discussions (`/chat/:discussionId`)

### **Mobile-First Design**
- Fully responsive layout (640px, 768px, 1024px breakpoints)
- Touch-friendly UI with 44px minimum tap targets
- Hamburger menu with slide-out drawer for mobile navigation
- Provider selector modal for mobile
- iOS-optimized input fields (16px font to prevent zoom)

### **Voice & Export**
- **Voice Input**: Web Speech API integration for speech-to-text transcription
- **PDF Export**: Export entire conversations with formatting and citations (html2canvas + jspdf)
- **Share**: Shareable discussion links with URL-based routing

---

## 🏗️ Architecture Overview

### **Backend (Python 3.11 + FastAPI)**

**Framework & Runtime**
- FastAPI with uvicorn ASGI server
- SSE (Server-Sent Events) streaming via sse-starlette
- CORS middleware for cross-origin requests
- Lifespan hooks for startup/shutdown

**Database & Persistence**
- **Supabase PostgreSQL**: User profiles, discussions, messages with RLS
- **Pinecone**: Vector embeddings for semantic search (1536-dim cosine similarity)
- **Disk Registry**: `backend/data/document_registry.json` for document metadata persistence

**Authentication**
- Supabase Auth with JWT (ES256/RS256/EdDSA via JWKS, legacy HS256 fallback)
- `get_current_user_id()` dependency injection for protected endpoints
- Email confirmation flow with URL hash processing

**AI Providers** (4 configured on startup)
- OpenAI (gpt-4.1) - AsyncOpenAI client
- Claude (claude-sonnet-4-5-20250929) - AsyncAnthropic client
- Mistral (mistral-large-latest) - Streaming support
- Cohere (command-a-03-2025) - Streaming support

**Services Architecture**
- **DiscussionService**: Supabase-backed CRUD for discussions/messages (singleton)
- **DocumentService**: Document processing, Pinecone indexing, instructor extraction (singleton)
- **AttachmentService**: In-memory conversation-scoped file storage (singleton per discussion)
- **PineconeService**: Vector DB client with lazy initialization (singleton)
- **IntentClassifier**: Regex-based intent detection (8 types + generalist fallback)

**RAG Pipeline** (3-stage retrieval)
1. **Query Embedding**: User query → text-embedding-3-small → 1536-dim vector
2. **Pinecone Search**: Query vector → retrieve top-k chunks (research mode controls k)
3. **Entity Boost**: N-gram extraction → instructor name matching → relevance boost
4. **Context Assembly**: Format with citations → inject into system prompt

**Text Processing**
- **Extraction**: PyPDF (PDFs), python-docx (DOCX), direct read (TXT/MD)
- **Chunking**: Token-aware (cl100k_base tokenizer), 500 tokens/chunk, 50 token overlap
- **Algorithm**: Paragraph detection → type classification → accumulation with budget → sentence fallback
- **Embedding**: Batch embedding for efficiency (text-embedding-3-small)

**API Routes**
- `/api/chat/stream` - SSE streaming endpoint (POST)
- `/api/chat/providers` - List available providers (GET)
- `/api/discussions` - CRUD for discussions (GET, POST, PUT, DELETE)
- `/api/discussions/{id}/messages` - Add message (POST)
- `/api/documents` - Upload, list, delete documents (GET, POST, DELETE)
- `/api/discussions/{id}/attachments` - CRUD for attachments (GET, POST, DELETE)
- `/api/research/modes` - List research modes (GET)

**SSE Event Types**
- `chunk` - Response text chunk
- `sources` - Retrieved document sources with citations
- `intent` - Detected intent classification
- `suggested_questions` - AI-generated follow-ups (max 4)
- `discussion_title` - Auto-generated title
- `done` - Stream complete
- `error` - Stream error

---

### **Frontend (React 19 + TypeScript + Vite 7)**

**Framework & Build**
- React 19 with TypeScript
- Vite 7 build tool (HMR, fast bundling)
- React Router 7 for client-side routing
- CSS Modules + Tailwind CSS for styling

**State Management (Zustand)**
- **useAuthStore**: User authentication, session management, Supabase integration
- **useDiscussionStore**: Discussion CRUD, active discussion tracking
- **useChatStore**: Message history, streaming state, stream content buffering
- **useProviderStore**: AI provider selection, configuration status (persisted)
- **useDocumentStore**: Document upload, list, selection
- **useAttachmentStore**: Attachment upload, preview, discussion-scoped management
- **useResearchModeStore**: Research mode selection (Quick/Enhanced/Deep, persisted)

**Services**
- **ApiService**: Singleton fetch wrapper with auth header injection
- **SSEClient**: Streaming SSE parser with abort signal support
- **Supabase Client**: @supabase/supabase-js singleton
- **Voice Service**: Web Speech API wrapper
- **PDF Export**: jspdf + html2canvas integration

**Custom Hooks**
- **useSSE**: Stream chat, handle SSE events, chunk buffering
- **useChunkBuffer**: Debounce streaming updates for optimal rendering
- **useVoice**: Speech-to-text with Web Speech API

**Key Components**
- **ChatArea**: Main chat container with message flow and empty state
- **ChatMessage**: Rendered message with role, timestamp, provider, metrics
- **ChatInput**: Message input with voice, attachments, provider selector
- **SourcesDisplay**: Tabbed view (Grid/Chat) with inline citations
- **DocumentPreviewPane**: Side panel for document content preview
- **AttachmentPanel**: List and preview conversation attachments
- **AuthModal**: Sign up/sign in with avatar selection and preferred name
- **Sidebar**: Discussion list, new chat button, hamburger menu (mobile)
- **ProviderToggles**: Desktop toggles, mobile modal selector

**Routing**
- `/` - Root (redirects to /chat)
- `/chat` - New chat (no discussion)
- `/chat/:discussionId` - Specific discussion chat

**Types**
- MessageRole, DocumentSource, Message, Discussion, Provider, ResearchMode, Document, Attachment, ChatRequest, SSEEvent

---

## 📦 Tech Stack

| Layer | Technology | Version |
|-------|------------|---------|
| **Frontend** | React | 19 |
| | TypeScript | 5.x |
| | Vite | 7 |
| | React Router | 7 |
| | Zustand | 5.x |
| | Tailwind CSS | 3.x |
| | Lucide React | 0.562.0 |
| **Backend** | Python | 3.11+ |
| | FastAPI | Latest |
| | uvicorn | Latest |
| | sse-starlette | Latest |
| **Database** | Supabase (PostgreSQL) | Latest |
| | Pinecone | Latest |
| **AI Providers** | OpenAI SDK | Latest |
| | Anthropic SDK | Latest |
| | Mistral SDK | Latest |
| | Cohere SDK | Latest |
| **Document Processing** | PyPDF | Latest |
| | python-docx | Latest |
| | tiktoken | Latest |
| **Authentication** | Supabase Auth | Latest |
| | PyJWT | Latest |

---

## 🚀 Getting Started

### **Prerequisites**

- **Python 3.11+**
- **Node.js 18+**
- **npm or yarn**
- **Supabase account** (for auth + database)
- **Pinecone account** (for vector search)
- **API keys** for AI providers (OpenAI, Anthropic, Mistral, Cohere)

---

### **Quick Start (Automated)**

The easiest way to start Qodex is using the provided scripts:

```bash
# Start both backend and frontend
./start.sh

# Stop all services
./stop.sh
```

**What `start.sh` does:**
- Creates Python virtual environment (if not exists)
- Installs backend dependencies
- Starts backend (http://localhost:8000)
- Installs frontend dependencies
- Starts frontend (http://localhost:5173)
- Logs to `logs/backend.log` and `logs/frontend.log`
- Stores PIDs in `.pids/` directory

---

### **Manual Setup**

#### **1. Backend Setup**

```bash
# Navigate to backend directory
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Create .env file
cp .env.example .env
```

**Configure `.env`** (see [Environment Variables](#environment-variables) section):

```env
# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_JWT_SECRET=your-jwt-secret

# AI Providers
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
MISTRAL_API_KEY=...
COHERE_API_KEY=...

# Pinecone
PINECONE_API_KEY=...
PINECONE_INDEX_NAME=qodex-documents

# Application
CORS_ORIGINS=http://localhost:5173
DEBUG=true
```

**Initialize Supabase database:**

```bash
# Run the SQL schema in Supabase SQL Editor
# File: supabase_schema.sql
# Creates: profiles, discussions, messages tables + RLS policies + trigger
```

**Start backend:**

```bash
uvicorn app.main:app --reload
# API available at http://localhost:8000
# Docs at http://localhost:8000/docs
```

---

#### **2. Frontend Setup**

```bash
# Navigate to frontend directory
cd frontend

# Install dependencies
npm install

# Create .env file
cp .env.example .env
```

**Configure `.env`:**

```env
VITE_API_URL=http://localhost:8000
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

**Start frontend:**

```bash
npm run dev
# App available at http://localhost:5173
```

---

### **3. Supabase Setup**

1. **Create Supabase Project**: https://supabase.com/dashboard
2. **Get Credentials**:
   - URL: Project Settings → API → Project URL
   - Anon Key: Project Settings → API → Project API keys → anon public
   - Service Role Key: Project Settings → API → Project API keys → service_role (secret)
   - JWT Secret: Project Settings → API → JWT Settings → JWT Secret

3. **Run SQL Schema**:
   - Go to SQL Editor in Supabase Dashboard
   - Paste contents of `supabase_schema.sql`
   - Execute to create tables, RLS policies, and trigger

4. **Enable Email Auth**:
   - Authentication → Providers → Email
   - Configure email templates (optional)

---

### **4. Pinecone Setup**

1. **Create Pinecone Account**: https://www.pinecone.io/
2. **Create Index**:
   - Name: `qodex-documents` (or custom name in .env)
   - Dimensions: **1536**
   - Metric: **Cosine**
   - Spec: Serverless (AWS us-east-1 recommended)
3. **Get API Key**: API Keys → Create API Key
4. **Add to `.env`**: `PINECONE_API_KEY=...`

---

## 🔧 Environment Variables

### **Backend (.env)**

```env
# ==========================================
# Supabase Database & Authentication
# ==========================================
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_JWT_SECRET=your-jwt-secret  # Required for JWT verification

# ==========================================
# AI Provider API Keys
# ==========================================
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
MISTRAL_API_KEY=...
COHERE_API_KEY=...

# ==========================================
# AI Model Configurations (Optional)
# ==========================================
OPENAI_MODEL=gpt-4.1
ANTHROPIC_MODEL=claude-sonnet-4-5-20250929
MISTRAL_MODEL=mistral-large-latest
COHERE_MODEL=command-a-03-2025

# ==========================================
# Pinecone Vector Database
# ==========================================
PINECONE_API_KEY=...
PINECONE_HOST=...  # Optional, uses index name if not provided
PINECONE_ENVIRONMENT=us-east-1
PINECONE_INDEX_NAME=qodex-documents

# ==========================================
# Application Configuration
# ==========================================
CORS_ORIGINS=http://localhost:5173,http://localhost:3000
DEBUG=true
LOG_LEVEL=INFO
```

### **Frontend (.env)**

```env
VITE_API_URL=http://localhost:8000
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

---

## 📁 Project Structure

```
Qodex/
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   ├── routes/
│   │   │   │   ├── __init__.py
│   │   │   │   ├── chat.py              # SSE streaming endpoint
│   │   │   │   ├── discussions.py       # Discussion CRUD
│   │   │   │   ├── documents.py         # Document upload/search
│   │   │   │   └── attachments.py       # Attachment management
│   │   │   └── middleware/
│   │   ├── auth/
│   │   │   ├── __init__.py
│   │   │   └── dependencies.py          # JWT verification
│   │   ├── core/
│   │   │   ├── config.py                # Settings & env vars
│   │   │   └── research_modes.py        # Research mode definitions
│   │   ├── database/
│   │   │   └── supabase_client.py       # Supabase client
│   │   ├── models/
│   │   │   ├── __init__.py
│   │   │   ├── discussion.py            # Pydantic models
│   │   │   ├── message.py
│   │   │   ├── document.py
│   │   │   └── attachment.py
│   │   ├── providers/
│   │   │   ├── __init__.py              # ProviderRegistry
│   │   │   ├── base.py                  # BaseProvider abstract
│   │   │   ├── openai_provider.py
│   │   │   ├── claude_provider.py
│   │   │   ├── mistral_provider.py
│   │   │   └── cohere_provider.py
│   │   ├── services/
│   │   │   ├── __init__.py
│   │   │   ├── discussion_service.py    # Discussion CRUD
│   │   │   ├── document_service.py      # Document processing
│   │   │   ├── attachment_service.py    # Attachment storage
│   │   │   ├── pinecone_service.py      # Vector DB client
│   │   │   └── intent_classifier.py     # Intent detection
│   │   ├── utils/
│   │   │   └── streaming.py             # SSE helpers
│   │   └── main.py                      # FastAPI app
│   ├── data/
│   │   └── document_registry.json       # Persisted metadata
│   ├── requirements.txt
│   ├── .env
│   ├── .env.example
│   └── supabase_schema.sql
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── App.tsx                  # Main app + routing
│   │   │   └── App.css
│   │   ├── components/
│   │   │   ├── layout/
│   │   │   │   ├── Sidebar.tsx          # Nav + discussion list
│   │   │   │   ├── Header.tsx
│   │   │   │   └── Footer.tsx
│   │   │   └── ui/                      # Shared components
│   │   │       └── Modal.tsx
│   │   ├── features/
│   │   │   ├── auth/
│   │   │   │   ├── components/
│   │   │   │   │   └── AuthModal.tsx    # Sign up/sign in
│   │   │   │   ├── store.ts             # Zustand store
│   │   │   │   └── index.ts
│   │   │   ├── chat/
│   │   │   │   ├── components/
│   │   │   │   │   ├── chat/            # Chat UI
│   │   │   │   │   ├── input/           # Input controls
│   │   │   │   │   ├── sources/         # Source display
│   │   │   │   │   ├── attachments/     # Attachment panel
│   │   │   │   │   ├── modals/          # Modals
│   │   │   │   │   └── ui/              # UI components
│   │   │   │   ├── store.ts
│   │   │   │   └── index.ts
│   │   │   ├── discussions/
│   │   │   │   ├── components/
│   │   │   │   ├── store.ts
│   │   │   │   └── index.ts
│   │   │   ├── documents/
│   │   │   │   ├── components/
│   │   │   │   ├── store.ts
│   │   │   │   └── index.ts
│   │   │   ├── attachments/
│   │   │   │   ├── store.ts
│   │   │   │   └── index.ts
│   │   │   ├── providers/
│   │   │   │   ├── components/
│   │   │   │   │   └── ProviderToggles.tsx
│   │   │   │   ├── store.ts
│   │   │   │   └── index.ts
│   │   │   └── research/
│   │   │       ├── components/
│   │   │       │   └── ResearchModeSelector.tsx
│   │   │       ├── store.ts
│   │   │       └── index.ts
│   │   ├── shared/
│   │   │   ├── services/
│   │   │   │   ├── api.ts               # API client
│   │   │   │   ├── sse.ts               # SSE client
│   │   │   │   ├── supabase.ts          # Supabase client
│   │   │   │   ├── voice.ts             # Web Speech API
│   │   │   │   └── pdfExport.ts         # PDF export
│   │   │   ├── hooks/
│   │   │   │   ├── useSSE.ts            # SSE hook
│   │   │   │   ├── useChunkBuffer.ts    # Chunk buffering
│   │   │   │   └── useVoice.ts          # Voice input
│   │   │   ├── types/
│   │   │   │   └── index.ts             # TypeScript types
│   │   │   ├── constants/
│   │   │   ├── utils/
│   │   │   └── index.ts
│   │   ├── assets/
│   │   ├── index.css                    # Global styles
│   │   └── main.tsx                     # React entry
│   ├── package.json
│   ├── .env.example
│   ├── tsconfig.json
│   ├── vite.config.ts
│   └── dist/                            # Build output
├── start.sh                             # Start script
├── stop.sh                              # Stop script
├── render.yaml                          # Deployment blueprint
├── supabase_schema.sql                  # Database schema
└── README.md
```

---

## 🔌 API Endpoints

### **Chat**
- `POST /api/chat/stream` - Stream chat response (SSE)
- `GET /api/chat/providers` - List available providers

### **Discussions**
- `GET /api/discussions` - List user's discussions
- `POST /api/discussions` - Create new discussion
- `GET /api/discussions/{id}` - Get discussion with messages
- `PUT /api/discussions/{id}` - Update discussion (title, active status)
- `DELETE /api/discussions/{id}` - Delete discussion
- `DELETE /api/discussions` - Delete all user's discussions

### **Documents**
- `POST /api/documents/upload` - Upload and embed document
- `GET /api/documents` - List all documents (shared)
- `GET /api/documents/{id}` - Get document metadata
- `DELETE /api/documents/{id}` - Delete document
- `POST /api/documents/search` - Search documents (vector search)

### **Attachments**
- `POST /api/discussions/{discussion_id}/attachments` - Upload attachment
- `GET /api/discussions/{discussion_id}/attachments` - List attachments
- `GET /api/discussions/{discussion_id}/attachments/{attachment_id}` - Get attachment detail
- `DELETE /api/discussions/{discussion_id}/attachments/{attachment_id}` - Delete attachment

### **Research Modes**
- `GET /api/research/modes` - List research modes

### **Health**
- `GET /health` - Health check with provider status

---

## 🚢 Deployment

### **Render Deployment (Recommended)**

Qodex includes a `render.yaml` blueprint for one-click deployment:

1. **Push to GitHub**:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin <your-repo-url>
   git push -u origin main
   ```

2. **Connect to Render**:
   - Go to https://render.com/
   - Create account and connect GitHub
   - Create Blueprint from `render.yaml`

3. **Set Environment Variables** in Render Dashboard:
   - Backend service: Add all backend `.env` variables
   - Frontend service: Add frontend `.env` variables (as `VITE_*`)

4. **Deploy**: Render auto-deploys on git push

**Services created:**
- **Backend**: Python/FastAPI web service (port $PORT)
  - Health check: `/health`
  - Start: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- **Frontend**: Static site
  - Build: `npm install && npm run build`
  - Publish: `dist/`
  - SPA routing: `/*` → `/index.html`

### **Manual Deployment (Production)**

**Backend:**
```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

**Frontend:**
```bash
cd frontend
npm install
npm run build
# Serve dist/ folder with nginx/apache/caddy
```

---

## 🧪 Development

### **Adding New AI Providers**

1. **Create Provider Class** (`backend/app/providers/new_provider.py`):
   ```python
   from .base import BaseProvider
   from typing import AsyncGenerator

   class NewProvider(BaseProvider):
       async def stream_completion(
           self,
           messages: list,
           context: str = "",
           temperature: float = 0.7,
           max_tokens: int = 2000,
           intent_prompt: str = "",
           research_prompt: str = ""
       ) -> AsyncGenerator[str, None]:
           # Implement streaming logic
           yield chunk
   ```

2. **Register Provider** (`backend/app/providers/__init__.py`):
   ```python
   from .new_provider import NewProvider

   def register_providers():
       registry.register("new_provider", NewProvider, "New Provider", "model-name")
   ```

3. **Update Frontend** (`frontend/src/features/providers/store.ts`):
   ```typescript
   // Add to ProviderName type
   export type ProviderName = 'mistral' | 'openai' | 'claude' | 'cohere' | 'new_provider';
   ```

4. **Add CSS** (`frontend/src/features/providers/components/ProviderToggles.css`):
   ```css
   .provider-toggle.new_provider {
     color: var(--new-provider-color);
   }
   ```

### **File Conventions**

- **Backend Models**: `backend/app/models/` - Pydantic BaseModel with `__init__.py` re-exports
- **Backend Services**: `backend/app/services/` - Singleton pattern with `get_*_service()` getter
- **Frontend Features**: `frontend/src/features/<feature>/` - Export via `index.ts`
- **Frontend Types**: `frontend/src/shared/types/index.ts` - Centralized TypeScript types
- **Frontend Stores**: Zustand with `interface State` + `interface Actions` pattern
- **Frontend Services**: `frontend/src/shared/services/` - API/external integrations

---

## 📊 Database Schema (Supabase)

**Tables:**
1. **profiles** - Auto-created on signup
   - `id` (UUID, FK to auth.users)
   - `email` (text)
   - `display_name` (text)
   - `created_at` (timestamptz)

2. **discussions** - User conversations
   - `id` (UUID, PK)
   - `user_id` (UUID, FK to profiles)
   - `title` (text)
   - `is_active` (boolean)
   - `created_at`, `updated_at` (timestamptz)

3. **messages** - Discussion messages
   - `id` (UUID, PK)
   - `discussion_id` (UUID, FK to discussions)
   - `role` (text: user/assistant/system)
   - `content` (text)
   - `provider` (text)
   - `tokens_used`, `response_time_ms` (integer)
   - `sources`, `citations`, `suggested_questions` (JSONB)
   - `intent` (text)
   - `created_at` (timestamptz)

**RLS Policies:**
- Users can only access their own discussions and messages
- Profile updates restricted to own profile

**Trigger:**
- `handle_new_user()` - Auto-creates profile on auth signup

---

## 🐛 Troubleshooting

### **Backend won't start**
- Check Python version: `python --version` (need 3.11+)
- Activate venv: `source venv/bin/activate`
- Check `.env` file exists with all required variables
- Check Supabase connection: verify URL and keys
- Check Pinecone connection: verify API key and index name

### **Frontend won't start**
- Check Node version: `node --version` (need 18+)
- Delete `node_modules` and `package-lock.json`, run `npm install`
- Check `.env` file has `VITE_API_URL` and Supabase credentials
- Check port 5173 is not in use

### **Authentication not working**
- Verify `SUPABASE_JWT_SECRET` is set in backend `.env`
- Check Supabase SQL schema was executed (tables created)
- Check email confirmation flow in Supabase dashboard
- Check browser console for auth errors

### **RAG not returning results**
- Verify Pinecone index exists with correct name
- Check embeddings were created (dimension 1536)
- Verify documents were uploaded successfully
- Check document registry: `backend/data/document_registry.json`

### **Streaming not working**
- Check SSE endpoint: `POST /api/chat/stream`
- Verify provider API keys are valid
- Check browser console for SSE errors
- Verify CORS is configured correctly

---

## 📝 License

MIT License - see LICENSE file for details

---

## 🤝 Contributing

Contributions are welcome! Please follow these guidelines:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📧 Support

For issues, questions, or feature requests:
- Open an issue on GitHub
- Check existing documentation
- Review troubleshooting section

---

## 🙏 Acknowledgments

- OpenAI for GPT models and embedding API
- Anthropic for Claude models
- Mistral AI for Mistral models
- Cohere for Command models
- Pinecone for vector database
- Supabase for authentication and PostgreSQL
- FastAPI and React communities

---

**Built with ❤️ for knowledge-intensive organizations**
