// Message types
export type MessageRole = 'user' | 'assistant' | 'system';

export interface DocumentSource {
  id: string;
  document_id?: string;
  filename: string;
  score: number;
  chunk_preview?: string;
  citation_number?: number;  // Position in citation list for inline references
}

export interface Message {
  id: string;
  content: string;
  role: MessageRole;
  provider?: string;
  timestamp: string;
  tokens_used?: number;
  response_time_ms?: number;
  sources?: DocumentSource[];
  citations?: Record<number, string>;  // Map citation numbers to document IDs
  suggested_questions?: string[];  // AI-generated follow-up questions
}

// Discussion types
export interface Discussion {
  id: string;
  title: string;
  messages: Message[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface DiscussionCreate {
  title?: string;
}

export interface DiscussionUpdate {
  title?: string;
  is_active?: boolean;
}

// Provider types
export type ProviderName = 'openai' | 'mistral' | 'claude' | 'cohere';

export interface Provider {
  name: ProviderName;
  display_name: string;
  model: string;
  configured: boolean;
}

// Document types
export interface Document {
  id: string;
  filename: string;
  content_type: string;
  chunk_ids: string[];
  chunk_count: number;
  file_size: number;
  created_at: string;
  is_embedded: boolean;
}

export interface SearchResult {
  id: string;
  score: number;
  content: string;
  filename: string;
}

// Chat types
export interface ChatRequest {
  discussion_id: string;
  message: string;
  provider: ProviderName;
  document_ids?: string[];
  temperature?: number;
  max_tokens?: number;
}

// SSE Event types
export interface SSEChunkEvent {
  type: 'chunk';
  content: string;
  provider: string;
}

export interface SSESourcesEvent {
  type: 'sources';
  sources: DocumentSource[];
  provider: string;
}

export interface SSEDoneEvent {
  type: 'done';
  provider: string;
}

export interface SSEErrorEvent {
  type: 'error';
  error: string;
  provider: string;
}

export interface SSESuggestedQuestionsEvent {
  type: 'suggested_questions';
  questions: string[];
}

export interface SSEDiscussionTitleEvent {
  type: 'discussion_title';
  discussion_id: string;
  title: string;
}

export type SSEEvent = SSEChunkEvent | SSESourcesEvent | SSESuggestedQuestionsEvent | SSEDiscussionTitleEvent | SSEDoneEvent | SSEErrorEvent;

// API Response types
export interface ApiError {
  detail: string;
}

export interface HealthResponse {
  status: string;
  providers: Record<ProviderName, boolean>;
  pinecone: boolean;
}
