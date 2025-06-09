import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { Repository } from '../types/index';
import { Octokit } from '@octokit/rest';
import { supabase } from '../supabaseClient';

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

// No longer need localStorage key as we'll use Supabase

export const RepositoryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { authState, getOctokit } = useAuth();
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [selectedRepository, setSelectedRepository] = useState<Repository | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Load selected repository from Supabase
    const loadSelectedRepository = async () => {
      if (!authState.isAuthenticated || !authState.user) return;
      
      try {
        // Query for the selected repository
        const { data, error } = await supabase
          .from('repositories')
          .select('*')
          .eq('user_id', authState.user.id)
          .eq('selected', true)
          .single();
        
        if (error) {
          console.error('Error fetching selected repository:', error);
          return;
        }
        
        if (data) {
          // Convert Supabase repository to GitHub repository format
          const repo = {
            id: data.github_id,
            name: data.name,
            full_name: data.full_name,
            owner: {
              login: data.owner_login
            },
            private: data.private,
            default_branch: 'main' // Add required property
          } as Repository;
          
          setSelectedRepository(repo);
        }
      } catch (e) {
        console.error('Error loading selected repository:', e);
      }
    };
    
    loadSelectedRepository();
  }, [authState.isAuthenticated, authState.user]);

  const fetchRepositories = useCallback(async () => {
    if (!authState.isAuthenticated || !authState.user) return;
    
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
        
        // Sync repositories with Supabase
        await syncRepositoriesToSupabase(response.data);
        
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
      
      // Sync repositories with Supabase
      await syncRepositoriesToSupabase(response.data);
    } catch (error) {
      console.error('Error fetching repositories:', error);
      setError('Failed to fetch repositories');
    } finally {
      console.log('Finished fetching repositories.');
      setLoading(false);
    }
  }, [authState.isAuthenticated, authState.token, authState.user, getOctokit]);

  const selectRepository = useCallback(async (repo: Repository) => {
    setSelectedRepository(repo);
    
    if (!authState.isAuthenticated || !authState.user) return;
    
    try {
      // First, update all repositories to not be selected
      await supabase
        .from('repositories')
        .update({ selected: false })
        .eq('user_id', authState.user.id);
      
      // Then, find the repository in Supabase and mark it as selected
      const { data, error } = await supabase
        .from('repositories')
        .select('id')
        .eq('user_id', authState.user.id)
        .eq('github_id', repo.id)
        .single();
      
      if (error) {
        // Repository doesn't exist in Supabase yet, create it
        await supabase.from('repositories').insert({
          user_id: authState.user.id,
          github_id: repo.id,
          name: repo.name,
          full_name: repo.full_name,
          owner_login: repo.owner.login,
          private: repo.private,
          description: (repo as any).description || '',
          selected: true
        });
      } else if (data) {
        // Update existing repository to be selected
        await supabase
          .from('repositories')
          .update({ selected: true })
          .eq('id', data.id);
      }
    } catch (e) {
      console.error('Error saving selected repository to Supabase:', e);
    }
  }, [authState.isAuthenticated, authState.user]);

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

  // Helper function to sync GitHub repositories to Supabase
  const syncRepositoriesToSupabase = async (githubRepos: Repository[]) => {
    if (!authState.user) return;
    
    try {
      // Get existing repositories from Supabase
      const { data: existingRepos, error } = await supabase
        .from('repositories')
        .select('github_id, selected')
        .eq('user_id', authState.user.id);
      
      if (error) {
        console.error('Error fetching existing repositories from Supabase:', error);
        return;
      }
      
      // Create a map of existing repository IDs and their selected status
      const existingRepoMap = new Map();
      existingRepos?.forEach(repo => {
        existingRepoMap.set(repo.github_id, repo.selected);
      });
      
      // Prepare repositories to upsert
      const reposToUpsert = githubRepos.map(repo => ({
        user_id: authState.user!.id,
        github_id: repo.id,
        name: repo.name,
        full_name: repo.full_name,
        owner_login: repo.owner.login,
        private: repo.private,
        description: (repo as any).description || '',
        // Preserve selected status if it exists
        selected: existingRepoMap.has(repo.id) ? existingRepoMap.get(repo.id) : false
      }));
      
      // Upsert repositories to Supabase
      const { error: upsertError } = await supabase
        .from('repositories')
        .upsert(reposToUpsert, { onConflict: 'user_id, github_id' });
      
      if (upsertError) {
        console.error('Error upserting repositories to Supabase:', upsertError);
      }
    } catch (e) {
      console.error('Error syncing repositories to Supabase:', e);
    }
  };
  
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