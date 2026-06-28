import { FlagIcon, FailedIcon, PendingIcon } from './icons';
import type { JobWithResult } from '../api/client';

interface JobCardBlurOverlayProps {
  job: JobWithResult;
  isFlagged: boolean;
  isFailed: boolean;
  isProcessing: boolean;
  isPending: boolean;
}

export default function JobCardBlurOverlay({
  job,
  isFlagged,
  isFailed,
  isProcessing,
  isPending,
}: JobCardBlurOverlayProps) {
  return (
    <div className="job-card-blur-overlay">
      {isFlagged ? (
        <>
          <FlagIcon className="text-warning mb-2" width={26} height={26} />
          <span className="blur-overlay-title">Flagged Content</span>
          <span className="blur-overlay-subtitle">
            {job.result?.flaggedCategory ?? 'Violation detected'}
          </span>
        </>
      ) : isFailed ? (
        <>
          <FailedIcon className="text-danger mb-2" width={26} height={26} />
          <span className="blur-overlay-title">Processing Failed</span>
          <span className="blur-overlay-subtitle">Safety status unknown</span>
        </>
      ) : isProcessing ? (
        <>
          <div className="blur-overlay-spinner" />
          <span className="blur-overlay-title">Analyzing…</span>
          <span className="blur-overlay-subtitle">Running safety &amp; AI checks</span>
        </>
      ) : (
        /* isPending */
        <>
          <PendingIcon className="text-secondary mb-2" width={26} height={26} />
          <span className="blur-overlay-title">Awaiting Review</span>
          <span className="blur-overlay-subtitle">Queued for processing</span>
        </>
      )}
    </div>
  );
}
