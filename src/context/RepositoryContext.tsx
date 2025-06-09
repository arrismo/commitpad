import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { Repository } from '../types';
import { Octokit } from '@octokit/rest';

interface RepositoryContextType {
  repositories: Repository[];
  selectedRepository: Repository | null;
  loading: boolean;
  error: string | null;
  fetchRepositories: () => Promise<void>;
  selectRepository: (repo: Repository) => void;
  createRepository: (name: string, isPrivate: boolean) => Promise<Repository | null>;
}

const RepositoryContext = createContext<RepositoryContextType | undefined>(undefined);

const SELECTED_REPO_KEY = 'commitpad_selected_repo';

export const RepositoryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { authState, getOctokit } = useAuth();
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [selectedRepository, setSelectedRepository] = useState<Repository | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Load selected repository from localStorage only after auth is fully loaded and authenticated
    if (!authState.loading && authState.isAuthenticated) {
      const storedRepo = localStorage.getItem(SELECTED_REPO_KEY);
      if (storedRepo) {
        try {
          setSelectedRepository(JSON.parse(storedRepo));
        } catch (e) {
          localStorage.removeItem(SELECTED_REPO_KEY);
        }
      }
    }
  }, [authState.loading, authState.isAuthenticated]);

  const fetchRepositories = useCallback(async () => {
    if (!authState.isAuthenticated) return;
    
    setLoading(true);
    setError(null);
    console.log('Fetching repositories...', authState);
    
    try {
      // First try using the GitHub token from Supabase auth
      if (authState.token) {
        console.log('Using token from auth state to fetch repos');
        const octokit = new Octokit({ auth: authState.token });
        
        const response = await octokit.repos.listForAuthenticatedUser({
          sort: 'updated',
          per_page: 100,
        });
        
        console.log('Repositories fetched:', response.data.length);
        setRepositories(response.data);
        return;
      }
      
      // Fallback to getOctokit
      const octokit = getOctokit();
      if (!octokit) {
        throw new Error('Not authenticated');
      }
      
      const response = await octokit.repos.listForAuthenticatedUser({
        sort: 'updated',
        per_page: 100,
      });
      
      console.log('Repositories fetched:', response.data.length);
      setRepositories(response.data);
    } catch (error) {
      console.error('Error fetching repositories:', error);
      setError('Failed to fetch repositories');
    } finally {
      console.log('Finished fetching repositories.');
      setLoading(false);
    }
  }, [authState.isAuthenticated, authState.token, getOctokit]);

  const selectRepository = useCallback((repo: Repository) => {
    setSelectedRepository(repo);
    localStorage.setItem(SELECTED_REPO_KEY, JSON.stringify(repo));
  }, []);

  const createRepository = useCallback(async (name: string, isPrivate: boolean): Promise<Repository | null> => {
    if (!authState.isAuthenticated) return null;
    
    setLoading(true);
    setError(null);
    
    try {
      const octokit = getOctokit();
      if (!octokit) {
        throw new Error('Not authenticated');
      }
      
      const response = await octokit.repos.createForAuthenticatedUser({
        name,
        private: isPrivate,
        auto_init: true, // Initialize with a README
        description: 'Notes repository created with CommitPad',
      });
      
      const newRepo = response.data;
      
      // Update repositories list
      setRepositories(prev => [newRepo, ...prev]);
      
      // Select the new repository
      selectRepository(newRepo);
      
      return newRepo;
    } catch (error) {
      console.error('Error creating repository:', error);
      setError('Failed to create repository');
      return null;
    } finally {
      setLoading(false);
    }
  }, [authState.isAuthenticated, getOctokit, selectRepository]);

  return (
    <RepositoryContext.Provider
      value={{
        repositories,
        selectedRepository,
        loading,
        error,
        fetchRepositories,
        selectRepository,
        createRepository,
      }}
    >
      {children}
    </RepositoryContext.Provider>
  );
};

export const useRepository = () => {
  const context = useContext(RepositoryContext);
  if (context === undefined) {
    throw new Error('useRepository must be used within a RepositoryProvider');
  }
  return context;
};