import { ChatRequest, SSEEvent } from '../types';
import { api } from './api';
import { supabase } from './supabase';

export class SSEClient {
  private abortController: AbortController | null = null;

  async *streamChat(request: ChatRequest): AsyncGenerator<SSEEvent, void, unknown> {
    // Cancel any existing stream
    this.cancel();

    this.abortController = new AbortController();

    // Get auth token for the stream request
    const { data: { session } } = await supabase.auth.getSession();
    const authHeaders: Record<string, string> = {};
    if (session?.access_token) {
      authHeaders['Authorization'] = `Bearer ${session.access_token}`;
    }

    try {
      const response = await fetch(api.getStreamUrl(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
        body: JSON.stringify(request),
        signal: this.abortController.signal,
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Stream failed' }));
        throw new Error(error.detail || `HTTP error ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });

        // Process complete SSE events
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            try {
              const event = JSON.parse(data) as SSEEvent;
              yield event;

              // Stop if we get a done or error event
              if (event.type === 'done' || event.type === 'error') {
                return;
              }
            } catch (e) {
              console.error('Failed to parse SSE event:', e);
            }
          }
        }
      }
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        // Stream was cancelled
        return;
      }
      throw error;
    }
  }

  cancel(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  isActive(): boolean {
    return this.abortController !== null && !this.abortController.signal.aborted;
  }
}

export const sseClient = new SSEClient();
