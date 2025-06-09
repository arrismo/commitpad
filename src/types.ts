export interface Note {
  id: string;
  title: string;
  content: string;
  path: string;
  lastModified: string;
  synced: boolean;
  folder?: string; // Added folder property for organization
  // Supabase specific fields
  user_id?: string;
  repository_id?: string;
  github_sha?: string;
  folder_path?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Folder {
  id: string;
  name: string;
  path: string;
  notes: Note[];
  // Supabase specific fields
  user_id?: string;
  repository_id?: string;
  created_at?: string;
  updated_at?: string;
}

export type SyncStatus = 'synced' | 'offline' | 'conflicted' | 'syncing';

export interface GitHubFile {
  type: 'dir' | 'file' | 'submodule' | 'symlink';
  size: number;
  name: string;
  path: string;
  content?: string;
  sha: string;
  url: string;
  git_url: string | null;
  html_url: string | null;
  download_url: string | null;
  _links: {
    self: string;
    git: string;
    html: string;
  };
}

export type NoteFile = {
  type: 'file';
  name: string;
  path: string;
  sha: string;
};

export interface SupabaseRepository {
  id: string;
  user_id: string;
  github_id: number;
  name: string;
  full_name: string;
  owner_login: string;
  private: boolean;
  description?: string;
  selected: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserSettings {
  id?: string;
  user_id?: string;
  theme: 'light' | 'dark' | 'system';
  editor_font_size: number;
  editor_line_height: number;
  editor_font_family: string;
  created_at?: string;
  updated_at?: string;
}
