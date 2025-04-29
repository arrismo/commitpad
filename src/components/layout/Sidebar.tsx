import React, { useState } from 'react';
import { useNotes } from '../../context/NoteContext';
import { useRepository } from '../../context/RepositoryContext';
import { Note } from '../../types';
import { Plus, Search, FolderPlus } from 'lucide-react';

interface SidebarProps {
  openCreateRepo: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ openCreateRepo }) => {
  const { notes, currentNote, setCurrentNote, createNote } = useNotes();
  const { selectedRepository } = useRepository();
  const [searchTerm, setSearchTerm] = useState('');
  
  const handleCreateNote = () => {
    if (!selectedRepository) {
      openCreateRepo();
      return;
    }
    
    createNote('New Note', '# New Note\n\nStart writing here...');
  };
  
  const filteredNotes = notes.filter(note => 
    note.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    note.content.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  return (
    <div className="w-64 border-r border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900 h-full flex flex-col transition-colors duration-300">
      <div className="p-3 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between">
        <h2 className="font-medium text-slate-700 dark:text-slate-200">Notes</h2>
        <div className="flex space-x-1">
          <button
            onClick={handleCreateNote}
            className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300"
            aria-label="Create new note"
          >
            <Plus className="h-4 w-4" />
          </button>
          
          {!selectedRepository && (
            <button
              onClick={openCreateRepo}
              className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300"
              aria-label="Create repository"
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
      
      <div className="flex-1 overflow-y-auto">
        {filteredNotes.length === 0 ? (
          <div className="p-4 text-center text-gray-500 dark:text-gray-400 text-sm">
            {searchTerm 
              ? 'No notes match your search'
              : selectedRepository 
                ? 'No notes yet. Create your first note!' 
                : 'Select or create a repository to start'
            }
          </div>
        ) : (
          <ul className="divide-y divide-gray-200 dark:divide-slate-700">
            {filteredNotes.map(note => (
              <NoteItem
                key={note.id}
                note={note}
                isActive={currentNote?.id === note.id}
                onClick={() => setCurrentNote(note)}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

interface NoteItemProps {
  note: Note;
  isActive: boolean;
  onClick: () => void;
}

const NoteItem: React.FC<NoteItemProps> = ({ note, isActive, onClick }) => {
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
      <div className="px-3 py-2">
        <h3 className="font-medium text-sm text-slate-800 dark:text-slate-200 truncate">
          {note.title}
        </h3>
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