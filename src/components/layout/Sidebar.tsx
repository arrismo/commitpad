import React, { useState, useEffect } from 'react';
import { useNotes } from '../../context/NoteContext';
import { useRepository } from '../../context/RepositoryContext';
import { Note, Folder } from '../../types';
import { Plus, Search, FolderPlus, ChevronRight, ChevronDown, Folder as FolderIcon, File, X } from 'lucide-react';

interface SidebarProps {
  openCreateRepo: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ openCreateRepo }) => {
  const { notes, folders, currentNote, setCurrentNote, createNote, createFolder, deleteNote, deleteFolder, updateNote } = useNotes();
  const { selectedRepository } = useRepository();
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [movingNoteId, setMovingNoteId] = useState<string | null>(null);
  const [moveTargetFolder, setMoveTargetFolder] = useState<string>('');
  const [draggedNoteId, setDraggedNoteId] = useState<string | null>(null);
  const [dragOverTarget, setDragOverTarget] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [noteToDelete, setNoteToDelete] = useState<Note | null>(null);

  // Debug: log all notes to inspect their properties
  console.log('NOTES:', notes);

  const handleDeleteNote = async () => {
    if (noteToDelete) {
      await deleteNote(noteToDelete.id);
      setNoteToDelete(null);
    }
  };

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
  
  const handleMoveNote = async (noteId: string, folderName: string) => {
    await updateNote(noteId, notes.find(n => n.id === noteId)?.content || '', folderName);
    setMovingNoteId(null);
    setMoveTargetFolder('');
  };
  
  const filteredNotes = notes
    .filter(note => !/^readme(\.md)?$/i.test(note.path))
    .filter(note => 
      note.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      note.content.toLowerCase().includes(searchTerm.toLowerCase())
    );
  
  useEffect(() => {
    if (currentNote && /^readme(\.md)?$/i.test(currentNote.path) && filteredNotes.length > 0) {
      setCurrentNote(filteredNotes[0]);
    }
  }, [currentNote, filteredNotes, setCurrentNote]);
  
  // Get notes that are not in any folder
  const unorganizedNotes = filteredNotes.filter(note => !note.folder);
  
  // Filter folders with notes that match search term when searching
  const relevantFolders = searchTerm 
    ? folders.filter(folder => 
        filteredNotes.some(note => note.folder === folder.name)
      )
    : folders;
  
  // Drag and drop handlers
  const handleNoteDragStart = (noteId: string) => {
    setDraggedNoteId(noteId);
  };
  const handleNoteDragEnd = () => {
    setDraggedNoteId(null);
    setDragOverTarget(null);
  };
  const handleFolderDragOver = (e: React.DragEvent, folderName: string) => {
    e.preventDefault();
    setDragOverTarget(folderName);
  };
  const handleFolderDrop = (folderName: string) => {
    if (draggedNoteId) {
      handleMoveNote(draggedNoteId, folderName);
      setDraggedNoteId(null);
      setDragOverTarget(null);
    }
  };
  const handleUnorganizedDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOverTarget('unorganized');
  };
  const handleUnorganizedDrop = () => {
    if (draggedNoteId) {
      handleMoveNote(draggedNoteId, '');
      setDraggedNoteId(null);
      setDragOverTarget(null);
    }
  };
  
  return (<>
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
                    onDeleteFolder={deleteFolder} // For deleting the folder itself
                    onDeleteNote={(note) => setNoteToDelete(note)} // For notes within the folder
                    movingNoteId={movingNoteId}
                    moveTargetFolder={moveTargetFolder}
                    setMovingNoteId={setMovingNoteId}
                    setMoveTargetFolder={setMoveTargetFolder}
                    folders={folders}
                    handleMoveNote={handleMoveNote}
                    // Drag and drop
                    onDragOver={e => handleFolderDragOver(e, folder.name)}
                    onDrop={() => handleFolderDrop(folder.name)}
                    isDragOver={dragOverTarget === folder.name}
                  />
                ))}
              </div>
            )}
            
            {/* Unorganized Notes */}
            {unorganizedNotes.length > 0 && (
              <div
                onDragOver={handleUnorganizedDragOver}
                onDrop={handleUnorganizedDrop}
                className={dragOverTarget === 'unorganized' ? 'bg-blue-100 dark:bg-blue-900/40' : ''}
              >
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
                      onDelete={() => setNoteToDelete(note)}
                      onMove={() => setMovingNoteId(note.id)}
                      inFolder
                      movingNoteId={movingNoteId}
                      moveTargetFolder={moveTargetFolder}
                      setMovingNoteId={setMovingNoteId}
                      setMoveTargetFolder={setMoveTargetFolder}
                      folders={folders}
                      handleMoveNote={handleMoveNote}
                      // Drag and drop
                      draggable
                      onDragStart={() => handleNoteDragStart(note.id)}
                      onDragEnd={handleNoteDragEnd}
                      isDragging={draggedNoteId === note.id}
                    />
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div> {/* Close flex-1 overflow-y-auto */}
    </div> {/* Close w-64 ... */}

    {/* Custom Delete Note Confirmation Modal */}
    {noteToDelete && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-6 w-80">
          <h3 className="text-lg font-medium text-slate-800 dark:text-slate-200 mb-3">Delete Note?</h3>
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
            Are you sure you want to delete <span className="font-semibold">{noteToDelete?.title}</span>? This action cannot be undone.
          </p>
          <div className="flex justify-end gap-2">
            <button
              className="px-4 py-2 rounded bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-slate-600"
              onClick={() => setNoteToDelete(null)}
            >
              Cancel
            </button>
            <button
              className="px-4 py-2 rounded bg-red-600 text-white hover:bg-red-700"
              onClick={handleDeleteNote}
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    )}
  </>
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
  onDeleteFolder: (folderId: string) => void;
  onDeleteNote: (note: Note) => void; // Added for deleting notes within folder
  movingNoteId?: string | null;
  moveTargetFolder?: string;
  setMovingNoteId?: (id: string | null) => void;
  setMoveTargetFolder?: (folder: string) => void;
  folders?: Folder[];
  handleMoveNote?: (noteId: string, folderName: string) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: () => void;
  isDragOver?: boolean;
}

const FolderItem: React.FC<FolderItemProps> = ({ 
  folder, 
  notes, 
  isExpanded, 
  onToggle, 
  onNoteClick,
  currentNoteId,
  onCreateNote,
  onDeleteFolder,
  onDeleteNote, // Added prop
  movingNoteId,
  moveTargetFolder,
  setMovingNoteId,
  setMoveTargetFolder,
  folders,
  handleMoveNote,
  onDragOver,
  onDrop,
  isDragOver
}) => {
  return (
    <div
      className={`mb-1 ${isDragOver ? 'bg-blue-100 dark:bg-blue-900/40' : ''}`}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
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
          className="p-1 rounded-full opacity-0 group-hover:opacity-100 hover:bg-slate-200 dark:hover:bg-slate-700 text-gray-500 dark:text-gray-400"
          onClick={(e) => {
            e.stopPropagation();
            onCreateNote();
          }}
          aria-label="Create note in folder"
        >
          <Plus className="h-3 w-3" />
        </button>
        <button
          className="p-1 ml-1 rounded-full opacity-0 group-hover:opacity-100 hover:bg-red-100 dark:hover:bg-red-800 text-red-600 dark:text-red-400"
          onClick={e => {
            e.stopPropagation();
            onDeleteFolder(folder.id); // Correctly call onDeleteFolder with folder.id
          }}
          aria-label="Delete folder"
          title="Delete folder"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
      
      {isExpanded && notes.length > 0 && (
        <ul className="pl-8 divide-y divide-gray-200 dark:divide-slate-700">
          {notes.map(note => (
            <NoteItem
              key={note.id}
              note={note}
              isActive={currentNoteId === note.id}
              onClick={() => onNoteClick(note)} // Simplified call
              onDelete={() => onDeleteNote(note)} // Use onDeleteNote prop
              onMove={() => setMovingNoteId && setMovingNoteId(note.id)} // Added check for optional prop
              inFolder
              movingNoteId={movingNoteId}
              moveTargetFolder={moveTargetFolder}
              setMovingNoteId={setMovingNoteId}
              setMoveTargetFolder={setMoveTargetFolder}
              folders={folders}
              handleMoveNote={handleMoveNote}
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
  onDelete?: (id: string) => void;
  onMove?: (id: string) => void;
  movingNoteId?: string | null;
  moveTargetFolder?: string;
  setMovingNoteId?: (id: string | null) => void;
  setMoveTargetFolder?: (folder: string) => void;
  folders?: Folder[];
  handleMoveNote?: (noteId: string, folderName: string) => void;
  draggable?: boolean;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  isDragging?: boolean;
}

const NoteItem: React.FC<NoteItemProps> = ({ note, isActive, onClick, inFolder = false, onDelete, onMove, movingNoteId, moveTargetFolder, setMovingNoteId, setMoveTargetFolder, folders, handleMoveNote, draggable, onDragStart, onDragEnd, isDragging }) => {
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
        ${isDragging ? 'opacity-60 ring-2 ring-blue-400' : ''}
      `}
      onClick={onClick}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      <div className={`px-${inFolder ? '2' : '3'} py-2`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <File className="h-3.5 w-3.5 mr-1.5 text-gray-400" />
            <h3 className="font-medium text-sm text-slate-800 dark:text-slate-200 truncate">
              {note.title}
            </h3>
          </div>
          <div className="flex items-center gap-1">
            {onMove && setMovingNoteId && (
              <button
                onClick={e => {
                  e.stopPropagation();
                  if (onMove) onMove(note.id);
                }}
                className="p-1 rounded hover:bg-blue-100 dark:hover:bg-blue-800 text-blue-600 dark:text-blue-400"
                aria-label="Move note"
                title="Move note"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            )}
            {onDelete && (
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete && onDelete(note.id);              }}
                className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-800 text-red-600 dark:text-red-400"
                aria-label="Delete note"
                title="Delete note"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
          {contentPreview}
        </p>
        {/* Move note dropdown */}
        {movingNoteId === note.id && setMoveTargetFolder && setMovingNoteId && folders && handleMoveNote && (
          <div className="mt-2 flex items-center gap-2">
            <select
              className="text-xs border rounded px-1 py-0.5"
              value={moveTargetFolder}
              onChange={e => setMoveTargetFolder(e.target.value)}
            >
              <option value="">No Folder</option>
              {folders.map(f => (
                <option key={f.id} value={f.name}>{f.name}</option>
              ))}
            </select>
            <button
              className="text-xs px-2 py-0.5 rounded bg-blue-500 text-white hover:bg-blue-600"
              onClick={e => {
                e.stopPropagation();
                if (handleMoveNote) handleMoveNote(note.id, moveTargetFolder || '');
              }}
            >Move</button>
            <button
              className="text-xs px-2 py-0.5 rounded bg-gray-300 text-gray-700 hover:bg-gray-400"
              onClick={e => {
                e.stopPropagation();
                setMovingNoteId(null);
                setMoveTargetFolder('');
              }}
            >Cancel</button>
          </div>
        )}
      </div>
    </li>
  );
};

export default Sidebar;