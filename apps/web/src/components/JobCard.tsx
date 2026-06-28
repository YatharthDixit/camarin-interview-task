import { useState, useEffect, memo } from 'react';
import { api } from '../api/client';
import type { JobWithResult } from '../api/client';
import StatusBadge from './StatusBadge';
import JobCardBlurOverlay from './JobCardBlurOverlay';

interface JobCardProps {
  job: JobWithResult;
  onClick?: (jobId: string) => void;
  onRetry?: (jobId: string) => void;
  index?: number;
}

export default memo(function JobCard({ job, onClick, onRetry, index = 0 }: JobCardProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  // Tracks whether the <img> element has finished decoding & painting
  const [imageLoaded, setImageLoaded] = useState(false);

  useEffect(() => {
    setImageUrl(null);
    setImageLoaded(false);
    api.getImageUrl(job.id).then((d) => setImageUrl(d.url)).catch(() => {});
  }, [job.id]);

  const isFlagged = job.result?.flagged ?? false;
  const isFailed = job.status === 'FAILED';
  const isPending = job.status === 'PENDING';
  const isProcessing = job.status === 'PROCESSING';

  // Any non-completed-safe image should be blurred
  const shouldBlur = isFlagged || isFailed || isPending || isProcessing;

  // Show shimmer until the image has actually painted
  const isShimmering = !imageLoaded;

  return (
    <div
      className={`job-card ${shouldBlur ? 'blurred-state' : ''} ${!imageLoaded ? 'loading' : ''}`}
      onClick={() => onClick?.(job.id)}
      style={{ ...({ '--card-i': index } as React.CSSProperties) }}
    >
      <div className="job-card-image-wrap">
        {/* Shimmer skeleton — always rendered underneath, hidden once image loads */}
        {isShimmering && (
          <div className="job-card-shimmer" aria-hidden="true" />
        )}

        {/* Image: rendered as soon as URL is available, fades in on load */}
        {imageUrl && (
          <img
            src={imageUrl}
            alt="Upload thumbnail"
            loading="lazy"
            decoding="async"
            className={imageLoaded ? 'img-loaded' : 'img-loading'}
            onLoad={() => setImageLoaded(true)}
          />
        )}

        {/* Blur overlay — covers flagged, failed, pending, processing */}
        {shouldBlur && (
          <JobCardBlurOverlay
            job={job}
            isFlagged={isFlagged}
            isFailed={isFailed}
            isProcessing={isProcessing}
            isPending={isPending}
          />
        )}

        {/* Status badge — only visible for safe completed images */}
        {!shouldBlur && (
          <div className="job-card-badge">
            <StatusBadge status={job.status} flagged={false} />
          </div>
        )}

        {/* Caption hover overlay — only for safe completed images */}
        {job.result?.caption && !shouldBlur && (
          <div className="job-card-overlay">
            <p className="job-card-caption-text">{job.result.caption}</p>
          </div>
        )}
      </div>

      <div className="job-card-body">
        <span className="job-card-date">
          {new Date(job.createdAt).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          })}
        </span>
        {isFailed && onRetry && (
          <button
            className="btn btn-primary"
            onClick={(e) => {
              e.stopPropagation();
              onRetry(job.id);
            }}
          >
            Retry
          </button>
        )}
      </div>
    </div>
  );
})
