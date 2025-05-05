import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Octokit } from '@octokit/rest';
import { AuthState, User } from '../types';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';

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
// SECURITY RISK: Never store client secrets in frontend code
// const CLIENT_SECRET = 'ba02cd6b5f0bd8667e79a6d49a2e43eb88aa2e8b';
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

    // Check for Supabase auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Supabase auth event:', event);
        
        if (event === 'SIGNED_IN' && session) {
          console.log('User signed in via Supabase');
          
          // Get user info from session
          const user: User = {
            id: Number(session.user.id),
            login: session.user.user_metadata.user_name || session.user.email || '',
            name: session.user.user_metadata.full_name || '',
            avatar_url: session.user.user_metadata.avatar_url || '',
          };
          
          // Get GitHub token from session
          const token = session.provider_token;
          
          if (!token) {
            console.error('No GitHub token found in session');
            setAuthState({
              isAuthenticated: false,
              user: null,
              token: null,
              loading: false,
              error: 'Failed to get GitHub token',
            });
            return;
          }
          
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
          
          // Redirect to app if on login page
          if (window.location.pathname.includes('/auth')) {
            navigate('/');
          }
        } else if (event === 'SIGNED_OUT') {
          console.log('User signed out via Supabase');
          localStorage.removeItem(AUTH_STORAGE_KEY);
          setAuthState({
            isAuthenticated: false,
            user: null,
            token: null,
            loading: false,
            error: null,
          });
        }
      }
    );
    
    // Cleanup subscription
    return () => {
      subscription.unsubscribe();
    };
  }, [navigate]);

  const login = useCallback(() => {
    // Use Supabase's signInWithOAuth with only redirectTo
    supabase.auth.signInWithOAuth({
      provider: 'github',
      options: {
        redirectTo: window.location.origin + '/auth/callback',
        scopes: 'repo user',
      },
    });
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