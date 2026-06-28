import { useState, useRef, useEffect, useCallback } from 'react';

export interface ToastItem {
  id: string;
  title: string;
  message: string;
  type: 'warning' | 'success';
  jobId?: string;
}

export function useToasts() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const toastIdRef = useRef(0);
  const toastTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      toastTimersRef.current.forEach(clearTimeout);
    };
  }, []);

  const addToast = useCallback((toast: Omit<ToastItem, 'id'>, durationMs = 5000) => {
    const id = `toast-${++toastIdRef.current}`;
    setToasts((prev) => [...prev, { id, ...toast }]);
    
    toastTimersRef.current.set(
      id,
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
        toastTimersRef.current.delete(id);
      }, durationMs)
    );
  }, []);

  const dismissToast = useCallback((id: string) => {
    clearTimeout(toastTimersRef.current.get(id));
    toastTimersRef.current.delete(id);
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return { toasts, addToast, dismissToast };
}
