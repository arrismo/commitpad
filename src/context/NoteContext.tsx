import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { useRepository } from './RepositoryContext';
import { Note, NoteFile, SyncStatus, Folder, GitHubFile } from '../types';
import { createClient } from '@supabase/supabase-js';

interface NoteContextType {
  notes: Note[];
  folders: Folder[];
  currentNote: Note | null;
  syncStatus: SyncStatus;
  loading: boolean;
  error: string | null;
  fetchNotes: () => Promise<void>;
  createNote: (title: string, content: string, folder?: string) => Promise<Note | null>;
  updateNote: (id: string, content: string, folder?: string) => Promise<void>;
  deleteNote: (id: string) => Promise<void>;
  setCurrentNote: (note: Note | null) => void;
  syncNotes: () => Promise<void>;
  createFolder: (name: string) => Promise<Folder | null>;
  deleteFolder: (id: string) => Promise<void>;
}

const NoteContext = createContext<NoteContextType | undefined>(undefined);

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const NoteProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { authState, getOctokit } = useAuth();
  const { selectedRepository } = useRepository();
  
  const [notes, setNotes] = useState<Note[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [currentNote, setCurrentNote] = useState<Note | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('synced');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

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

  // Fetch notes from GitHub
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
      const noteFiles = Array.isArray(repoContent)
        ? repoContent.filter((item: NoteFile) => 
            item.type === 'file' && 
            (item.name.startsWith('note_') || item.name.endsWith('.md'))
          )
        : [];

      // Fetch content for each note file
      const notesPromises = noteFiles.map(async (file: NoteFile) => {
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
    } finally {
      setLoading(false);
    }
  };

  // Create a note in GitHub
  const createNote = async (title: string, content: string, folder?: string): Promise<Note | null> => {
    if (!authState.isAuthenticated || !selectedRepository) return null;
    
    setLoading(true);
    setError(null);
    
    try {
      const octokit = getOctokit();
      if (!octokit) {
        throw new Error('Not authenticated');
      }

      // Create a new note file
      const notePath = folder ? `${folder}/${title}.md` : `${title}.md`;
      const noteContent = `# ${title}\n\n${content}`;

      await octokit.repos.createOrUpdateFileContents({
        owner: selectedRepository.owner.login,
        repo: selectedRepository.name,
        path: notePath,
        message: `Create note: ${title}`,
        content: btoa(noteContent),
        branch: selectedRepository.default_branch
      });

      // Fetch the updated list of notes
      await fetchNotes();
      setSyncStatus(navigator.onLine ? 'synced' : 'offline');
      return notes.find(n => n.path === notePath) || null;
    } catch (error) {
      console.error('Error creating note:', error);
      setError('Failed to create note');
      return null;
    } finally {
      setLoading(false);
    }
  };

  // Update a note in GitHub
  const updateNote = async (id: string, content: string, folder?: string): Promise<void> => {
    if (!authState.isAuthenticated || !selectedRepository) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const note = notes.find(n => n.id === id);
      if (!note) return;

      const octokit = getOctokit();
      if (!octokit) {
        throw new Error('Not authenticated');
      }

      // Get the current note content
      const { data: currentContent } = await octokit.repos.getContent({
        owner: selectedRepository.owner.login,
        repo: selectedRepository.name,
        path: note.path,
      });

      // Update the note file
      const newContent = content;
      await octokit.repos.createOrUpdateFileContents({
        owner: selectedRepository.owner.login,
        repo: selectedRepository.name,
        path: note.path,
        message: `Update note: ${note.title}`,
        content: btoa(newContent),
        sha: currentContent.sha,
        branch: selectedRepository.default_branch
      });

      // Update local state
      const updatedNotes = notes.map(n => 
        n.id === id 
          ? { ...n, content: newContent, lastModified: new Date().toISOString() }
          : n
      );
      setNotes(updatedNotes);
      setSyncStatus(navigator.onLine ? 'synced' : 'offline');
    } catch (error) {
      console.error('Error updating note:', error);
      setError('Failed to update note');
    } finally {
      setLoading(false);
    }
  };

  // Delete a note in GitHub
  const deleteNote = async (id: string): Promise<void> => {
    if (!authState.isAuthenticated || !selectedRepository) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const note = notes.find(n => n.id === id);
      if (!note) return;

      const octokit = getOctokit();
      if (!octokit) {
        throw new Error('Not authenticated');
      }

      // Delete the note file
      const { data: currentContent } = await octokit.repos.getContent({
        owner: selectedRepository.owner.login,
        repo: selectedRepository.name,
        path: note.path,
      });

      await octokit.repos.deleteFile({
        owner: selectedRepository.owner.login,
        repo: selectedRepository.name,
        path: note.path,
        message: `Delete note: ${note.title}`,
        sha: currentContent.sha,
        branch: selectedRepository.default_branch
      });

      // Update local state
      setNotes(notes.filter(n => n.id !== id));
      setSyncStatus(navigator.onLine ? 'synced' : 'offline');

      // If this was the current note, clear it
      if (currentNote?.id === id) {
        setCurrentNote(null);
      }
    } catch (error) {
      console.error('Error deleting note:', error);
      setError('Failed to delete note');
    } finally {
      setLoading(false);
    }
  };

  // Create a folder in GitHub
  const createFolder = async (name: string): Promise<Folder | null> => {
    if (!authState.isAuthenticated || !selectedRepository) return null;
    
    setLoading(true);
    setError(null);
    
    try {
      const octokit = getOctokit();
      if (!octokit) {
        throw new Error('Not authenticated');
      }

      // Create a README.md file in the folder to create it
      const folderPath = name;
      const readmePath = `${folderPath}/README.md`;
      const readmeContent = `# ${name}\n\nThis folder contains notes.`;

      await octokit.repos.createOrUpdateFileContents({
        owner: selectedRepository.owner.login,
        repo: selectedRepository.name,
        path: readmePath,
        message: `Create folder: ${name}`,
        content: btoa(readmeContent),
        branch: selectedRepository.default_branch
      });

      // Update local state
      const newFolder: Folder = { 
        id: crypto.randomUUID(), 
        name, 
        path: folderPath,
        notes: []
      };
      setFolders([...folders, newFolder]);
      setSyncStatus(navigator.onLine ? 'synced' : 'offline');
      return newFolder;
    } catch (error) {
      console.error('Error creating folder:', error);
      setError('Failed to create folder');
      return null;
    } finally {
      setLoading(false);
    }
  };

  // Delete a folder in GitHub
  const deleteFolder = async (id: string): Promise<void> => {
    if (!authState.isAuthenticated || !selectedRepository) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const folder = folders.find(f => f.id === id);
      if (!folder) return;

      const octokit = getOctokit();
      if (!octokit) {
        throw new Error('Not authenticated');
      }

      // Get all files in the folder
      const { data: folderContent } = await octokit.repos.getContent({
        owner: selectedRepository.owner.login,
        repo: selectedRepository.name,
        path: folder.path,
      });

      // Delete each file in the folder
      if (Array.isArray(folderContent)) {
        for (const file of folderContent as NoteFile[]) {
          if (file.type === 'file') {
            await octokit.repos.deleteFile({
              owner: selectedRepository.owner.login,
              repo: selectedRepository.name,
              path: file.path,
              message: `Delete folder: ${folder.name}`,
              sha: file.sha,
              branch: selectedRepository.default_branch
            });
          }
        }
      }

      // Update local state
      setFolders(folders.filter(f => f.id !== id));
      setSyncStatus(navigator.onLine ? 'synced' : 'offline');

      // Delete any notes that were in this folder
      const notesInFolder = notes.filter(n => n.path.startsWith(folder.path));
      setNotes(notes.filter(n => !n.path.startsWith(folder.path)));
    } catch (error) {
      console.error('Error deleting folder:', error);
      setError('Failed to delete folder');
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

  // On mount, fetch notes and folders
  useEffect(() => {
    fetchNotes();
    // eslint-disable-next-line
  }, []);

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