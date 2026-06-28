import { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import type { JobWithResult } from '../api/client';
import { useJobStream } from '../hooks/useJobStream';
import type { JobStreamEvent } from '../hooks/useJobStream';
import ImagePreview from '../components/ImagePreview';
import MetadataViewer from '../components/MetadataViewer';

export default function JobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [job, setJob] = useState<JobWithResult | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState(false);
  const [error, setError] = useState('');

  const fetchJob = useCallback(async () => {
    if (!id) return;
    try {
      const data = await api.getJob(id);
      setJob(data.job);
      const urlData = await api.getImageUrl(id);
      setImageUrl(urlData.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load job');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchJob(); }, [fetchJob]);

  const handleSSE = useCallback(
    (event: JobStreamEvent) => {
      if (event.type !== 'JOB_UPDATE' || event.jobId !== id) return;
      fetchJob();
    },
    [id, fetchJob],
  );

  useJobStream({ onEvent: handleSSE });

  const handleRetry = async () => {
    if (!id) return;
    setRetrying(true);
    try {
      await api.retryJob(id);
      await fetchJob();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Retry failed');
    } finally {
      setRetrying(false);
    }
  };

  if (loading) {
    return (
      <div className="page-container">
        <div className="loading-page">
          <div className="spinner spinner-lg" />
          <p>Loading job details…</p>
        </div>
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="page-container">
        <Link to="/" className="back-link">← Dashboard</Link>
        <div className="empty-state">
          <p>{error || 'Job not found'}</p>
        </div>
      </div>
    );
  }

  const isFlagged = job.result?.flagged ?? false;

  return (
    <div className="page-container">
      <Link to="/" className="back-link">
        ← Dashboard
      </Link>

      <div className="job-detail-layout">
        <div className="job-detail-image-col">
          <ImagePreview
            imageUrl={imageUrl}
            isFlagged={isFlagged}
            flaggedCategory={job.result?.flaggedCategory}
          />
        </div>

        <MetadataViewer
          job={job}
          error={error}
          retrying={retrying}
          onRetry={handleRetry}
        />
      </div>
    </div>
  );
}
