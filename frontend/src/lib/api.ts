import type { Pagination } from './types';

type ApiFailure = { success: false; error: { code: string; message: string; fields?: Record<string,string> }; requestId?: string };
export type ApiResponse<T> = { success: true; data: T; message?: string; pagination?: Pagination; meta?: Record<string,unknown> };

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public fields: Record<string,string> = {}, public requestId?: string) { super(message); }
}

let csrfToken: string | null = null;
export const setCsrfToken = (token: string | null) => { csrfToken = token; };

async function ensureCsrf() {
  if (csrfToken) return csrfToken;
  const response = await fetch('/api/auth/csrf', { credentials: 'include' });
  const payload = await response.json() as ApiResponse<{csrfToken:string}>;
  csrfToken = payload.data.csrfToken;
  return csrfToken;
}

export async function api<T>(path: string, options: RequestInit & { timeout?: number } = {}): Promise<ApiResponse<T>> {
  const controller = new AbortController();
  let timedOut = false;
  const relayAbort = () => controller.abort(options.signal?.reason);
  options.signal?.addEventListener('abort', relayAbort, { once: true });
  const timeout = window.setTimeout(() => { timedOut = true; controller.abort(); }, options.timeout ?? 12_000);
  const method = options.method?.toUpperCase() ?? 'GET';
  const headers = new Headers(options.headers);
  if (options.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  if (!['GET','HEAD','OPTIONS'].includes(method)) headers.set('X-CSRF-Token', await ensureCsrf());
  try {
    const response = await fetch(`/api${path}`, { ...options, method, headers, credentials: 'include', signal: controller.signal });
    if (response.status === 204) return { success: true, data: undefined as T };
    const payload = await response.json() as ApiResponse<T> | ApiFailure;
    if (!response.ok || !payload.success) {
      const failure = payload as ApiFailure;
      if (response.status === 401) window.dispatchEvent(new Event('campus-auth-expired'));
      throw new ApiError(response.status, failure.error?.code ?? 'REQUEST_FAILED', failure.error?.message ?? 'Request failed.', failure.error?.fields, failure.requestId);
    }
    return payload;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (timedOut) throw new ApiError(408, 'TIMEOUT', 'The request took too long. Please try again.');
    if (options.signal?.aborted) throw error;
    if ((error as Error).name === 'AbortError') throw new ApiError(408, 'TIMEOUT', 'The request took too long. Please try again.');
    throw new ApiError(0, 'OFFLINE', 'Unable to reach the service. Check your connection and try again.');
  } finally { window.clearTimeout(timeout); options.signal?.removeEventListener('abort', relayAbort); }
}

export const queryString = (values: Record<string, unknown>) => {
  const search = new URLSearchParams();
  Object.entries(values).forEach(([key,value]) => { if (value !== undefined && value !== null && value !== '') search.set(key, String(value)); });
  return search.toString();
};
