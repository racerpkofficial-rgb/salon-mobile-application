
import { Platform } from 'react-native';
import { AuthUser } from '../types';

function resolveApiBaseUrl(): string {
  const envUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();
  if (envUrl) {
    let clean = envUrl.replace(/\/+$/, '');
    // Ensure remote production domains use HTTPS
    if (
      clean.startsWith('http://') &&
      !clean.includes('localhost') &&
      !clean.includes('10.0.2.2') &&
      !clean.includes('10.') &&
      !clean.includes('192.168.')
    ) {
      clean = clean.replace(/^http:\/\//, 'https://');
    }
    // Ensure /api/v1 suffix is present
    if (!clean.endsWith('/api/v1')) {
      clean = `${clean}/api/v1`;
    }
    return clean;
  }

  const defaultHost = Platform.OS === 'android' ? '10.0.2.2' : 'localhost';
  return `http://${defaultHost}:4000/api/v1`;
}

export const API_BASE_URL = resolveApiBaseUrl();

console.log('[Book My Salon API URL]', API_BASE_URL);

export class ApiError extends Error {
  constructor(message: string, public status: number, public code?: string) {
    super(message);
    this.name = 'ApiError';
  }
}

type Options = {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  body?: unknown;
  token?: string;
  timeoutMs?: number;
  useCache?: boolean;
};

// In-memory cache for offline resiliency on GET requests
const memoryCache = new Map<string, { data: unknown; timestamp: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export async function request<T>(path: string, options: Options = {}): Promise<T> {
  const method = options.method || 'GET';
  const timeoutMs = options.timeoutMs || 15000;
  const cacheKey = `${method}:${path}:${options.token ? 'auth' : 'anon'}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(options.token ? { Authorization: `Bearer ${options.token}` } : {})
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: controller.signal
    });

    clearTimeout(timer);

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      throw new ApiError(
        data?.message || `Request failed with status ${response.status}`,
        response.status,
        data?.code
      );
    }

    // Cache successful GET requests
    if (method === 'GET' && data) {
      memoryCache.set(cacheKey, { data, timestamp: Date.now() });
    }

    return data as T;
  } catch (error: any) {
    clearTimeout(timer);

    if (error instanceof ApiError) throw error;

    // Check for cached offline data on GET failure
    if (method === 'GET' && memoryCache.has(cacheKey)) {
      const cached = memoryCache.get(cacheKey)!;
      console.warn(`[Book My Salon API] Network unavailable for ${path}. Serving offline cache.`);
      return cached.data as T;
    }

    if (error.name === 'AbortError') {
      throw new ApiError(
        'The request timed out. Please check your internet connection and try again.',
        408
      );
    }

    throw new ApiError(
      'Unable to connect to Book My Salon server. Please ensure the backend is running and internet is active.',
      0
    );
  }
}

export const getCurrentUser = (token: string) => request<{ user: AuthUser }>('/auth/me', { token });