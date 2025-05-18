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
  createNote: (title: string, content: string, folderName?: string) => Promise<Note | null>;
  updateNote: (id: string, content: string, folderName?: string) => Promise<void>;
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

  // Check if we're online and update sync status accordingly
  useEffect(() => {
    const updateOnlineStatus = () => {
      setSyncStatus(navigator.onLine ? 'synced' : 'offline');
    };
    
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
    updateOnlineStatus();
    
    return () => {
      window.removeEventListener('online', updateOnlineStatus);
      window.removeEventListener('offline', updateOnlineStatus);
    };
  }, []);

  // Update current note in session storage for temporary persistence
  // This is just for the current session and will be cleared when the browser is closed
  useEffect(() => {
    if (currentNote) {
      sessionStorage.setItem('commitpad_current_note', JSON.stringify(currentNote));
    } else {
      sessionStorage.removeItem('commitpad_current_note');
    }
  }, [currentNote]);
  
  // Load current note from session storage on initial load
  useEffect(() => {
    if (!currentNote) {
      const storedNote = sessionStorage.getItem('commitpad_current_note');
      if (storedNote) {
        try {
          setCurrentNote(JSON.parse(storedNote));
        } catch (e) {
          sessionStorage.removeItem('commitpad_current_note');
        }
      }
    }
  }, []);

  // Helper: Encode content to base64 for GitHub API
  const encodeBase64 = (str: string) => {
    if (typeof window !== 'undefined' && window.btoa) return window.btoa(str);
    return Buffer.from(str, 'utf-8').toString('base64');
  };

  // Fetch notes from GitHub repo
  const fetchNotes = async () => {
    if (!authState.isAuthenticated || !selectedRepository) {
      setNotes([]);
      setCurrentNote(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const octokit = getOctokit();
      if (!octokit) throw new Error('Not authenticated');
      
      // Recursive function to get all files in a repository, including those in folders
      const getAllFiles = async (path: string = ''): Promise<any[]> => {
        try {
          const { data: content } = await octokit.repos.getContent({
            owner: selectedRepository.owner.login,
            repo: selectedRepository.name,
            path,
          });
          
          if (!Array.isArray(content)) {
            return [];
          }
          
          // Process files and folders
          const results = await Promise.all(
            content.map(async item => {
              if (item.type === 'dir') {
                // Recursively get files from directories
                const nestedFiles = await getAllFiles(item.path);
                return nestedFiles;
              } else if (item.type === 'file' && 
                       (item.name.startsWith('note_') || item.name.endsWith('.md'))) {
                // Only include note files
                return [item];
              }
              return [];
            })
          );
          
          // Flatten the results array
          return results.flat();
        } catch (error) {
          console.error(`Error fetching content from ${path}:`, error);
          return [];
        }
      };
      
      // Get all note files from the repository, including those in folders
      const allNoteFiles = await getAllFiles();
      
      // Fetch each note file's content
      const notesData = await Promise.all(
        allNoteFiles.map(async file => {
          try {
            const { data } = await octokit.repos.getContent({
              owner: selectedRepository.owner.login,
              repo: selectedRepository.name,
              path: file.path,
            });
            
            const content = (data as any).content ? atob((data as any).content.replace(/\s/g, '')) : '';
            const title = content.split('\n')[0].replace(/^#\s+/, '') || file.name.replace(/\.md$/, '').replace('note_', '');
            
            // Extract folder name from path if it exists
            let folder: string | undefined = undefined;
            const pathParts = file.path.split('/');
            if (pathParts.length > 1) {
              folder = pathParts[0];
            }
            
            return {
              id: file.sha,
              title,
              content,
              path: file.path,
              folder,
              lastModified: new Date().toISOString(),
              synced: true,
            } as Note;
          } catch (error) {
            console.error(`Error fetching content for ${file.path}:`, error);
            return null;
          }
        })
      );
      
      const validNotes = notesData.filter(Boolean) as Note[];
      setNotes(validNotes);
      setSyncStatus(navigator.onLine ? 'synced' : 'offline');
    } catch (error) {
      console.error('Failed to fetch notes from GitHub:', error);
      setError('Failed to fetch notes from GitHub');
      setNotes([]);
    } finally {
      setLoading(false);
    }
  };


  
  // Create a new note in GitHub repo
  const createNote = async (title: string, content: string, folderName?: string): Promise<Note | null> => {
    if (!authState.isAuthenticated || !selectedRepository) return null;
    setLoading(true);
    setError(null);
    setSyncStatus('syncing');
    
    // Create a temporary note ID that will be replaced after GitHub creates the note
    const tempId = `temp-${Date.now()}`;
    const noteTimestamp = Date.now();
    
    // Create a new note object for immediate UI update
    const tempNote: Note = {
      id: tempId,
      title,
      content,
      path: folderName ? `${folderName}/note_${noteTimestamp}.md` : `note_${noteTimestamp}.md`,
      folder: folderName,
      lastModified: new Date().toISOString(),
      synced: false
    };
    
    // Update the local state immediately for a responsive UI
    setNotes(prevNotes => [...prevNotes, tempNote]);
    setCurrentNote(tempNote);
    
    // Return early if offline - the note will be synced when back online
    if (!navigator.onLine) {
      setError('Cannot sync note while offline. Your note will be synced when you are back online.');
      setSyncStatus('offline');
      return tempNote;
    }
    
    try {
      const octokit = getOctokit();
      if (!octokit) throw new Error('Not authenticated');
      
      // If folder is specified, create note in that folder
      const timestamp = Date.now();
      const filename = folderName 
        ? `${folderName}/note_${timestamp}.md` 
        : `note_${timestamp}.md`;
      
      const fullContent = `# ${title}\n${content}`;
      
      const response = await octokit.repos.createOrUpdateFileContents({
        owner: selectedRepository.owner.login,
        repo: selectedRepository.name,
        path: filename,
        message: `Create note: ${title}`,
        content: encodeBase64(fullContent),
      });
      
      // Get the SHA of the created file
      const sha = response.data.content?.sha;
      
      if (!sha) throw new Error('Failed to get SHA for created note');
      
      // Create the final note object with the GitHub response
      const finalNote: Note = {
        id: sha,
        title,
        content,
        path: filename,
        folder: folderName,
        lastModified: new Date().toISOString(),
        synced: true
      };
      
      // Update the local state with the final note, replacing the temporary one
      setNotes(prevNotes => 
        prevNotes.map(note => note.id === tempId ? finalNote : note)
      );
      setCurrentNote(finalNote);
      setSyncStatus('synced');
      
      return finalNote;
    } catch (error) {
      console.error('Error creating note:', error);
      setError('Failed to create note');
      setSyncStatus('offline');
      return null;
    } finally {
      setLoading(false);
    }
  };

  // Update a note in GitHub repo
  const updateNote = async (id: string, content: string, folderName?: string): Promise<void> => {
    if (!authState.isAuthenticated || !selectedRepository) return;
    setLoading(true);
    setError(null);
    setSyncStatus('syncing');
    
    try {
      const note = notes.find(n => n.id === id);
      if (!note) throw new Error('Note not found');
      
      // Update the note content
      note.content = content;
      note.lastModified = new Date().toISOString();
      
      // Update folder if specified
      if (folderName !== undefined) {
        note.folder = folderName;
      }
      
      // Check if we're online
      if (!navigator.onLine) {
        setError('Cannot update note while offline');
        setSyncStatus('offline');
        return;
      }
      
      const octokit = getOctokit();
      if (!octokit) throw new Error('Not authenticated');
      
      // Get file SHA
      const { data } = await octokit.repos.getContent({
        owner: selectedRepository.owner.login,
        repo: selectedRepository.name,
        path: note.path,
      });
      
      const sha = (data as any).sha;
      const fullContent = `# ${note.title}\n${content}`;
      
      // If we're moving to a different folder, we need to delete the old file and create a new one
      if (folderName !== undefined && note.folder !== folderName) {
        // Delete the old file
        await octokit.repos.deleteFile({
          owner: selectedRepository.owner.login,
          repo: selectedRepository.name,
          path: note.path,
          message: `Move note: ${note.title} to ${folderName || 'root'}`,
          sha,
        });
        
        // Create a new file in the target folder
        const timestamp = Date.now();
        const newPath = folderName 
          ? `${folderName}/note_${timestamp}.md` 
          : `note_${timestamp}.md`;
          
        const createResponse = await octokit.repos.createOrUpdateFileContents({
          owner: selectedRepository.owner.login,
          repo: selectedRepository.name,
          path: newPath,
          message: `Create note: ${note.title} in ${folderName || 'root'}`,
          content: encodeBase64(fullContent),
        });
        
        // Update note with new path and SHA
        note.path = newPath;
        note.id = createResponse.data.content?.sha || note.id;
      } else {
        // Just update the existing file
        await octokit.repos.createOrUpdateFileContents({
          owner: selectedRepository.owner.login,
          repo: selectedRepository.name,
          path: note.path,
          message: `Update note: ${note.title}`,
          content: encodeBase64(fullContent),
          sha,
        });
      }
      
      // Update local state
      setNotes(prev => prev.map(n => n.id === id ? note : n));
      if (currentNote?.id === id) {
        setCurrentNote(note);
      }
      
      setSyncStatus('synced');
    } catch (error) {
      console.error('Error updating note:', error);
      setError('Failed to update note');
      setSyncStatus('offline');
    } finally {
      setLoading(false);
    }
  };

  // Delete a note in GitHub repo
  const deleteNote = async (id: string): Promise<void> => {
    if (!authState.isAuthenticated || !selectedRepository) return;
    setLoading(true);
    setError(null);
    setSyncStatus('syncing');
    
    try {
      const note = notes.find(n => n.id === id);
      if (!note) throw new Error('Note not found');
      
      // Check if we're online
      if (!navigator.onLine) {
        setError('Cannot delete note while offline');
        setSyncStatus('offline');
        return;
      }
      
      const octokit = getOctokit();
      if (!octokit) throw new Error('Not authenticated');
      
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
      
      // Update local state
      setNotes(prev => prev.filter(n => n.id !== id));
      if (currentNote?.id === id) {
        setCurrentNote(null);
      }
      
      setSyncStatus('synced');
    } catch (error) {
      console.error('Error deleting note:', error);
      setError('Failed to delete note');
      setSyncStatus('offline');
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
      
      // Get all directories from the root level
      const { data: repoContent } = await octokit.repos.getContent({
        owner: selectedRepository.owner.login,
        repo: selectedRepository.name,
        path: '',
      });
      
      const folderDirs = Array.isArray(repoContent)
        ? repoContent.filter(item => item.type === 'dir')
        : [];
        
      // Create folder objects with notes
      const folderObjects = folderDirs.map(dir => ({
        id: dir.sha,
        name: dir.name,
        path: dir.path,
        lastModified: dir.sha,
        notes: [] // Initialize with empty notes array to satisfy Folder type
      }));
      
      // Set the folders state
      setFolders(folderObjects);
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
      // Clear local notes when repository changes to prevent showing stale notes
      setNotes([]);
      setFolders([]);
      setCurrentNote(null);
      sessionStorage.removeItem('commitpad_current_note');
      
      // Then fetch fresh notes from the selected repository
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