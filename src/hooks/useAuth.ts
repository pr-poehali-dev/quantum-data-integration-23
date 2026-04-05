import { useState, useEffect, createContext, useContext } from 'react';
import { api, User } from '@/lib/api';

type AuthContextType = {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ error?: string }>;
  register: (username: string, email: string, password: string) => Promise<{ error?: string }>;
  logout: () => void;
};

export const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  login: async () => ({}),
  register: async () => ({}),
  logout: () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

export function useAuthProvider(): AuthContextType {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('reel_token');
    if (token) {
      api.auth.me().then((data) => {
        if (data.user) setUser(data.user);
        setLoading(false);
      }).catch(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email: string, password: string) => {
    const data = await api.auth.login(email, password);
    if (data.error) return { error: data.error };
    localStorage.setItem('reel_token', data.token);
    setUser(data.user);
    return {};
  };

  const register = async (username: string, email: string, password: string) => {
    const data = await api.auth.register(username, email, password);
    if (data.error) return { error: data.error };
    localStorage.setItem('reel_token', data.token);
    setUser(data.user);
    return {};
  };

  const logout = async () => {
    await api.auth.logout();
    setUser(null);
  };

  return { user, loading, login, register, logout };
}
