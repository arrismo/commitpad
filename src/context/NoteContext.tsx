import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { useRepository } from './RepositoryContext';
import { Note, NoteFile, SyncStatus, Folder } from '../types';

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

  useEffect(() => {
    // Load notes and folders from localStorage on start
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

  // Helper: Encode content to base64 for GitHub API
  const encodeBase64 = (str: string) => {
    if (typeof window !== 'undefined' && window.btoa) return window.btoa(str);
    return Buffer.from(str, 'utf-8').toString('base64');
  };

  // Fetch notes from GitHub repo
  const fetchNotes = async () => {
    if (!authState.isAuthenticated || !selectedRepository) {
      setNotes([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const octokit = getOctokit();
      if (!octokit) throw new Error('Not authenticated');
      // Get repo content (root)
      const { data: repoContent } = await octokit.repos.getContent({
        owner: selectedRepository.owner.login,
        repo: selectedRepository.name,
        path: '',
      });
      // Filter for markdown files
      const noteFiles = Array.isArray(repoContent)
        ? repoContent.filter(item => item.type === 'file' && (item.name.startsWith('note_') || item.name.endsWith('.md')))
        : [];
      // Fetch each note file's content
      const notesData = await Promise.all(
        noteFiles.map(async file => {
          try {
            const { data } = await octokit.repos.getContent({
              owner: selectedRepository.owner.login,
              repo: selectedRepository.name,
              path: file.path,
            });
            const content = (data as any).content ? atob((data as any).content.replace(/\s/g, '')) : '';
            const title = content.split('\n')[0].replace(/^#\s+/, '') || file.name.replace(/\.md$/, '').replace('note_', '');
            return {
              id: file.sha,
              title,
              content,
              path: file.path,
              lastModified: file.sha, // GitHub doesn't provide lastModified easily
              synced: true,
            } as Note;
          } catch {
            return null;
          }
        })
      );
      setNotes(notesData.filter(Boolean) as Note[]);
      setSyncStatus(navigator.onLine ? 'synced' : 'offline');
    } catch (error) {
      setError('Failed to fetch notes from GitHub');
      setNotes([]);
    } finally {
      setLoading(false);
    }
  };

  // Create a new note in GitHub repo
  const createNote = async (title: string, content: string): Promise<Note | null> => {
    if (!authState.isAuthenticated || !selectedRepository) return null;
    setLoading(true);
    setError(null);
    try {
      const octokit = getOctokit();
      if (!octokit) throw new Error('Not authenticated');
      const filename = `note_${Date.now()}.md`;
      const fullContent = `# ${title}\n${content}`;
      await octokit.repos.createOrUpdateFileContents({
        owner: selectedRepository.owner.login,
        repo: selectedRepository.name,
        path: filename,
        message: `Create note: ${title}`,
        content: encodeBase64(fullContent),
      });
      await fetchNotes();
      return notes.find(n => n.title === title) || null;
    } catch (error) {
      setError('Failed to create note in GitHub');
      return null;
    } finally {
      setLoading(false);
    }
  };

  // Update a note in GitHub repo
  const updateNote = async (id: string, content: string): Promise<void> => {
    if (!authState.isAuthenticated || !selectedRepository) return;
    setLoading(true);
    setError(null);
    try {
      const octokit = getOctokit();
      if (!octokit) throw new Error('Not authenticated');
      const note = notes.find(n => n.id === id);
      if (!note) throw new Error('Note not found');
      // Get file SHA
      const { data } = await octokit.repos.getContent({
        owner: selectedRepository.owner.login,
        repo: selectedRepository.name,
        path: note.path,
      });
      const sha = (data as any).sha;
      const fullContent = `# ${note.title}\n${content}`;
      await octokit.repos.createOrUpdateFileContents({
        owner: selectedRepository.owner.login,
        repo: selectedRepository.name,
        path: note.path,
        message: `Update note: ${note.title}`,
        content: encodeBase64(fullContent),
        sha,
      });
      await fetchNotes();
    } catch (error) {
      setError('Failed to update note in GitHub');
    } finally {
      setLoading(false);
    }
  };

  // Delete a note in GitHub repo
  const deleteNote = async (id: string): Promise<void> => {
    if (!authState.isAuthenticated || !selectedRepository) return;
    setLoading(true);
    setError(null);
    try {
      const octokit = getOctokit();
      if (!octokit) throw new Error('Not authenticated');
      const note = notes.find(n => n.id === id);
      if (!note) throw new Error('Note not found');
      // Get file SHA
      const { data } = await octokit.repos.getContent({
        owner: selectedRepository.owner.login,
        repo: selectedRepository.name,
        path: note.path,
      });
      const sha = (data as any).sha;
      await octokit.repos.deleteFile({
        owner: selectedRepository.owner.login,
        repo: selectedRepository.name,
        path: note.path,
        message: `Delete note: ${note.title}`,
        sha,
      });
      await fetchNotes();
    } catch (error) {
      setError('Failed to delete note in GitHub');
    } finally {
      setLoading(false);
    }
  };

  // Fetch folders from GitHub repo (directories)
  const fetchFolders = async () => {
    if (!authState.isAuthenticated || !selectedRepository) {
      setFolders([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const octokit = getOctokit();
      if (!octokit) throw new Error('Not authenticated');
      const { data: repoContent } = await octokit.repos.getContent({
        owner: selectedRepository.owner.login,
        repo: selectedRepository.name,
        path: '',
      });
      const folderDirs = Array.isArray(repoContent)
        ? repoContent.filter(item => item.type === 'dir')
        : [];
      setFolders(folderDirs.map(dir => ({
        id: dir.sha,
        name: dir.name,
        path: dir.path,
        lastModified: dir.sha,
      })) as Folder[]);
    } catch (error) {
      setError('Failed to fetch folders from GitHub');
      setFolders([]);
    } finally {
      setLoading(false);
    }
  };

  // Create a new folder in GitHub repo
  const createFolder = async (name: string): Promise<Folder | null> => {
    if (!authState.isAuthenticated || !selectedRepository) return null;
    setLoading(true);
    setError(null);
    try {
      const octokit = getOctokit();
      if (!octokit) throw new Error('Not authenticated');
      // GitHub doesn't have a direct API to create folders; create a .gitkeep file
      const folderPath = `${name}/.gitkeep`;
      await octokit.repos.createOrUpdateFileContents({
        owner: selectedRepository.owner.login,
        repo: selectedRepository.name,
        path: folderPath,
        message: `Create folder: ${name}`,
        content: encodeBase64(''),
      });
      await fetchFolders();
      return folders.find(f => f.name === name) || null;
    } catch (error) {
      setError('Failed to create folder in GitHub');
      return null;
    } finally {
      setLoading(false);
    }
  };

  // Delete a folder in GitHub repo (delete all files in it)
  const deleteFolder = async (id: string): Promise<void> => {
    if (!authState.isAuthenticated || !selectedRepository) return;
    setLoading(true);
    setError(null);
    try {
      const octokit = getOctokit();
      if (!octokit) throw new Error('Not authenticated');
      const folder = folders.find(f => f.id === id);
      if (!folder) throw new Error('Folder not found');
      // List files in folder
      const { data: folderContent } = await octokit.repos.getContent({
        owner: selectedRepository.owner.login,
        repo: selectedRepository.name,
        path: folder.path,
      });
      const files = Array.isArray(folderContent) ? folderContent : [];
      // Delete each file
      for (const file of files) {
        if (file.type === 'file') {
          const { data } = await octokit.repos.getContent({
            owner: selectedRepository.owner.login,
            repo: selectedRepository.name,
            path: file.path,
          });
          const sha = (data as any).sha;
          await octokit.repos.deleteFile({
            owner: selectedRepository.owner.login,
            repo: selectedRepository.name,
            path: file.path,
            message: `Delete file in folder: ${folder.name}`,
            sha,
          });
        }
      }
      await fetchFolders();
    } catch (error) {
      setError('Failed to delete folder in GitHub');
    } finally {
      setLoading(false);
    }
  };

  // Only call fetchNotes/fetchFolders when authState and selectedRepository are set
  useEffect(() => {
    if (authState.isAuthenticated && selectedRepository) {
      fetchNotes();
      fetchFolders();
    }
  }, [authState.isAuthenticated, selectedRepository]);

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