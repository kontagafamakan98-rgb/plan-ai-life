import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import axios from 'axios';

const API_BASE = process.env.EXPO_PUBLIC_BACKEND_URL || '';

interface User {
  id: string;
  email: string;
  name: string;
  picture?: string;
  language: string;
  is_premium: boolean;
  characters: string[];
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string, language: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  updateLanguage: (lang: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Storage helpers
const setToken = async (token: string) => {
  if (Platform.OS === 'web') {
    localStorage.setItem('auth_token', token);
  } else {
    await SecureStore.setItemAsync('auth_token', token);
  }
};

const getToken = async (): Promise<string | null> => {
  if (Platform.OS === 'web') {
    return localStorage.getItem('auth_token');
  } else {
    return await SecureStore.getItemAsync('auth_token');
  }
};

const removeToken = async () => {
  if (Platform.OS === 'web') {
    localStorage.removeItem('auth_token');
  } else {
    await SecureStore.deleteItemAsync('auth_token');
  }
};

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Check for session on mount
  useEffect(() => {
    checkSession();
    
    // Handle Google OAuth redirect on web
    if (Platform.OS === 'web') {
      const hash = window.location.hash;
      const search = window.location.search;
      let sessionId = '';
      
      if (hash.includes('session_id=')) {
        sessionId = hash.split('session_id=')[1].split('&')[0];
      } else if (search.includes('session_id=')) {
        sessionId = new URLSearchParams(search).get('session_id') || '';
      }
      
      if (sessionId) {
        handleGoogleCallback(sessionId);
        window.history.replaceState(null, '', window.location.pathname);
      }
    }
  }, []);

  const checkSession = async () => {
    try {
      const token = await getToken();
      if (token) {
        const response = await axios.get(`${API_BASE}/api/auth/me`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setUser(response.data);
      }
    } catch (error) {
      await removeToken();
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleCallback = async (sessionId: string) => {
    try {
      const response = await axios.post(`${API_BASE}/api/auth/google?session_id=${sessionId}`);
      await setToken(response.data.token);
      setUser(response.data.user);
    } catch (error) {
      console.error('Google auth error:', error);
    }
  };

  const login = async (email: string, password: string) => {
    const response = await axios.post(`${API_BASE}/api/auth/login`, { email, password });
    await setToken(response.data.token);
    setUser(response.data.user);
  };

  const register = async (email: string, password: string, name: string, language: string) => {
    const response = await axios.post(`${API_BASE}/api/auth/register`, { email, password, name, language });
    await setToken(response.data.token);
    setUser(response.data.user);
  };

  const loginWithGoogle = async () => {
    const redirectUrl = Platform.OS === 'web' 
      ? window.location.origin + '/'
      : Linking.createURL('auth');
    
    const authUrl = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
    
    if (Platform.OS === 'web') {
      window.location.href = authUrl;
    } else {
      const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUrl);
      if (result.type === 'success' && result.url) {
        const url = result.url;
        let sessionId = '';
        if (url.includes('session_id=')) {
          sessionId = url.split('session_id=')[1].split('&')[0];
        }
        if (sessionId) {
          await handleGoogleCallback(sessionId);
        }
      }
    }
  };

  const logout = async () => {
    try {
      const token = await getToken();
      if (token) {
        await axios.post(`${API_BASE}/api/auth/logout`, {}, {
          headers: { Authorization: `Bearer ${token}` }
        });
      }
    } catch (error) {
      // Ignore errors
    }
    await removeToken();
    setUser(null);
  };

  const updateLanguage = async (lang: string) => {
    const token = await getToken();
    if (token && user) {
      await axios.put(`${API_BASE}/api/auth/language?lang=${lang}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUser({ ...user, language: lang });
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, loginWithGoogle, logout, updateLanguage }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
