import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { useRepository } from './RepositoryContext';
import { Note, NoteFile, SyncStatus } from '../types';

interface NoteContextType {
  notes: Note[];
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
}

const NoteContext = createContext<NoteContextType | undefined>(undefined);

// Prefix to identify CommitPad notes
const NOTE_PREFIX = 'note_';
const NOTES_STORAGE_KEY = 'commitpad_notes';
const CURRENT_NOTE_KEY = 'commitpad_current_note';

export const NoteProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { authState, getOctokit } = useAuth();
  const { selectedRepository } = useRepository();
  
  const [notes, setNotes] = useState<Note[]>([]);
  const [currentNote, setCurrentNote] = useState<Note | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('synced');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Load notes from localStorage on start
  useEffect(() => {
    const storedNotes = localStorage.getItem(NOTES_STORAGE_KEY);
    if (storedNotes) {
      try {
        setNotes(JSON.parse(storedNotes));
      } catch (e) {
        localStorage.removeItem(NOTES_STORAGE_KEY);
      }
    }
    
    const storedCurrentNote = localStorage.getItem(CURRENT_NOTE_KEY);
    if (storedCurrentNote) {
      try {
        setCurrentNote(JSON.parse(storedCurrentNote));
      } catch (e) {
        localStorage.removeItem(CURRENT_NOTE_KEY);
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
      localStorage.setItem(NOTES_STORAGE_KEY, JSON.stringify(notes));
    }
  }, [notes]);
  
  // Update localStorage when current note changes
  useEffect(() => {
    if (currentNote) {
      localStorage.setItem(CURRENT_NOTE_KEY, JSON.stringify(currentNote));
    } else {
      localStorage.removeItem(CURRENT_NOTE_KEY);
    }
  }, [currentNote]);

  const fetchNotes = async () => {
    if (!authState.isAuthenticated || !selectedRepository) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const octokit = getOctokit();
      if (!octokit) {
        throw new Error('Not authenticated');
      }
      
      // Fetch the tree of the repository
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
              (item.name.startsWith(NOTE_PREFIX) || item.name.endsWith('.md'))
            )
            .map(item => ({
              name: item.name,
              path: item.path,
              sha: item.sha,
              type: 'file'
            }))
        : [];
      
      // Fetch content for each note file
      const notesPromises = noteFiles.map(async file => {
        try {
          const response = await octokit.repos.getContent({
            owner: selectedRepository.owner.login,
            repo: selectedRepository.name,
            path: file.path,
          });
          
          // GitHub API returns content as base64 encoded
          const content = response.data.type === 'file' 
            ? atob(response.data.content.replace(/\s/g, ''))
            : '';
          
          // Extract title from first line or filename
          const title = content.split('\n')[0].replace(/^#\s+/, '') || 
            file.name.replace(/\.md$/, '').replace(NOTE_PREFIX, '');
          
          return {
            id: file.sha,
            title,
            content,
            path: file.path,
            lastModified: new Date().toISOString(),
            synced: true,
          };
        } catch (error) {
          console.error(`Error fetching note ${file.path}:`, error);
          return null;
        }
      });
      
      const fetchedNotes = (await Promise.all(notesPromises)).filter(Boolean) as Note[];
      
      // Merge with local notes (prefer newer versions and local unsynced notes)
      const mergedNotes = [...notes];
      
      fetchedNotes.forEach(fetchedNote => {
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
      console.error('Error fetching notes:', error);
      setError('Failed to fetch notes');
      setSyncStatus('offline');
    } finally {
      setLoading(false);
    }
  };

  const createNote = async (title: string, content: string): Promise<Note | null> => {
    if (!selectedRepository) return null;
    
    const timestamp = new Date().toISOString();
    const fileName = `${NOTE_PREFIX}${title.toLowerCase().replace(/\s+/g, '_')}.md`;
    const path = fileName;
    
    // Create note locally first
    const newNote: Note = {
      id: `local_${Date.now()}`,
      title,
      content,
      path,
      lastModified: timestamp,
      synced: false,
    };
    
    setNotes(prev => [...prev, newNote]);
    setCurrentNote(newNote);
    setSyncStatus('pending');
    
    // Try to sync with GitHub if we're online
    if (navigator.onLine && authState.isAuthenticated) {
      setLoading(true);
      
      try {
        const octokit = getOctokit();
        if (!octokit) throw new Error('Not authenticated');
        
        const response = await octokit.repos.createOrUpdateFileContents({
          owner: selectedRepository.owner.login,
          repo: selectedRepository.name,
          path,
          message: `Create note: ${title}`,
          content: btoa(content),
          branch: selectedRepository.default_branch,
        });
        
        // Update with data from GitHub
        const updatedNote: Note = {
          ...newNote,
          id: response.data.content?.sha || newNote.id,
          synced: true,
        };
        
        setNotes(prev => 
          prev.map(note => note.id === newNote.id ? updatedNote : note)
        );
        setCurrentNote(updatedNote);
        setSyncStatus('synced');
        
        return updatedNote;
      } catch (error) {
        console.error('Error creating note on GitHub:', error);
        setSyncStatus('offline');
        return newNote;
      } finally {
        setLoading(false);
      }
    }
    
    return newNote;
  };

  const updateNote = async (id: string, content: string): Promise<void> => {
    if (!selectedRepository) return;
    
    // Update locally first
    const noteToUpdate = notes.find(note => note.id === id);
    if (!noteToUpdate) return;
    
    const timestamp = new Date().toISOString();
    const updatedNote: Note = {
      ...noteToUpdate,
      content,
      lastModified: timestamp,
      synced: false,
    };
    
    setNotes(prev => 
      prev.map(note => note.id === id ? updatedNote : note)
    );
    
    if (currentNote?.id === id) {
      setCurrentNote(updatedNote);
    }
    
    setSyncStatus('pending');
    
    // Try to sync with GitHub if we're online
    if (navigator.onLine && authState.isAuthenticated) {
      setLoading(true);
      
      try {
        const octokit = getOctokit();
        if (!octokit) throw new Error('Not authenticated');
        
        // Get the file's SHA
        const { data: fileData } = await octokit.repos.getContent({
          owner: selectedRepository.owner.login,
          repo: selectedRepository.name,
          path: noteToUpdate.path,
        });
        
        const fileSha = 'sha' in fileData ? fileData.sha : '';
        
        // Update the file
        const response = await octokit.repos.createOrUpdateFileContents({
          owner: selectedRepository.owner.login,
          repo: selectedRepository.name,
          path: noteToUpdate.path,
          message: `Update note: ${noteToUpdate.title}`,
          content: btoa(content),
          sha: fileSha,
          branch: selectedRepository.default_branch,
        });
        
        // Update with data from GitHub
        const syncedNote: Note = {
          ...updatedNote,
          id: response.data.content?.sha || updatedNote.id,
          synced: true,
        };
        
        setNotes(prev => 
          prev.map(note => note.id === id ? syncedNote : note)
        );
        
        if (currentNote?.id === id) {
          setCurrentNote(syncedNote);
        }
        
        setSyncStatus('synced');
      } catch (error) {
        console.error('Error updating note on GitHub:', error);
        setSyncStatus('offline');
      } finally {
        setLoading(false);
      }
    }
  };

  const deleteNote = async (id: string): Promise<void> => {
    const noteToDelete = notes.find(note => note.id === id);
    if (!noteToDelete) return;
    
    // Remove locally first
    setNotes(prev => prev.filter(note => note.id !== id));
    
    if (currentNote?.id === id) {
      setCurrentNote(null);
    }
    
    // Delete from GitHub if we're online
    if (navigator.onLine && authState.isAuthenticated && selectedRepository) {
      setLoading(true);
      
      try {
        const octokit = getOctokit();
        if (!octokit) throw new Error('Not authenticated');
        
        // Get the file's SHA
        const { data: fileData } = await octokit.repos.getContent({
          owner: selectedRepository.owner.login,
          repo: selectedRepository.name,
          path: noteToDelete.path,
        });
        
        const fileSha = 'sha' in fileData ? fileData.sha : '';
        
        // Delete the file
        await octokit.repos.deleteFile({
          owner: selectedRepository.owner.login,
          repo: selectedRepository.name,
          path: noteToDelete.path,
          message: `Delete note: ${noteToDelete.title}`,
          sha: fileSha,
          branch: selectedRepository.default_branch,
        });
        
        setSyncStatus('synced');
      } catch (error) {
        console.error('Error deleting note from GitHub:', error);
        setSyncStatus('offline');
      } finally {
        setLoading(false);
      }
    }
  };

  const syncNotes = async (): Promise<void> => {
    if (!authState.isAuthenticated || !selectedRepository || !navigator.onLine) {
      return;
    }
    
    setLoading(true);
    
    try {
      const octokit = getOctokit();
      if (!octokit) throw new Error('Not authenticated');
      
      // Find unsynced notes
      const unsyncedNotes = notes.filter(note => !note.synced);
      
      // Sync each unsynced note
      for (const note of unsyncedNotes) {
        try {
          // Check if the file exists to get its SHA
          let fileSha = '';
          try {
            const { data: fileData } = await octokit.repos.getContent({
              owner: selectedRepository.owner.login,
              repo: selectedRepository.name,
              path: note.path,
            });
            
            fileSha = 'sha' in fileData ? fileData.sha : '';
          } catch (e) {
            // File doesn't exist, which is fine for new notes
          }
          
          // Create or update the file
          const response = await octokit.repos.createOrUpdateFileContents({
            owner: selectedRepository.owner.login,
            repo: selectedRepository.name,
            path: note.path,
            message: `Update note: ${note.title}`,
            content: btoa(note.content),
            sha: fileSha || undefined,
            branch: selectedRepository.default_branch,
          });
          
          // Update the note with the new SHA and mark as synced
          const syncedNote: Note = {
            ...note,
            id: response.data.content?.sha || note.id,
            synced: true,
          };
          
          setNotes(prev => 
            prev.map(n => n.id === note.id ? syncedNote : n)
          );
          
          if (currentNote?.id === note.id) {
            setCurrentNote(syncedNote);
          }
        } catch (error) {
          console.error(`Error syncing note ${note.title}:`, error);
          setSyncStatus('offline');
          return;
        }
      }
      
      setSyncStatus('synced');
    } catch (error) {
      console.error('Error syncing notes:', error);
      setSyncStatus('offline');
    } finally {
      setLoading(false);
    }
  };

  return (
    <NoteContext.Provider
      value={{
        notes,
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
      }}
    >
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