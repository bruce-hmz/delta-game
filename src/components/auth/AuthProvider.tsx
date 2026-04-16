'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { getStoredToken, clearStoredToken } from '@/lib/supabase-auth-client';

interface AuthContextType {
  isAuthenticated: boolean;
  accessToken: string | null;
  playerId: string | null;
  user: { id: string; email: string } | null;
  login: (token: string, playerId: string, user: any) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [user, setUser] = useState<{ id: string; email: string } | null>(null);

  useEffect(() => {
    // 从 localStorage 恢复登录状态
    const token = getStoredToken();
    if (token) {
      setAccessToken(token);
      setIsAuthenticated(true);
      // TODO: 验证 token 有效性
    }
  }, []);

  const login = (token: string, pid: string, userData: any) => {
    setAccessToken(token);
    setPlayerId(pid);
    setUser(userData);
    setIsAuthenticated(true);
  };

  const logout = () => {
    clearStoredToken();
    setAccessToken(null);
    setPlayerId(null);
    setUser(null);
    setIsAuthenticated(false);
  };

  return (
    <AuthContext.Provider value={{
      isAuthenticated,
      accessToken,
      playerId,
      user,
      login,
      logout
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
