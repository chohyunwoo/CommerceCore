import { apiGet, apiPost } from './client';
import { getCartId } from '../lib/cartId';
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

// 게스트 장바구니를 로그인 사용자 장바구니로 병합할 수 있도록 X-Cart-Id를 함께 보낸다.
function cartIdHeader(): Record<string, string> {
  return { 'X-Cart-Id': getCartId() };
}

export function register(
  email: string,
  password: string,
  name: string,
): Promise<AuthResult> {
  return apiPost<AuthResult>(
    '/auth/register',
    { email, password, name },
    cartIdHeader(),
  );
}

export function login(email: string, password: string): Promise<AuthResult> {
  return apiPost<AuthResult>('/auth/login', { email, password }, cartIdHeader());
}

export function logout(): Promise<{ success: boolean }> {
  return apiPost<{ success: boolean }>('/auth/logout', {}, sessionHeaders());
}

export function fetchCurrentUser(): Promise<CurrentUser> {
  return apiGet<CurrentUser>('/auth/me', sessionHeaders());
}
