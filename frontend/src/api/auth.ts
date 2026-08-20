import { apiGet, apiPost } from './client';
import type { AuthResult, CurrentUser } from './types';

const SESSION_TOKEN_KEY = 'sessionToken';

export function getSessionToken(): string {
  return localStorage.getItem(SESSION_TOKEN_KEY) ?? '';
}

export function setSessionToken(token: string): void {
  localStorage.setItem(SESSION_TOKEN_KEY, token);
}

export function clearSessionToken(): void {
  localStorage.removeItem(SESSION_TOKEN_KEY);
}

function sessionHeaders(): Record<string, string> {
  return { 'X-Session-Token': getSessionToken() };
}

export function register(
  email: string,
  password: string,
  name: string,
): Promise<AuthResult> {
  return apiPost<AuthResult>('/auth/register', { email, password, name });
}

export function login(email: string, password: string): Promise<AuthResult> {
  return apiPost<AuthResult>('/auth/login', { email, password });
}

export function logout(): Promise<{ success: boolean }> {
  return apiPost<{ success: boolean }>('/auth/logout', {}, sessionHeaders());
}

export function fetchCurrentUser(): Promise<CurrentUser> {
  return apiGet<CurrentUser>('/auth/me', sessionHeaders());
}
