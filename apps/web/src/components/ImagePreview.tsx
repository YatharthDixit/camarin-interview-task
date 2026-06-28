import { useState } from 'react';

interface ImagePreviewProps {
  imageUrl: string | null;
  isFlagged: boolean;
  flaggedCategory?: string | null;
}

export default function ImagePreview({
  imageUrl,
  isFlagged,
  flaggedCategory,
}: ImagePreviewProps) {
  const [imageRevealed, setImageRevealed] = useState(false);

  if (!imageUrl) {
    return (
      <div className="job-detail-image-placeholder">
        <div className="spinner spinner-lg" />
      </div>
    );
  }

  if (isFlagged) {
    return (
      <div className="flagged-image-container">
        <img
          src={imageUrl}
          alt="Uploaded image"
          className={`job-detail-image ${imageRevealed ? '' : 'blurred'}`}
        />
        {!imageRevealed && (
          <div className="flagged-image-overlay">
            <div className="flagged-overlay-icon">
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </div>
            <div>
              <div className="flagged-overlay-title">Sensitive Content</div>
              {flaggedCategory && (
                <div className="flagged-overlay-chip mt-2">
                  {flaggedCategory}
                </div>
              )}
            </div>
            <p className="flagged-overlay-desc">
              This image was flagged by our safety system and may contain adult or sensitive material.
            </p>
            <button
              className="btn-reveal"
              onClick={() => setImageRevealed(true)}
            >
              View anyway
            </button>
          </div>
        )}
      </div>
    );
  }

  return <img src={imageUrl} alt="Uploaded image" className="job-detail-image" />;
}
