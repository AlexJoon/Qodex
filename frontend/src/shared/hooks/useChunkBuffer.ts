import { useRef, useCallback, useEffect } from 'react';

/**
 * Buffers rapid-fire string chunks and flushes them in batches
 * aligned to the browser's animation frame, reducing state updates
 * and re-renders during SSE streaming.
 *
 * Usage:
 *   const { push, flush } = useChunkBuffer(appendToStream);
 *   // on each SSE chunk: push(chunk)
 *   // on stream end:     flush()  (drains remaining buffer synchronously)
 */
export function useChunkBuffer(onFlush: (buffered: string) => void) {
  const bufferRef = useRef('');
  const rafRef = useRef<number | null>(null);
  const onFlushRef = useRef(onFlush);
  onFlushRef.current = onFlush;

  const scheduleFlush = useCallback(() => {
    if (rafRef.current !== null) return; // already scheduled
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      if (bufferRef.current) {
        const chunk = bufferRef.current;
        bufferRef.current = '';
        onFlushRef.current(chunk);
      }
    });
  }, []);

  /** Append a chunk to the internal buffer and schedule a flush. */
  const push = useCallback(
    (chunk: string) => {
      bufferRef.current += chunk;
      scheduleFlush();
    },
    [scheduleFlush],
  );

  /** Drain any remaining buffered content synchronously (call on stream end). */
  const flush = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (bufferRef.current) {
      const chunk = bufferRef.current;
      bufferRef.current = '';
      onFlushRef.current(chunk);
    }
  }, []);

  // Cleanup pending RAF on unmount
  useEffect(() => {
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  return { push, flush };
}
