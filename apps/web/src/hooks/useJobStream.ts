import { useEffect, useRef, useCallback, useState } from 'react';

export interface JobStreamEvent {
  type: 'JOB_UPDATE' | 'FLAGGED_NOTIFICATION' | 'connected';
  jobId?: string;
  status?: string;
  result?: {
    caption?: string | null;
    labels?: unknown;
    flagged?: boolean;
    flaggedCategory?: string | null;
  };
  timestamp?: string;
}

interface UseJobStreamOptions {
  onEvent: (event: JobStreamEvent) => void;
  enabled?: boolean;
}

/**
 * SSE hook — connects to /api/jobs/stream for real-time job updates.
 * Auto-reconnects with exponential backoff on error.
 */
export function useJobStream({ onEvent, enabled = true }: UseJobStreamOptions) {
  const [connected, setConnected] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const retriesRef = useRef(0);

  const connect = useCallback(() => {
    if (!enabled) return;

    const es = new EventSource('/api/jobs/stream', { withCredentials: true });
    eventSourceRef.current = es;

    es.onopen = () => {
      setConnected(true);
      retriesRef.current = 0;
    };

    es.onmessage = (e) => {
      try {
        const event = JSON.parse(e.data) as JobStreamEvent;
        onEvent(event);
      } catch {
        // ignore malformed events
      }
    };

    es.onerror = () => {
      setConnected(false);
      es.close();
      eventSourceRef.current = null;

      // Exponential backoff: 1s, 2s, 4s, 8s, max 30s
      const delay = Math.min(1000 * Math.pow(2, retriesRef.current), 30_000);
      retriesRef.current++;

      reconnectTimeoutRef.current = setTimeout(connect, delay);
    };
  }, [enabled, onEvent]);

  useEffect(() => {
    connect();
    return () => {
      eventSourceRef.current?.close();
      clearTimeout(reconnectTimeoutRef.current);
    };
  }, [connect]);

  return { connected };
}
