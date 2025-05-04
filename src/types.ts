export interface Note {
  id: string;
  title: string;
  content: string;
  path: string;
  lastModified: string;
  synced: boolean;
}

export interface Folder {
  id: string;
  name: string;
  path: string;
  notes: Note[];
}

export type SyncStatus = 'synced' | 'offline' | 'conflicted';

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
