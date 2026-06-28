import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import type { JobWithResult } from '../api/client';
import { useJobStream } from '../hooks/useJobStream';
import type { JobStreamEvent } from '../hooks/useJobStream';
import UploadZone from '../components/UploadZone';
import Toast from '../components/Toast';
import DashboardFilters from '../components/DashboardFilters';
import JobList from '../components/JobList';
import { useToasts } from '../hooks/useToasts';

interface JobFilters {
  search: string;
  status: string; // '' | 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED'
  flagged: string; // '' | 'true' | 'false'
}



export default function DashboardPage() {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState<JobWithResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [nextCursor, setNextCursor] = useState<string | undefined>();
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const { toasts, addToast, dismissToast } = useToasts();

  // Filter state — committing a search only after debounce
  const [searchInput, setSearchInput] = useState('');
  const [filters, setFilters] = useState<JobFilters>({ search: '', status: '', flagged: '' });
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout>>();

  // Debounce: fire actual search 400ms after user stops typing
  useEffect(() => {
    clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      setFilters((prev) => ({ ...prev, search: searchInput.trim() }));
    }, 400);
    return () => clearTimeout(searchDebounceRef.current);
  }, [searchInput]);

  // Fetch fresh page — recreates when filters change (triggers the effect below)
  const fetchJobs = useCallback(async () => {
    setLoading(true);
    setJobs([]);
    setNextCursor(undefined);
    setHasMore(false);
    try {
      const data = await api.getJobs({
        search: filters.search || undefined,
        status: filters.status || undefined,
        flagged: filters.flagged || undefined,
      });
      setJobs(data.jobs);
      setNextCursor(data.nextCursor);
      setHasMore(data.hasMore);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { fetchJobs(); }, [fetchJobs]);

  // Load next page (keeps existing jobs, just appends)
  const loadMore = async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const data = await api.getJobs({
        cursor: nextCursor,
        search: filters.search || undefined,
        status: filters.status || undefined,
        flagged: filters.flagged || undefined,
      });
      setJobs((prev) => [...prev, ...data.jobs]);
      setNextCursor(data.nextCursor);
      setHasMore(data.hasMore);
    } catch {
      // silently fail
    } finally {
      setLoadingMore(false);
    }
  };

  // SSE real-time updates
  const handleSSE = useCallback((event: JobStreamEvent) => {
    if (event.type === 'connected') return;

    if (event.type === 'FLAGGED_NOTIFICATION' && event.jobId) {
      addToast({
        title: 'Content Flagged',
        message: `Your upload was flagged as "${event.result?.flaggedCategory}". Click to view details.`,
        type: 'warning',
        jobId: event.jobId,
      }, 8000);
      return;
    }

    if (event.type === 'JOB_UPDATE' && event.jobId) {
      setJobs((prev) => {
        const idx = prev.findIndex((j) => j.id === event.jobId);
        if (idx === -1) {
          // New job or not in current filtered view — refetch
          fetchJobs();
          return prev;
        }
        const updated = [...prev];
        const existing = updated[idx]!;
        updated[idx] = {
          ...existing,
          status: (event.status as JobWithResult['status']) ?? existing.status,
          result: event.result
            ? {
                id: existing.result?.id ?? '',
                caption: event.result.caption ?? existing.result?.caption ?? null,
                labels: (event.result.labels as JobWithResult['result'] extends null ? never : NonNullable<JobWithResult['result']>['labels']) ?? existing.result?.labels ?? null,
                flagged: event.result.flagged ?? existing.result?.flagged ?? false,
                flaggedCategory: event.result.flaggedCategory ?? existing.result?.flaggedCategory ?? null,
                createdAt: existing.result?.createdAt ?? new Date().toISOString(),
              }
            : existing.result,
        };
        return updated;
      });

      if (event.status === 'COMPLETED' && !event.result?.flagged) {
        addToast({
          title: 'Processing Complete',
          message: 'Your image has been analyzed successfully.',
          type: 'success',
          jobId: event.jobId,
        }, 5000);
      }
    }
  }, [fetchJobs, addToast]);

  useJobStream({ onEvent: handleSSE });

  const handleUpload = useCallback(async (file: File) => {
    const data = await api.uploadImage(file);
    await fetchJobs();
    return data.job;
  }, [fetchJobs]);

  const handleRetry = useCallback(async (jobId: string) => {
    await api.retryJob(jobId);
    await fetchJobs();
  }, [fetchJobs]);

  const handleJobClick = useCallback((jobId: string) => {
    navigate(`/jobs/${jobId}`);
  }, [navigate]);



  const setStatus = (value: string) => setFilters((f) => ({ ...f, status: value }));
  const setFlagged = (value: string) => setFilters((f) => ({ ...f, flagged: value }));

  const activeFilters = filters.search || filters.status || filters.flagged;

  return (
    <div className="page-container">
      <div className="toast-container">
        {toasts.map((toast) => (
          <Toast
            key={toast.id}
            title={toast.title}
            message={toast.message}
            type={toast.type}
            onClick={() => {
              dismissToast(toast.id);
              if (toast.jobId) navigate(`/jobs/${toast.jobId}`);
            }}
            onDismiss={() => dismissToast(toast.id)}
          />
        ))}
      </div>

      <div className="dashboard-header">
        <h1>Dashboard</h1>
      </div>

      <UploadZone onUpload={handleUpload} />

      <DashboardFilters
        searchInput={searchInput}
        setSearchInput={setSearchInput}
        filters={filters}
        setStatus={setStatus}
        setFlagged={setFlagged}
      />

      <div className="mt-6">
        <h2 className="section-title">
          Your Uploads
        </h2>

        <JobList
          loading={loading}
          jobs={jobs}
          hasActiveFilters={!!activeFilters}
          hasMore={hasMore}
          loadingMore={loadingMore}
          onClearFilters={() => {
            setSearchInput('');
            setFilters({ search: '', status: '', flagged: '' });
          }}
          onJobClick={handleJobClick}
          onRetry={handleRetry}
          onLoadMore={loadMore}
        />
      </div>
    </div>
  );
}
