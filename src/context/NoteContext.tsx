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
  createNote: (title: string, content: string, folder?: string) => Promise<Note | null>;
  updateNote: (id: string, content: string, folder?: string) => Promise<void>;
  deleteNote: (id: string) => Promise<void>;
  setCurrentNote: (note: Note | null) => void;
  syncNotes: () => Promise<void>;
  createFolder: (name: string) => Promise<Folder | null>;
  deleteFolder: (id: string) => Promise<void>;
}

const NoteContext = createContext<NoteContextType | undefined>(undefined);

// Prefix to identify CommitPad notes
const NOTE_PREFIX = 'note_';
const NOTES_STORAGE_KEY = 'commitpad_notes';
const CURRENT_NOTE_KEY = 'commitpad_current_note';
const FOLDERS_STORAGE_KEY = 'commitpad_folders';

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
    const storedNotes = localStorage.getItem(NOTES_STORAGE_KEY);
    if (storedNotes) {
      try {
        setNotes(JSON.parse(storedNotes));
      } catch (e) {
        localStorage.removeItem(NOTES_STORAGE_KEY);
      }
    }
    
    const storedFolders = localStorage.getItem(FOLDERS_STORAGE_KEY);
    if (storedFolders) {
      try {
        setFolders(JSON.parse(storedFolders));
      } catch (e) {
        localStorage.removeItem(FOLDERS_STORAGE_KEY);
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
  
  // Update localStorage when folders change
  useEffect(() => {
    if (folders.length > 0) {
      localStorage.setItem(FOLDERS_STORAGE_KEY, JSON.stringify(folders));
    }
  }, [folders]);
  
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
      if (!octokit) throw new Error('Not authenticated');

      // Recursively get all files except README.md
      const getFilesRecursively = async (path = ''): Promise<any[]> => {
        const { data } = await octokit.repos.getContent({
          owner: selectedRepository.owner.login,
          repo: selectedRepository.name,
          path,
        });

        let files: any[] = [];
        for (const item of Array.isArray(data) ? data : [data]) {
          if (item.type === 'dir') {
            files = files.concat(await getFilesRecursively(item.path));
          } else if (
            item.type === 'file' &&
            item.name.toLowerCase().endsWith('.md') &&
            item.name.toLowerCase() !== 'readme.md'
          ) {
            files.push(item);
          }
        }
        return files;
      };

      const files = await getFilesRecursively();

      // Convert files to notes
      const fetchedNotes = await Promise.all(
        files.map(async (file: any) => {
          const { data: fileData } = await octokit.repos.getContent({
            owner: selectedRepository.owner.login,
            repo: selectedRepository.name,
            path: file.path,
          });
          const content = atob((fileData as any).content || '');
          return {
            id: file.sha,
            title: file.name.replace(/\.md$/, ''),
            content,
            path: file.path,
            lastModified: file.sha, // Could use commit date if needed
            synced: true,
            folder: file.path.includes('/') ? file.path.split('/')[0] : '',
          };
        })
      );

      // Merge with local unsynced notes
      setNotes(prevNotes => [
        ...fetchedNotes,
        ...prevNotes.filter(note => !note.synced),
      ]);
      setSyncStatus('synced');
    } catch (error) {
      console.error('Error fetching notes:', error);
      setError('Failed to fetch notes');
      setSyncStatus('offline');
    } finally {
      setLoading(false);
    }
  };

  const createNote = async (title: string, content: string, folder: string = ''): Promise<Note | null> => {
    if (!selectedRepository) return null;
    
    const timestamp = new Date().toISOString();
    let path = `${NOTE_PREFIX}${title.toLowerCase().replace(/\s+/g, '_')}.md`;
    
    // Add folder prefix to path if folder is specified
    if (folder) {
      path = `${folder}/${path}`;
    }
    
    // Create note locally first
    const newNote: Note = {
      id: `local_${Date.now()}`,
      title,
      content,
      path,
      lastModified: timestamp,
      synced: false,
      folder
    };
    
    setNotes(prev => [...prev, newNote]);
    setCurrentNote(newNote);
    setSyncStatus('pending');
    
    // If the note is in a folder, add it to the folder's notes
    if (folder) {
      const folderObj = folders.find(f => f.name === folder);
      if (folderObj) {
        setFolders(prev => prev.map(f => 
          f.id === folderObj.id 
            ? { ...f, notes: [...f.notes, newNote.id] }
            : f
        ));
      }
    }
    
    // Try to sync with GitHub if we're online
    if (navigator.onLine && authState.isAuthenticated) {
      setLoading(true);
      
      try {
        const octokit = getOctokit();
        if (!octokit) throw new Error('Not authenticated');
        
        // Create folder if it doesn't exist
        if (folder) {
          try {
            await octokit.repos.getContent({
              owner: selectedRepository.owner.login,
              repo: selectedRepository.name,
              path: folder,
            });
          } catch (error) {
            // Folder doesn't exist, create it
            await octokit.repos.createOrUpdateFileContents({
              owner: selectedRepository.owner.login,
              repo: selectedRepository.name,
              path: `${folder}/.gitkeep`,
              message: `Create folder: ${folder}`,
              content: btoa(''),
              branch: selectedRepository.default_branch,
            });
          }
        }
        
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

  const updateNote = async (id: string, content: string, folder?: string): Promise<void> => {
    if (!selectedRepository) return;
    
    // Update locally first
    const noteToUpdate = notes.find(note => note.id === id);
    if (!noteToUpdate) return;
    
    const timestamp = new Date().toISOString();
    
    // If folder is changing, update the path
    let path = noteToUpdate.path;
    if (folder !== undefined && folder !== noteToUpdate.folder) {
      const fileName = path.split('/').pop() || '';
      path = folder ? `${folder}/${fileName}` : fileName;
    }
    
    const updatedNote: Note = {
      ...noteToUpdate,
      content,
      lastModified: timestamp,
      synced: false,
      folder: folder !== undefined ? folder : noteToUpdate.folder,
      path
    };
    
    setNotes(prev => 
      prev.map(note => note.id === id ? updatedNote : note)
    );
    
    if (currentNote?.id === id) {
      setCurrentNote(updatedNote);
    }
    
    // Update folder references
    if (folder !== undefined && folder !== noteToUpdate.folder) {
      // Remove from old folder
      if (noteToUpdate.folder) {
        const oldFolder = folders.find(f => f.name === noteToUpdate.folder);
        if (oldFolder) {
          setFolders(prev => prev.map(f => 
            f.id === oldFolder.id 
              ? { ...f, notes: f.notes.filter(noteId => noteId !== id) }
              : f
          ));
        }
      }
      
      // Add to new folder
      if (folder) {
        const newFolder = folders.find(f => f.name === folder);
        if (newFolder) {
          setFolders(prev => prev.map(f => 
            f.id === newFolder.id 
              ? { ...f, notes: [...f.notes, id] }
              : f
          ));
        }
      }
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
    
    if (navigator.onLine && authState.isAuthenticated && selectedRepository) {
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

  // Create a new folder
  const createFolder = async (name: string): Promise<Folder | null> => {
    if (!selectedRepository) return null;
    
    const folderId = `folder_${Date.now()}`;
    const path = name.toLowerCase().replace(/\s+/g, '_');
    
    const newFolder: Folder = {
      id: folderId,
      name,
      path,
      notes: []
    };
    
    setFolders(prev => [...prev, newFolder]);
    
    // Try to create the folder on GitHub
    if (navigator.onLine && authState.isAuthenticated) {
      setLoading(true);
      
      try {
        const octokit = getOctokit();
        if (!octokit) throw new Error('Not authenticated');
        
        await octokit.repos.createOrUpdateFileContents({
          owner: selectedRepository.owner.login,
          repo: selectedRepository.name,
          path: `${path}/.gitkeep`,
          message: `Create folder: ${name}`,
          content: btoa(''),
          branch: selectedRepository.default_branch,
        });
        
        return newFolder;
      } catch (error) {
        console.error('Error creating folder on GitHub:', error);
        return newFolder;
      } finally {
        setLoading(false);
      }
    }
    
    return newFolder;
  };
  
  // Delete a folder and all its notes
  const deleteFolder = async (id: string): Promise<void> => {
    if (!selectedRepository) return;
    
    const folderToDelete = folders.find(folder => folder.id === id);
    if (!folderToDelete) return;
    
    // Delete all notes in the folder
    const folderNotes = notes.filter(note => note.folder === folderToDelete.name);
    for (const note of folderNotes) {
      await deleteNote(note.id);
    }
    
    // Delete the folder locally
    setFolders(prev => prev.filter(folder => folder.id !== id));
    
    // Try to delete the folder on GitHub (by removing .gitkeep)
    if (navigator.onLine && authState.isAuthenticated) {
      try {
        const octokit = getOctokit();
        if (!octokit) throw new Error('Not authenticated');
        
        // Try to get the .gitkeep file
        try {
          const { data: fileData } = await octokit.repos.getContent({
            owner: selectedRepository.owner.login,
            repo: selectedRepository.name,
            path: `${folderToDelete.path}/.gitkeep`,
          });
          
          if ('sha' in fileData) {
            await octokit.repos.deleteFile({
              owner: selectedRepository.owner.login,
              repo: selectedRepository.name,
              path: `${folderToDelete.path}/.gitkeep`,
              message: `Delete folder: ${folderToDelete.name}`,
              sha: fileData.sha,
              branch: selectedRepository.default_branch,
            });
          }
        } catch (error) {
          console.error('Error deleting folder on GitHub:', error);
        }
      } catch (error) {
        console.error('Error deleting folder:', error);
      }
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