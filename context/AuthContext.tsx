'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import type { AuthState, User } from '@/types';

interface AuthContextType extends AuthState {
  setUser: (user: User | null) => void;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user:       null,
    role:       null,
    mustChange: false,
    isLoading:  true,
  });

  async function refresh() {
    try {
      const res = await fetch('/api/auth/me', { credentials: 'include' });
      if (!res.ok) {
        setState({ user: null, role: null, mustChange: false, isLoading: false });
        return;
      }
      const json = await res.json();
      if (json.success && json.data) {
        const u = json.data;
        setState({
          user:       u,
          role:       u.role_name?.toLowerCase() as 'admin' | 'faculty' | 'student',
          mustChange: Boolean(u.must_change_password),
          isLoading:  false,
        });
      } else {
        setState({ user: null, role: null, mustChange: false, isLoading: false });
      }
    } catch {
      setState({ user: null, role: null, mustChange: false, isLoading: false });
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  function setUser(user: User | null) {
    if (!user) {
      setState({ user: null, role: null, mustChange: false, isLoading: false });
    } else {
      setState(prev => ({
        ...prev,
        user,
        role:      (user as any).role_name?.toLowerCase() as 'admin' | 'faculty' | 'student',
        mustChange: Boolean((user as any).must_change_password),
      }));
    }
  }

  return (
    <AuthContext.Provider value={{ ...state, setUser, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuthContext must be used within AuthProvider');
  return ctx;
}
