import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { useRepository } from './RepositoryContext';
import { Note, NoteFile, SyncStatus, Folder } from '../types';
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

  // Fetch notes from Supabase
  const fetchNotes = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase.from('notes').select('*');
      if (error) throw error;
      setNotes(data || []);
      setSyncStatus('synced');
    } catch (error: any) {
      setError(error.message || 'Failed to fetch notes');
      setSyncStatus('offline');
    } finally {
      setLoading(false);
    }
  };

  // Create a note in Supabase
  const createNote = async (title: string, content: string, folder: string = ''): Promise<Note | null> => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase.from('notes').insert([{ title, content, folder }]).select().single();
      if (error) throw error;
      setNotes(prev => [...prev, data]);
      setCurrentNote(data);
      setSyncStatus('synced');
      return data;
    } catch (error: any) {
      setError(error.message || 'Failed to create note');
      setSyncStatus('offline');
      return null;
    } finally {
      setLoading(false);
    }
  };

  // Update a note in Supabase
  const updateNote = async (id: string, content: string, folder?: string): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const updateObj: any = { content };
      if (folder !== undefined) updateObj.folder = folder;
      const { data, error } = await supabase.from('notes').update(updateObj).eq('id', id).select().single();
      if (error) throw error;
      setNotes(prev => prev.map(note => note.id === id ? data : note));
      if (currentNote?.id === id) setCurrentNote(data);
      setSyncStatus('synced');
    } catch (error: any) {
      setError(error.message || 'Failed to update note');
      setSyncStatus('offline');
    } finally {
      setLoading(false);
    }
  };

  // Delete a note in Supabase
  const deleteNote = async (id: string): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const { error } = await supabase.from('notes').delete().eq('id', id);
      if (error) throw error;
      setNotes(prev => prev.filter(note => note.id !== id));
      if (currentNote?.id === id) setCurrentNote(null);
      setSyncStatus('synced');
    } catch (error: any) {
      setError(error.message || 'Failed to delete note');
      setSyncStatus('offline');
    } finally {
      setLoading(false);
    }
  };

  // Fetch folders from Supabase
  const fetchFolders = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase.from('folders').select('*');
      if (error) throw error;
      setFolders(data || []);
    } catch (error: any) {
      setError(error.message || 'Failed to fetch folders');
    } finally {
      setLoading(false);
    }
  };

  // Create a folder in Supabase
  const createFolder = async (name: string): Promise<Folder | null> => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase.from('folders').insert([{ name }]).select().single();
      if (error) throw error;
      setFolders(prev => [...prev, data]);
      return data;
    } catch (error: any) {
      setError(error.message || 'Failed to create folder');
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
      // Optionally, delete all notes in the folder first
      await supabase.from('notes').delete().eq('folder', id);
      const { error } = await supabase.from('folders').delete().eq('id', id);
      if (error) throw error;
      setFolders(prev => prev.filter(folder => folder.id !== id));
    } catch (error: any) {
      setError(error.message || 'Failed to delete folder');
    } finally {
      setLoading(false);
    }
  };

  // On mount, fetch notes and folders
  useEffect(() => {
    fetchNotes();
    fetchFolders();
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