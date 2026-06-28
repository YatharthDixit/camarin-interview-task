import { useRef } from 'react';
import { UploadIcon } from './icons';
import { useFileUpload } from '../hooks/useFileUpload';

interface UploadZoneProps {
  onUpload: (file: File) => Promise<unknown>;
}

export default function UploadZone({ onUpload }: UploadZoneProps) {
  const {
    dragging,
    setDragging,
    uploading,
    error,
    progress,
    handleDrop,
    handleFileSelect,
  } = useFileUpload({ onUpload });

  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div>
      <div
        className={`upload-zone ${dragging ? 'dragging' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".jpg,.jpeg,.png,.webp"
          onChange={handleFileSelect}
          className="hidden"
        />

        {uploading ? (
          <>
            <div className="upload-zone-content">
              <UploadIcon className="upload-zone-icon m-0" />
              <p className="upload-zone-text m-0">Uploading…</p>
            </div>
            <div className="upload-zone-progress-wrap">
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${progress}%` }} />
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="upload-zone-content">
              <UploadIcon className="upload-zone-icon m-0" />
              <p className="upload-zone-text m-0">
                <strong>Click to upload</strong> or drag and drop
              </p>
            </div>
            <p className="upload-zone-hint m-0 ml-auto">JPG, PNG, WEBP · max 5 MB</p>
          </>
        )}
      </div>

      {error && (
        <div className="alert alert-error mt-3">
          {error}
        </div>
      )}
    </div>
  );
}
