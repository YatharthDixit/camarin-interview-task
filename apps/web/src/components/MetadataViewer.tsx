import { useNavigate } from 'react-router-dom';
import type { JobWithResult } from '../api/client';
import StatusBadge from './StatusBadge';

interface MetadataViewerProps {
  job: JobWithResult;
  error: string;
  retrying: boolean;
  onRetry: () => void;
}

export default function MetadataViewer({
  job,
  error,
  retrying,
  onRetry,
}: MetadataViewerProps) {
  const navigate = useNavigate();

  const isFlagged = job.result?.flagged ?? false;
  const isCompleted = job.status === 'COMPLETED';
  const isFailed = job.status === 'FAILED';
  const isPending = job.status === 'PENDING' || job.status === 'PROCESSING';
  const labels =
    isCompleted && Array.isArray(job.result?.labels)
      ? (job.result!.labels as Array<{ description: string; score: number }>)
      : [];

  return (
    <div className="job-detail-analysis-col">
      {/* Status card */}
      <div className="job-detail-section">
        <div className="job-detail-section-label">Status</div>
        <div className="status-meta">
          <StatusBadge status={job.status} flagged={isFlagged} />
          <div className="meta-info">
            <div>{new Date(job.createdAt).toLocaleString()}</div>
            <div>Attempt {job.attempts}</div>
          </div>
        </div>

        {isFailed && (
          <button
            className="btn btn-primary btn-block mt-4"
            onClick={onRetry}
            disabled={retrying}
          >
            {retrying ? <span className="spinner" /> : 'Retry processing'}
          </button>
        )}
      </div>

      {/* Processing state */}
      {isPending && (
        <div className="job-detail-section">
          <div className="processing-state">
            <div className="spinner spinner-lg" />
            <p className="processing-label">
              {job.status === 'PENDING' ? 'Waiting in queue' : 'Analyzing with AI'}
            </p>
          </div>
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="alert alert-error mb-3">
          {error}
        </div>
      )}

      {isCompleted && (
        <>
          {/* Safety verdict */}
          <div className={`safety-row ${isFlagged ? 'flagged' : 'safe'}`}>
            <div className="safety-dot" />
            {isFlagged ? (
              <span>
                Flagged — <strong>{job.result?.flaggedCategory}</strong>
              </span>
            ) : (
              <span>Passed all safety checks</span>
            )}
          </div>

          {/* Caption */}
          {!isFlagged && job.result?.caption && (
            <div className="job-detail-section">
              <div className="job-detail-section-label">AI Caption</div>
              <p className="caption-text">{job.result.caption}</p>
            </div>
          )}

          {/* Labels */}
          {labels.length > 0 && (
            <div className="job-detail-section">
              <div className="job-detail-section-label">Detected Labels</div>
              <div className="label-list">
                {labels.map((label, i) => (
                  <div key={i} className="label-row">
                    <div className="label-info">
                      <div className="label-name">{label.description}</div>
                      <div className="label-track">
                        <div
                          className="label-fill"
                          style={{
                            width: `${Math.round(label.score * 100)}%`,
                            ...({ '--label-i': i } as React.CSSProperties),
                          }}
                        />
                      </div>
                    </div>
                    <span className="label-score">{Math.round(label.score * 100)}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Navigate away */}
          <button
            className="btn btn-secondary btn-block mt-2"
            onClick={() => navigate('/')}
          >
            Back to Dashboard
          </button>
        </>
      )}
    </div>
  );
}
