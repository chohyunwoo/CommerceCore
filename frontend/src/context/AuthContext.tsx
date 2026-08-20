import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import {
  clearSessionToken,
  fetchCurrentUser,
  getSessionToken,
  login as loginRequest,
  logout as logoutRequest,
  register as registerRequest,
  setSessionToken,
} from '../api/auth';
import type { CurrentUser } from '../api/types';

interface AuthContextValue {
  user: CurrentUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!getSessionToken()) {
      setLoading(false);
      return;
    }
    fetchCurrentUser()
      .then(setUser)
      .catch(() => clearSessionToken())
      .finally(() => setLoading(false));
  }, []);

  async function login(email: string, password: string) {
    const result = await loginRequest(email, password);
    setSessionToken(result.token);
    setUser(result.user);
  }

  async function register(email: string, password: string, name: string) {
    const result = await registerRequest(email, password, name);
    setSessionToken(result.token);
    setUser(result.user);
  }

  async function logout() {
    if (getSessionToken()) {
      await logoutRequest().catch(() => {
        // 이미 만료된 세션이어도 로컬 상태는 정리한다
      });
    }
    clearSessionToken();
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth는 AuthProvider 안에서만 사용할 수 있습니다.');
  }
  return context;
}
