export interface User {
  id: number;
  login: string;
  name: string | null;
  avatar_url: string;
}

export interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  token: string | null;
  loading: boolean;
  error: string | null;
}

export interface Repository {
  id: number;
  name: string;
  full_name: string;
  owner: {
    login: string;
  };
  default_branch: string;
  private: boolean;
}

export interface Note {
  id: string;
  title: string;
  content: string;
  path: string;
  lastModified: string;
  synced: boolean;
}

export interface NoteFile {
  name: string;
  path: string;
  sha: string;
  content?: string;
  type: 'file' | 'dir';
}

export interface AppSettings {
  theme: 'light' | 'dark' | 'system';
  fontSize: number;
  lineSpacing: number;
  autoSave: boolean;
  commitMessageTemplate: string;
}

export type SyncStatus = 'synced' | 'pending' | 'conflicted' | 'offline';