import type { JobWithResult } from '../api/client';
import JobCard from './JobCard';
import { EmptyIcon } from './icons';

interface JobListProps {
  loading: boolean;
  jobs: JobWithResult[];
  hasActiveFilters: boolean;
  hasMore: boolean;
  loadingMore: boolean;
  onClearFilters: () => void;
  onJobClick: (jobId: string) => void;
  onRetry: (jobId: string) => void;
  onLoadMore: () => void;
}

export default function JobList({
  loading,
  jobs,
  hasActiveFilters,
  hasMore,
  loadingMore,
  onClearFilters,
  onJobClick,
  onRetry,
  onLoadMore,
}: JobListProps) {
  if (loading) {
    return (
      <div className="loading-page">
        <div className="spinner spinner-lg" />
        <p>Loading{hasActiveFilters ? ' results' : ' your jobs'}…</p>
      </div>
    );
  }

  if (jobs.length === 0) {
    return (
      <div className="empty-state">
        <EmptyIcon className="empty-state-icon" />
        <p>
          {hasActiveFilters
            ? 'No uploads match your current filters.'
            : 'No uploads yet. Drop an image above to get started.'}
        </p>
        {hasActiveFilters && (
          <button className="btn btn-ghost mt-4" onClick={onClearFilters}>
            Clear filters
          </button>
        )}
      </div>
    );
  }

  return (
    <>
      <div className="job-grid">
        {jobs.map((job, idx) => (
          <JobCard
            key={job.id}
            job={job}
            index={idx}
            onClick={onJobClick}
            onRetry={job.status === 'FAILED' ? onRetry : undefined}
          />
        ))}
      </div>

      {hasMore && (
        <div className="text-center mt-8">
          <button
            className="btn btn-secondary"
            onClick={onLoadMore}
            disabled={loadingMore}
          >
            {loadingMore ? <span className="spinner" /> : 'Load more'}
          </button>
        </div>
      )}
    </>
  );
}
