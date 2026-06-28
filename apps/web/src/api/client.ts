const BASE_URL = '/api';

interface ApiError {
  error: { code: string; message: string; details?: string[] };
}

class ApiClient {
  /**
   * Internal request handler with automatic token refresh
   */
  private async request<T>(
    url: string,
    options: RequestInit = {},
  ): Promise<T> {
    const response = await fetch(`${BASE_URL}${url}`, {
      ...options,
      credentials: 'include',
      headers: {
        ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
        ...options.headers,
      },
    });

    if (response.status === 401 && !url.includes('/auth/refresh')) {
      // Try refreshing the token
      const refreshed = await this.refreshToken();
      if (refreshed) {
        // Retry original request
        return this.request<T>(url, options);
      }
      throw new Error('Session expired — please log in again');
    }

    if (!response.ok) {
      const errorBody = await response.json().catch(() => null) as ApiError | null;
      throw new Error(
        errorBody?.error?.message ?? `Request failed with status ${response.status}`,
      );
    }

    const data = await response.json() as { data: T };
    return data.data;
  }

  private async refreshToken(): Promise<boolean> {
    try {
      const res = await fetch(`${BASE_URL}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  // --- Auth API ---

  async signup(email: string, password: string) {
    return this.request<{ user: User }>('/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  async login(email: string, password: string) {
    return this.request<{ user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  async logout() {
    return this.request<{ message: string }>('/auth/logout', { method: 'POST' });
  }

  async getMe() {
    return this.request<{ user: User }>('/auth/me');
  }

  // --- Jobs API ---

  /**
   * Uploads an image to trigger a new background job
   */
  async uploadImage(file: File) {
    const formData = new FormData();
    formData.append('image', file);
    return this.request<{ job: JobSummary }>('/jobs/upload', {
      method: 'POST',
      body: formData,
    });
  }

  /**
   * Fetch paginated list of jobs with optional filters
   */
  async getJobs(opts: {
    cursor?: string;
    limit?: number;
    search?: string;
    status?: string;
    flagged?: string;
  } = {}) {
    const params = new URLSearchParams();
    if (opts.cursor) params.set('cursor', opts.cursor);
    params.set('limit', String(opts.limit ?? 20));
    if (opts.search) params.set('search', opts.search);
    if (opts.status) params.set('status', opts.status);
    if (opts.flagged !== undefined) params.set('flagged', opts.flagged);
    return this.request<{ jobs: JobWithResult[]; nextCursor?: string; hasMore: boolean }>(
      `/jobs?${params.toString()}`,
    );
  }

  /**
   * Fetch a single job by ID
   */
  async getJob(id: string) {
    return this.request<{ job: JobWithResult }>(`/jobs/${id}`);
  }

  /**
   * Generate a signed URL to fetch the image from R2
   */
  async getImageUrl(id: string) {
    return this.request<{ url: string }>(`/jobs/${id}/image-url`);
  }

  /**
   * Retry a failed job
   */
  async retryJob(id: string) {
    return this.request<{ job: JobSummary }>(`/jobs/${id}/retry`, { method: 'POST' });
  }
}

export const api = new ApiClient();

// Types
export interface User {
  id: string;
  email: string;
  createdAt?: string;
}

export interface JobSummary {
  id: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
}

export interface JobResult {
  id: string;
  caption: string | null;
  labels: Array<{ description: string; score: number }> | null;
  flagged: boolean;
  flaggedCategory: string | null;
  createdAt: string;
}

export interface JobWithResult {
  id: string;
  userId: string;
  r2Key: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  attempts: number;
  createdAt: string;
  updatedAt: string;
  result: JobResult | null;
}
