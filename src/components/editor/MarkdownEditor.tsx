import React, { useEffect, useRef, useState } from 'react';
import { useSettings } from '../../context/SettingsContext';
import { useNotes } from '../../context/NoteContext';
import { Eye, Edit, Save } from 'lucide-react';
import MarkdownPreview from './MarkdownPreview';

interface MarkdownEditorProps {
  isPreviewMode: boolean;
  togglePreviewMode: () => void;
}

const MarkdownEditor: React.FC<MarkdownEditorProps> = ({ 
  isPreviewMode, 
  togglePreviewMode 
}) => {
  const { settings } = useSettings();
  const { currentNote, updateNote, syncStatus } = useNotes();
  const [content, setContent] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isSaving, setIsSaving] = useState(false);
  
  // Update content when currentNote changes
  useEffect(() => {
    if (currentNote) {
      setContent(currentNote.content);
    } else {
      setContent('');
    }
  }, [currentNote]);
  
  // Auto-save functionality
  useEffect(() => {
    if (!currentNote || !settings.autoSave) return;
    
    // Don't save if content hasn't changed
    if (content === currentNote.content) return;
    
    const timer = setTimeout(() => {
      saveContent();
    }, 1500);
    
    return () => clearTimeout(timer);
  }, [content, currentNote, settings.autoSave]);
  
  const saveContent = async () => {
    if (!currentNote || content === currentNote.content) return;
    
    setIsSaving(true);
    await updateNote(currentNote.id, content);
    setIsSaving(false);
  };
  
  // Focus the textarea when not in preview mode
  useEffect(() => {
    if (!isPreviewMode && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isPreviewMode, currentNote]);
  
  if (!currentNote) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400">
        <p className="mb-4">Select a note or create a new one</p>
      </div>
    );
  }
  
  return (
    <div className="flex flex-col h-full relative">
      <div className="absolute top-3 right-4 flex space-x-2 z-10">
        <button
          onClick={togglePreviewMode}
          className={`
            p-1.5 rounded-md border transition-colors
            ${isPreviewMode 
              ? 'border-gray-300 dark:border-slate-600 bg-gray-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300' 
              : 'border-transparent hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-500 dark:text-gray-400'}
          `}
          aria-label={isPreviewMode ? 'Edit mode' : 'Preview mode'}
        >
          {isPreviewMode ? <Edit className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
        
        {!settings.autoSave && content !== currentNote.content && (
          <button
            onClick={saveContent}
            className="p-1.5 rounded-md border border-blue-200 dark:border-blue-800 bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 transition-colors"
            aria-label="Save"
          >
            <Save className="h-4 w-4" />
          </button>
        )}
      </div>
      
      {isPreviewMode ? (
        <div className="flex-1 overflow-y-auto p-6 bg-white dark:bg-slate-900">
          <MarkdownPreview content={content} />
        </div>
      ) : (
        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="flex-1 p-6 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 outline-none resize-none w-full font-mono"
          style={{ 
            fontSize: `${settings.fontSize}px`, 
            lineHeight: settings.lineSpacing 
          }}
          placeholder="Start writing..."
        />
      )}
      
      <div className="p-2 border-t border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-xs text-gray-500 dark:text-gray-400 flex justify-between items-center">
        <div className="flex items-center">
          {isSaving && (
            <span className="flex items-center">
              <Save className="h-3 w-3 mr-1 animate-pulse" />
              Saving...
            </span>
          )}
          
          {!isSaving && syncStatus === 'synced' && content === currentNote.content && (
            <span className="flex items-center">
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full mr-1.5"></span>
              Saved
            </span>
          )}
          
          {!isSaving && content !== currentNote.content && (
            <span className="flex items-center">
              <span className="w-1.5 h-1.5 bg-amber-500 rounded-full mr-1.5"></span>
              Unsaved changes
            </span>
          )}
        </div>
        
        <div>
          {content.split(/\s+/).filter(Boolean).length} words
        </div>
      </div>
    </div>
  );
};

export default MarkdownEditor;