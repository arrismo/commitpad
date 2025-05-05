import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { useRepository } from './RepositoryContext';
import { Note, NoteFile, SyncStatus, Folder } from '../types';
import { supabase } from '../supabaseClient';

interface NoteContextType {
  notes: Note[];
  folders: Folder[];
  currentNote: Note | null;
  syncStatus: SyncStatus;
  loading: boolean;
  error: string | null;
  fetchNotes: () => Promise<void>;
  createNote: (title: string, content: string) => Promise<Note | null>;
  updateNote: (id: string, content: string) => Promise<void>;
  deleteNote: (id: string) => Promise<void>;
  setCurrentNote: (note: Note | null) => void;
  syncNotes: () => Promise<void>;
  createFolder: (name: string) => Promise<Folder | null>;
  deleteFolder: (id: string) => Promise<void>;
}

const NoteContext = createContext<NoteContextType | undefined>(undefined);

export const NoteProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { authState, getOctokit } = useAuth();
  const { selectedRepository } = useRepository();
  
  const [notes, setNotes] = useState<Note[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [currentNote, setCurrentNote] = useState<Note | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('synced');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    // Listen for auth changes to update userId
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('NoteContext auth event:', event);
      if (session?.user) {
        console.log('Setting userId from session:', session.user.id);
        setUserId(session.user.id);
      } else {
        setUserId(null);
      }
    });

    // Also get current user on initial load
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        console.log('Setting userId from initial session:', session.user.id);
        setUserId(session.user.id);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Load notes and folders from localStorage on start
  useEffect(() => {
    const storedNotes = localStorage.getItem('commitpad_notes');
    if (storedNotes) {
      try {
        setNotes(JSON.parse(storedNotes));
      } catch (e) {
        localStorage.removeItem('commitpad_notes');
      }
    }
    
    const storedFolders = localStorage.getItem('commitpad_folders');
    if (storedFolders) {
      try {
        setFolders(JSON.parse(storedFolders));
      } catch (e) {
        localStorage.removeItem('commitpad_folders');
      }
    }
    
    const storedCurrentNote = localStorage.getItem('commitpad_current_note');
    if (storedCurrentNote) {
      try {
        setCurrentNote(JSON.parse(storedCurrentNote));
      } catch (e) {
        localStorage.removeItem('commitpad_current_note');
      }
    }
    
    // Check if we're online
    const updateOnlineStatus = () => {
      setSyncStatus(navigator.onLine ? 'synced' : 'offline');
    };
    
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
    
    return () => {
      window.removeEventListener('online', updateOnlineStatus);
      window.removeEventListener('offline', updateOnlineStatus);
    };
  }, []);

  // Update localStorage when notes change
  useEffect(() => {
    if (notes.length > 0) {
      localStorage.setItem('commitpad_notes', JSON.stringify(notes));
    }
  }, [notes]);
  
  // Update localStorage when folders change
  useEffect(() => {
    if (folders.length > 0) {
      localStorage.setItem('commitpad_folders', JSON.stringify(folders));
    }
  }, [folders]);
  
  // Update localStorage when current note changes
  useEffect(() => {
    if (currentNote) {
      localStorage.setItem('commitpad_current_note', JSON.stringify(currentNote));
    } else {
      localStorage.removeItem('commitpad_current_note');
    }
  }, [currentNote]);

  // Fetch notes from Supabase (guarded by userId)
  const fetchNotes = async () => {
    if (!userId || !selectedRepository) {
      console.log('Skipping fetchNotes - missing userId or selectedRepository', { userId, selectedRepository });
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      console.log('Fetching notes for repository:', selectedRepository.id);
      
      // Get current session to ensure we have fresh auth
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        console.error('No active session found when fetching notes');
        throw new Error('Authentication required');
      }
      
      const { data, error } = await supabase
        .from('notes')
        .select('*')
        .eq('repository_id', selectedRepository.id)
        .eq('user_id', userId);
        
      if (error) {
        console.error('Error fetching notes:', error);
        throw error;
      }
      
      console.log('Notes fetched successfully:', data?.length || 0);
      setNotes(data || []);
      setSyncStatus(navigator.onLine ? 'synced' : 'offline');
    } catch (error) {
      console.error('Failed to fetch notes:', error);
      setError('Failed to fetch notes from Supabase');
    } finally {
      setLoading(false);
    }
  };

  // Fetch folders from Supabase (guarded by userId)
  const fetchFolders = async () => {
    if (!userId || !selectedRepository) {
      console.log('Skipping fetchFolders - missing userId or selectedRepository', { userId, selectedRepository });
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      console.log('Fetching folders for repository:', selectedRepository.id);
      
      // Get current session to ensure we have fresh auth
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        console.error('No active session found when fetching folders');
        throw new Error('Authentication required');
      }
      
      const { data, error } = await supabase
        .from('folders')
        .select('*')
        .eq('repository_id', selectedRepository.id)
        .eq('user_id', userId);
        
      if (error) {
        console.error('Error fetching folders:', error);
        throw error;
      }
      
      console.log('Folders fetched successfully:', data?.length || 0);
      setFolders(data || []);
    } catch (error) {
      console.error('Failed to fetch folders:', error);
      setError('Failed to fetch folders from Supabase');
    } finally {
      setLoading(false);
    }
  };

  // Only call fetchNotes/fetchFolders when userId and selectedRepository are set
  useEffect(() => {
    if (userId && selectedRepository) {
      fetchNotes();
      fetchFolders();
    }
  }, [userId, selectedRepository]);

  // Create a note in Supabase
  const createNote = async (title: string, content: string): Promise<Note | null> => {
    if (!selectedRepository || !userId) return null;
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from('notes')
        .insert([
          {
            repository_id: selectedRepository.id,
            user_id: userId,
            title,
            content,
            last_modified: new Date().toISOString(),
            synced: false
          }
        ])
        .single();
      if (error) throw error;
      await fetchNotes();
      return data;
    } catch (error) {
      setError('Failed to create note in Supabase');
      return null;
    } finally {
      setLoading(false);
    }
  };

  // Update a note in Supabase
  const updateNote = async (id: string, content: string): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const { error } = await supabase
        .from('notes')
        .update({ content, last_modified: new Date().toISOString(), synced: false })
        .eq('id', id);
      if (error) throw error;
      await fetchNotes();
    } catch (error) {
      setError('Failed to update note in Supabase');
    } finally {
      setLoading(false);
    }
  };

  // Delete a note in Supabase
  const deleteNote = async (id: string): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const { error } = await supabase
        .from('notes')
        .delete()
        .eq('id', id);
      if (error) throw error;
      await fetchNotes();
    } catch (error) {
      setError('Failed to delete note in Supabase');
    } finally {
      setLoading(false);
    }
  };

  // Create a folder in Supabase
  const createFolder = async (name: string): Promise<Folder | null> => {
    if (!selectedRepository || !userId) return null;
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from('folders')
        .insert([
          {
            repository_id: selectedRepository.id,
            user_id: userId,
            name,
            last_modified: new Date().toISOString(),
          }
        ])
        .single();
      if (error) throw error;
      await fetchFolders();
      return data;
    } catch (error) {
      setError('Failed to create folder in Supabase');
      return null;
    } finally {
      setLoading(false);
    }
  };

  // Delete a folder in Supabase
  const deleteFolder = async (id: string): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const { error } = await supabase
        .from('folders')
        .delete()
        .eq('id', id);
      if (error) throw error;
      await fetchFolders();
    } catch (error) {
      setError('Failed to delete folder in Supabase');
    } finally {
      setLoading(false);
    }
  };

  // Sync notes with GitHub
  const syncNotes = async (): Promise<void> => {
    if (!authState.isAuthenticated || !selectedRepository) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const octokit = getOctokit();
      if (!octokit) {
        throw new Error('Not authenticated');
      }

      // Fetch all notes from the repository
      const { data: repoContent } = await octokit.repos.getContent({
        owner: selectedRepository.owner.login,
        repo: selectedRepository.name,
        path: '',
      });

      // Filter for markdown files
      const noteFiles: NoteFile[] = Array.isArray(repoContent)
        ? repoContent
            .filter(item => 
              item.type === 'file' && 
              (item.name.startsWith('note_') || item.name.endsWith('.md'))
            )
            .map(item => ({
              name: item.name,
              path: item.path,
              sha: item.sha,
              type: 'file'
            }))
        : [];

      // Fetch content for each note file
      const notesPromises = noteFiles.map(async (file: { 
        type: string; 
        name: string; 
        path: string; 
        sha: string; 
      }) => {
        try {
          const response = await octokit.repos.getContent({
            owner: selectedRepository.owner.login,
            repo: selectedRepository.name,
            path: file.path,
          });

          // GitHub API returns content as base64 encoded
          const content = (response.data as any).content ? atob((response.data as any).content.replace(/\s/g, '')) : '';

          // Extract title from first line or filename
          const title = content.split('\n')[0].replace(/^#\s+/, '') || 
            file.name.replace(/\.md$/, '').replace('note_', '');

          return {
            id: file.sha,
            title,
            content,
            path: file.path,
            lastModified: new Date().toISOString(),
            synced: true,
          } as Note;
        } catch (error) {
          console.error(`Error fetching note ${file.path}:`, error);
          return null;
        }
      });

      const fetchedNotes = (await Promise.all(notesPromises)).filter(Boolean) as Note[];

      // Merge with local notes
      const mergedNotes = [...notes];
      
      fetchedNotes.forEach((fetchedNote: Note) => {
        const localNoteIndex = mergedNotes.findIndex(n => n.path === fetchedNote.path);
        if (localNoteIndex >= 0) {
          // If local note is unsynced, keep it, otherwise use the fetched one
          if (!mergedNotes[localNoteIndex].synced) {
            // Keep local note but mark as conflicted if content differs
            if (mergedNotes[localNoteIndex].content !== fetchedNote.content) {
              setSyncStatus('conflicted');
            }
          } else {
            mergedNotes[localNoteIndex] = fetchedNote;
          }
        } else {
          mergedNotes.push(fetchedNote);
        }
      });

      setNotes(mergedNotes);
      setSyncStatus(navigator.onLine ? 'synced' : 'offline');
    } catch (error) {
      console.error('Error syncing notes:', error);
      setError('Failed to sync notes');
    } finally {
      setLoading(false);
    }
  };

  return (
    <NoteContext.Provider value={{
      notes,
      folders,
      currentNote,
      syncStatus,
      loading,
      error,
      fetchNotes,
      createNote,
      updateNote,
      deleteNote,
      setCurrentNote,
      syncNotes,
      createFolder,
      deleteFolder
    }}>
      {children}
    </NoteContext.Provider>
  );
};

export const useNotes = () => {
  const context = useContext(NoteContext);
  if (context === undefined) {
    throw new Error('useNotes must be used within a NoteProvider');
  }
  return context;
};