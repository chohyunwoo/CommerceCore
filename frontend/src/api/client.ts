import type { ApiErrorBody } from './types';

const API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ??
  'http://localhost:3001';

export class ApiError extends Error {
  statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
  }
}

export async function apiGet<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`);

  if (!response.ok) {
    const body = (await response.json()) as ApiErrorBody;
    const message = Array.isArray(body.message)
      ? body.message.join(', ')
      : body.message;
    throw new ApiError(response.status, message);
  }

  return response.json() as Promise<T>;
}
