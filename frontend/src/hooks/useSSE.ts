import { useCallback, useRef } from 'react';
import { sseClient } from '../services/sse';
import { useChatStore } from '../stores/chatStore';
import { useDiscussionStore } from '../stores/discussionStore';
import { useProviderStore } from '../stores/providerStore';
import { useDocumentStore } from '../stores/documentStore';
import { ProviderName } from '../types';

export function useSSE() {
  const messageIdRef = useRef<string>('');

  const { addMessage, startStream, appendToStream, setStreamSources, finalizeStream, cancelStream } = useChatStore();
  const { activeDiscussionId, fetchDiscussions } = useDiscussionStore();
  const { activeProvider } = useProviderStore();
  const { selectedDocumentIds } = useDocumentStore();

  const sendMessage = useCallback(
    async (content: string, provider?: ProviderName, discussionId?: string) => {
      const targetDiscussionId = discussionId || activeDiscussionId;
      if (!targetDiscussionId) {
        throw new Error('No active discussion');
      }

      const selectedProvider = provider || activeProvider;

      // Add user message to store
      const userMessage = {
        id: crypto.randomUUID(),
        content,
        role: 'user' as const,
        timestamp: new Date().toISOString(),
      };
      addMessage(userMessage);

      // Start streaming
      startStream(selectedProvider);
      messageIdRef.current = crypto.randomUUID();

      try {
        const stream = sseClient.streamChat({
          discussion_id: targetDiscussionId,
          message: content,
          provider: selectedProvider,
          document_ids: selectedDocumentIds.length > 0 ? selectedDocumentIds : undefined,
        });

        for await (const event of stream) {
          if (event.type === 'sources') {
            setStreamSources(event.sources);
          } else if (event.type === 'chunk') {
            appendToStream(event.content);
          } else if (event.type === 'error') {
            throw new Error(event.error);
          } else if (event.type === 'done') {
            finalizeStream(messageIdRef.current);
            // Refresh discussions to update title if changed
            fetchDiscussions();
            break;
          }
        }
      } catch (error) {
        cancelStream();
        throw error;
      }
    },
    [
      activeDiscussionId,
      activeProvider,
      selectedDocumentIds,
      addMessage,
      startStream,
      appendToStream,
      setStreamSources,
      finalizeStream,
      cancelStream,
      fetchDiscussions,
    ]
  );

  const stopStream = useCallback(() => {
    sseClient.cancel();
    cancelStream();
  }, [cancelStream]);

  return {
    sendMessage,
    stopStream,
    isStreaming: useChatStore((state) => state.isStreaming),
  };
}
