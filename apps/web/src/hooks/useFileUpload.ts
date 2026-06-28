import { useState, useCallback } from 'react';

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE = 5 * 1024 * 1024;

interface UseFileUploadOptions {
  onUpload: (file: File) => Promise<unknown>;
}

export function useFileUpload({ onUpload }: UseFileUploadOptions) {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState(0);

  const validateAndUpload = useCallback(
    async (file: File) => {
      setError('');

      if (!ACCEPTED_TYPES.includes(file.type)) {
        setError('Only JPG, PNG, and WEBP images are accepted');
        return;
      }

      if (file.size > MAX_SIZE) {
        setError(`File too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum is 5 MB.`);
        return;
      }

      setUploading(true);
      setProgress(30);

      try {
        await onUpload(file);
        setProgress(100);
        setTimeout(() => {
          setProgress(0);
          setUploading(false);
        }, 500);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Upload failed');
        setUploading(false);
        setProgress(0);
      }
    },
    [onUpload],
  );

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) validateAndUpload(file);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) validateAndUpload(file);
    e.target.value = '';
  };

  return {
    dragging,
    setDragging,
    uploading,
    error,
    progress,
    handleDrop,
    handleFileSelect,
  };
}
