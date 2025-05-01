import React, { useState } from 'react';
import { useNotes } from '../../context/NoteContext';
import { useRepository } from '../../context/RepositoryContext';
import { Note, Folder } from '../../types';
import { Plus, Search, FolderPlus, ChevronRight, ChevronDown, Folder as FolderIcon, File } from 'lucide-react';

interface SidebarProps {
  openCreateRepo: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ openCreateRepo }) => {
  const { notes, folders, currentNote, setCurrentNote, createNote, createFolder } = useNotes();
  const { selectedRepository } = useRepository();
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});
  const [newFolderName, setNewFolderName] = useState('');
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  
  const handleCreateNote = (folderName?: string) => {
    if (!selectedRepository) {
      openCreateRepo();
      return;
    }
    
    createNote('New Note', '# New Note\n\nStart writing here...', folderName);
  };
  
  const handleCreateFolder = async () => {
    if (!selectedRepository) {
      openCreateRepo();
      return;
    }
    
    if (newFolderName.trim()) {
      await createFolder(newFolderName.trim());
      setNewFolderName('');
      setIsCreatingFolder(false);
    }
  };
  
  const toggleFolder = (folderId: string) => {
    setExpandedFolders(prev => ({
      ...prev,
      [folderId]: !prev[folderId]
    }));
  };
  
  const filteredNotes = notes.filter(note => 
    note.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    note.content.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  // Get notes that are not in any folder
  const unorganizedNotes = filteredNotes.filter(note => !note.folder);
  
  // Filter folders with notes that match search term when searching
  const relevantFolders = searchTerm 
    ? folders.filter(folder => 
        filteredNotes.some(note => note.folder === folder.name)
      )
    : folders;
  
  return (
    <div className="w-64 border-r border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900 h-full flex flex-col transition-colors duration-300">
      <div className="p-3 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between">
        <h2 className="font-medium text-slate-700 dark:text-slate-200">Notes</h2>
        <div className="flex space-x-1">
          <button
            onClick={() => handleCreateNote()}
            className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300"
            aria-label="Create new note"
            title="Create new note"
          >
            <Plus className="h-4 w-4" />
          </button>
          
          <button
            onClick={() => setIsCreatingFolder(true)}
            className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300"
            aria-label="Create new folder"
            title="Create new folder"
          >
            <FolderPlus className="h-4 w-4" />
          </button>
          
          {!selectedRepository && (
            <button
              onClick={openCreateRepo}
              className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300"
              aria-label="Create repository"
              title="Create repository"
            >
              <FolderPlus className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
      
      <div className="p-3">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="Search notes..."
            className="w-full pl-9 pr-3 py-2 rounded-md border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-200 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-600"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>
      
      {/* Create folder input */}
      {isCreatingFolder && (
        <div className="px-3 pb-2">
          <div className="flex items-center rounded-md border border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/30 overflow-hidden">
            <input
              type="text"
              placeholder="Folder name..."
              className="flex-1 px-2 py-1 text-sm bg-transparent text-slate-800 dark:text-slate-200 focus:outline-none"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreateFolder();
                if (e.key === 'Escape') setIsCreatingFolder(false);
              }}
              autoFocus
            />
            <button
              onClick={handleCreateFolder}
              className="px-2 py-1 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-800/30"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
      
      <div className="flex-1 overflow-y-auto">
        {filteredNotes.length === 0 && folders.length === 0 ? (
          <div className="p-4 text-center text-gray-500 dark:text-gray-400 text-sm">
            {searchTerm 
              ? 'No notes match your search'
              : selectedRepository 
                ? 'No notes yet. Create your first note!' 
                : 'Select or create a repository to start'
            }
          </div>
        ) : (
          <div>
            {/* Folders */}
            {relevantFolders.length > 0 && (
              <div className="mb-2">
                {relevantFolders.map(folder => (
                  <FolderItem 
                    key={folder.id}
                    folder={folder}
                    notes={filteredNotes.filter(note => note.folder === folder.name)}
                    isExpanded={expandedFolders[folder.id] || false}
                    onToggle={() => toggleFolder(folder.id)}
                    onNoteClick={setCurrentNote}
                    currentNoteId={currentNote?.id}
                    onCreateNote={() => handleCreateNote(folder.name)}
                  />
                ))}
              </div>
            )}
            
            {/* Unorganized Notes */}
            {unorganizedNotes.length > 0 && (
              <div>
                {!searchTerm && (
                  <div className="px-3 py-1 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    Notes
                  </div>
                )}
                <ul className="divide-y divide-gray-200 dark:divide-slate-700">
                  {unorganizedNotes.map(note => (
                    <NoteItem
                      key={note.id}
                      note={note}
                      isActive={currentNote?.id === note.id}
                      onClick={() => setCurrentNote(note)}
                    />
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// Folder component
interface FolderItemProps {
  folder: Folder;
  notes: Note[];
  isExpanded: boolean;
  onToggle: () => void;
  onNoteClick: (note: Note) => void;
  currentNoteId?: string;
  onCreateNote: () => void;
}

const FolderItem: React.FC<FolderItemProps> = ({ 
  folder, 
  notes, 
  isExpanded, 
  onToggle, 
  onNoteClick,
  currentNoteId,
  onCreateNote
}) => {
  return (
    <div className="mb-1">
      <div 
        className="flex items-center px-3 py-1.5 hover:bg-gray-100 dark:hover:bg-slate-800 cursor-pointer group"
        onClick={onToggle}
      >
        <div className="mr-1 text-gray-400">
          {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </div>
        <FolderIcon className="h-4 w-4 mr-2 text-amber-500 dark:text-amber-400" />
        <span className="text-sm font-medium text-slate-700 dark:text-slate-300 flex-1">
          {folder.name}
        </span>
        <button 
          className="p-1 rounded-full opacity-0 group-hover:opacity-100 hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-500 dark:text-gray-400"
          onClick={(e) => {
            e.stopPropagation();
            onCreateNote();
          }}
          aria-label="Create note in folder"
        >
          <Plus className="h-3 w-3" />
        </button>
      </div>
      
      {isExpanded && notes.length > 0 && (
        <ul className="pl-8 divide-y divide-gray-200 dark:divide-slate-700">
          {notes.map(note => (
            <NoteItem
              key={note.id}
              note={note}
              isActive={currentNoteId === note.id}
              onClick={() => onNoteClick(note)}
              inFolder
            />
          ))}
        </ul>
      )}
      
      {isExpanded && notes.length === 0 && (
        <div className="pl-10 py-2 text-xs text-gray-500 dark:text-gray-400">
          No notes in this folder
        </div>
      )}
    </div>
  );
};

interface NoteItemProps {
  note: Note;
  isActive: boolean;
  onClick: () => void;
  inFolder?: boolean;
}

const NoteItem: React.FC<NoteItemProps> = ({ note, isActive, onClick, inFolder = false }) => {
  // Get first 2 lines and truncate
  const contentPreview = note.content
    .split('\n')
    .slice(0, 2)
    .join('\n')
    .replace(/^#\s+/, '')  // Remove Markdown heading
    .substring(0, 60);
    
  return (
    <li 
      className={`
        border-l-2 cursor-pointer transition-colors duration-200
        ${isActive 
          ? 'border-blue-500 bg-blue-50 dark:bg-slate-800' 
          : 'border-transparent hover:bg-gray-100 dark:hover:bg-slate-800'}
      `}
      onClick={onClick}
    >
      <div className={`px-${inFolder ? '2' : '3'} py-2`}>
        <div className="flex items-center">
          <File className="h-3.5 w-3.5 mr-1.5 text-gray-400" />
          <h3 className="font-medium text-sm text-slate-800 dark:text-slate-200 truncate">
            {note.title}
          </h3>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
          {contentPreview}
        </p>
        <div className="flex items-center mt-1 text-xs text-slate-400 dark:text-slate-500">
          <span>
            {new Date(note.lastModified).toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
            })}
          </span>
          {!note.synced && (
            <span className="ml-2 h-1.5 w-1.5 bg-amber-500 rounded-full"></span>
          )}
        </div>
      </div>
    </li>
  );
};

export default Sidebar;