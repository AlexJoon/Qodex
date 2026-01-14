import { useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { sseClient } from '../services/sse';
import { useChatStore } from '../stores/chatStore';
import { useDiscussionStore } from '../stores/discussionStore';
import { useProviderStore } from '../stores/providerStore';
import { useDocumentStore } from '../stores/documentStore';
import { ProviderName } from '../types';
import { api } from '../services/api';

export function useSSE() {
  const navigate = useNavigate();
  const messageIdRef = useRef<string>('');

  const { addMessage, startStream, appendToStream, setStreamSources, setStreamSuggestedQuestions, finalizeStream, cancelStream } = useChatStore();
  const { activeDiscussionId, updateDiscussionTitle } = useDiscussionStore();
  const { activeProvider } = useProviderStore();
  const { selectedDocumentIds } = useDocumentStore();

  const sendMessage = useCallback(
    async (content: string, provider?: ProviderName, discussionId?: string) => {
      let targetDiscussionId = discussionId || activeDiscussionId;

      // Auto-create discussion if none exists (e.g., when starting a new chat)
      if (!targetDiscussionId) {
        const { createDiscussion } = useDiscussionStore.getState();
        const newDiscussion = await createDiscussion();
        targetDiscussionId = newDiscussion.id;
        // Navigate to the new discussion URL
        navigate(`/chat/${targetDiscussionId}`, { replace: true });
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
          } else if (event.type === 'suggested_questions') {
            setStreamSuggestedQuestions(event.questions);
          } else if (event.type === 'error') {
            throw new Error(event.error);
          } else if (event.type === 'done') {
            finalizeStream(messageIdRef.current);

            // Update discussion title in the store (backend may have updated it)
            // This only updates metadata, NOT messages (chatStore is source of truth for messages)
            if (targetDiscussionId) {
              try {
                const updatedDiscussion = await api.getDiscussion(targetDiscussionId);
                updateDiscussionTitle(targetDiscussionId, updatedDiscussion.title);
              } catch (error) {
                console.error('Failed to update discussion title:', error);
              }
            }

            break;
          }
        }
      } catch (error) {
        cancelStream();
        throw error;
      }
    },
    [
      navigate,
      activeDiscussionId,
      activeProvider,
      selectedDocumentIds,
      addMessage,
      startStream,
      appendToStream,
      setStreamSources,
      setStreamSuggestedQuestions,
      finalizeStream,
      cancelStream,
      updateDiscussionTitle,
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
