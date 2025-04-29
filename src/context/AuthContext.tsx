import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Octokit } from '@octokit/rest';
import { AuthState, User } from '../types';
import { useNavigate } from 'react-router-dom';

interface AuthContextType {
  authState: AuthState;
  login: () => void;
  logout: () => void;
  getOctokit: () => Octokit | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// GitHub OAuth configuration
const CLIENT_ID = 'Ov23li62SpDD7SKp9Kjb';
// SECURITY RISK: Never store client secrets in frontend code
// const CLIENT_SECRET = 'ba02cd6b5f0bd8667e79a6d49a2e43eb88aa2e8b';
const REDIRECT_URI = 'https://golden-kheer-6876e9.netlify.app/auth/callback';
const AUTH_STORAGE_KEY = 'commitpad_auth';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    user: null,
    token: null,
    loading: true,
    error: null,
  });
  
  const navigate = useNavigate();

  useEffect(() => {
    // Load auth state from localStorage
    const storedAuth = localStorage.getItem(AUTH_STORAGE_KEY);
    if (storedAuth) {
      try {
        const parsedAuth = JSON.parse(storedAuth);
        setAuthState({
          ...parsedAuth,
          loading: false,
        });
      } catch (e) {
        localStorage.removeItem(AUTH_STORAGE_KEY);
        setAuthState({
          isAuthenticated: false,
          user: null,
          token: null,
          loading: false,
          error: 'Invalid stored authentication',
        });
      }
    } else {
      setAuthState(prev => ({ ...prev, loading: false }));
    }

    // Check for auth callback
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    
    if (code && window.location.pathname === '/auth/callback') {
      handleAuthCallback(code);
    }
  }, []);

  const handleAuthCallback = async (code: string) => {
    setAuthState(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      // Exchange code for token using our Netlify function
      const tokenResponse = await fetch('/.netlify/functions/github-auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          code,
        }),
      });

      if (!tokenResponse.ok) {
        throw new Error('Failed to exchange code for token');
      }

      const tokenData = await tokenResponse.json();
      
      if (tokenData.error) {
        throw new Error(tokenData.error_description || 'Failed to get access token');
      }

      const token = tokenData.access_token;
      
      if (!token) {
        throw new Error('No access token received');
      }

      // Create an Octokit instance with the token
      const octokit = new Octokit({ auth: token });
      
      // Get the authenticated user
      const { data: userData } = await octokit.users.getAuthenticated();

      const user: User = {
        id: userData.id,
        login: userData.login,
        name: userData.name || userData.login,
        avatar_url: userData.avatar_url,
      };

      // Update auth state
      const newAuthState = {
        isAuthenticated: true,
        user,
        token,
        loading: false,
        error: null,
      };

      setAuthState(newAuthState);
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(newAuthState));

      // Redirect to app
      navigate('/');
    } catch (error) {
      console.error('Authentication error:', error);
      setAuthState({
        isAuthenticated: false,
        user: null,
        token: null,
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to authenticate with GitHub',
      });
    }
  };

  const login = useCallback(() => {
    const scope = 'repo,user';
    const authUrl = `https://github.com/login/oauth/authorize?client_id=${CLIENT_ID}&redirect_uri=${REDIRECT_URI}&scope=${scope}`;
    window.location.href = authUrl;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    setAuthState({
      isAuthenticated: false,
      user: null,
      token: null,
      loading: false,
      error: null,
    });
    navigate('/login');
  }, [navigate]);

  const getOctokit = useCallback(() => {
    if (!authState.token) return null;
    return new Octokit({ auth: authState.token });
  }, [authState.token]);

  return (
    <AuthContext.Provider value={{ authState, login, logout, getOctokit }}>
      {children}
    </AuthContext.Provider>
  );
};