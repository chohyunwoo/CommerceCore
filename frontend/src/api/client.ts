import type { ApiErrorBody } from './types';

export const API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ??
  'http://localhost:3001';

export class ApiError extends Error {
  statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
  }
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const body = (await response.json()) as ApiErrorBody;
    const message = Array.isArray(body.message)
      ? body.message.join(', ')
      : body.message;
    throw new ApiError(response.status, message);
  }

  return response.json() as Promise<T>;
}

export async function apiGet<T>(
  path: string,
  headers?: Record<string, string>,
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, { headers });
  return handleResponse<T>(response);
}

export async function apiPost<T>(
  path: string,
  body: unknown,
  headers?: Record<string, string>,
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
  return handleResponse<T>(response);
}

export async function apiPostForm<T>(
  path: string,
  formData: FormData,
  headers?: Record<string, string>,
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers,
    body: formData,
  });
  return handleResponse<T>(response);
}

export async function apiPatch<T>(
  path: string,
  body: unknown,
  headers?: Record<string, string>,
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
  return handleResponse<T>(response);
}

export async function apiDelete<T>(
  path: string,
  headers?: Record<string, string>,
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'DELETE',
    headers,
  });
  return handleResponse<T>(response);
}
