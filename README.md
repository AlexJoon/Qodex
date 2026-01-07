# Qodex - AI Agent Platform

Qodex is an AI agent platform that enables users to chat with multiple AI providers (OpenAI, Mistral, Claude, Cohere) via SSE streaming. Users can benchmark and compare AI outputs, manage discussions, upload documents for RAG-based queries, and use voice input.

## Features

- **Multi-Provider AI Chat**: Switch between OpenAI, Mistral, Claude, and Cohere
- **SSE Streaming**: Real-time streaming responses like ChatGPT
- **Discussion Management**: Create, activate, and delete chat discussions
- **URL-Based Routing**: Share and bookmark specific discussions
- **Document Upload**: Upload PDFs, TXT, MD, and DOCX files for RAG
- **Voice Input**: Speech-to-text input using Web Speech API
- **Vector Search**: Pinecone integration for semantic document search

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

## Project Structure

```
Qodex/
├── backend/
│   ├── app/
│   │   ├── main.py           # FastAPI application
│   │   ├── config.py         # Environment configuration
│   │   ├── routers/          # API endpoints
│   │   │   ├── chat.py       # Chat streaming endpoint
│   │   │   ├── discussions.py # Discussion CRUD
│   │   │   └── documents.py  # Document upload/search
│   │   ├── services/
│   │   │   ├── ai_providers/ # AI provider implementations
│   │   │   ├── pinecone_service.py
│   │   │   └── document_service.py
│   │   ├── models/           # Pydantic models
│   │   └── utils/            # Utilities
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── components/       # React components
│   │   │   ├── chat/         # Chat area components
│   │   │   ├── sidebar/      # Sidebar components
│   │   │   └── common/       # Shared components
│   │   ├── stores/           # Zustand stores
│   │   ├── services/         # API and SSE services
│   │   ├── hooks/            # Custom React hooks
│   │   └── types/            # TypeScript types
│   ├── package.json
│   └── .env.example
├── IMPLEMENTATION_PLAN.md
└── README.md
```

## Getting Started

### Prerequisites

- Python 3.11+
- Node.js 18+
- npm or yarn

### Backend Setup

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Create a virtual environment:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

4. Create `.env` file from example:
   ```bash
   cp .env.example .env
   ```

5. Add your API keys to `.env`:
   ```env
   OPENAI_API_KEY=sk-...
   ANTHROPIC_API_KEY=sk-ant-...
   MISTRAL_API_KEY=...
   COHERE_API_KEY=...
   PINECONE_API_KEY=...
   ```

6. Start the backend server:
   ```bash
   uvicorn app.main:app --reload
   ```

   The API will be available at `http://localhost:8000`

### Frontend Setup

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create `.env` file from example:
   ```bash
   cp .env.example .env
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```

   The app will be available at `http://localhost:5173`

## API Endpoints

### Chat
- `POST /api/chat/stream` - Stream chat response (SSE)
- `GET /api/chat/providers` - List available providers

### Discussions
- `GET /api/discussions` - List all discussions
- `POST /api/discussions` - Create new discussion
- `GET /api/discussions/:id` - Get discussion by ID
- `PUT /api/discussions/:id` - Update discussion
- `DELETE /api/discussions/:id` - Delete discussion
- `POST /api/discussions/:id/activate` - Set discussion as active
- `POST /api/discussions/:id/messages` - Add message to discussion

### Documents
- `POST /api/documents/upload` - Upload and embed document
- `GET /api/documents` - List all documents
- `GET /api/documents/:id` - Get document by ID
- `DELETE /api/documents/:id` - Delete document
- `POST /api/documents/search` - Search documents

## Environment Variables

### Backend (.env)
```env
# AI Provider API Keys
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
MISTRAL_API_KEY=...
COHERE_API_KEY=...

# Pinecone
PINECONE_API_KEY=...
PINECONE_ENVIRONMENT=us-east-1
PINECONE_INDEX_NAME=qodex-documents

# App Config
CORS_ORIGINS=http://localhost:5173
DEBUG=true
```

### Frontend (.env)
```env
VITE_API_URL=http://localhost:8000
```

## Adding New AI Providers

1. Create a new provider class in `backend/app/services/ai_providers/`
2. Extend the `BaseProvider` abstract class
3. Implement the `stream_completion` method
4. Register the provider using `ProviderRegistry.register()`
5. Add the provider toggle in the frontend `ProviderToggles.tsx`
6. Update the provider store in `providerStore.ts`

## License

MIT
