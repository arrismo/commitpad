import React, { useEffect, useRef, useState } from 'react';
import { useSettings } from '../../context/SettingsContext';
import { useNotes } from '../../context/NoteContext';
import { Eye, Edit, Save, Code, Plus, X } from 'lucide-react';
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
  const [isCodeBlockHelperOpen, setIsCodeBlockHelperOpen] = useState(false);
  const [codeLanguage, setCodeLanguage] = useState('javascript');
  
  // Popular code languages for quick selection
  const popularLanguages = [
    'javascript', 'typescript', 'python', 'java', 
    'c', 'cpp', 'csharp', 'go', 'rust', 'php',
    'ruby', 'swift', 'kotlin', 'html', 'css', 'bash'
  ];
  
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
  
  // Insert a code block at the cursor position
  const insertCodeBlock = () => {
    if (!textareaRef.current) return;
    
    const textarea = textareaRef.current;
    const selectionStart = textarea.selectionStart;
    const selectionEnd = textarea.selectionEnd;
    
    const codeBlockTemplate = `\`\`\`${codeLanguage}\n// Your code here\n\`\`\``;
    
    const newContent = 
      content.substring(0, selectionStart) + 
      codeBlockTemplate + 
      content.substring(selectionEnd);
    
    setContent(newContent);
    
    // Position cursor inside the code block
    setTimeout(() => {
      textarea.focus();
      const newPosition = selectionStart + 3 + codeLanguage.length + 1;
      textarea.setSelectionRange(newPosition + 15, newPosition + 15);
    }, 0);
    
    setIsCodeBlockHelperOpen(false);
  };
  
  // Handle tab key for indentation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      
      const start = textareaRef.current!.selectionStart;
      const end = textareaRef.current!.selectionEnd;
      
      const newContent = 
        content.substring(0, start) + 
        '  ' + 
        content.substring(end);
      
      setContent(newContent);
      
      // Position cursor after indentation
      setTimeout(() => {
        textareaRef.current!.focus();
        textareaRef.current!.setSelectionRange(start + 2, start + 2);
      }, 0);
    }
  };
  
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
          onClick={() => setIsCodeBlockHelperOpen(true)}
          className="p-1.5 rounded-md border border-transparent hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-500 dark:text-gray-400 transition-colors"
          aria-label="Insert code block"
          title="Insert code block"
        >
          <Code className="h-4 w-4" />
        </button>
        
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
      
      {/* Code block helper popup */}
      {isCodeBlockHelperOpen && (
        <div className="absolute top-10 right-4 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-md shadow-lg z-50 p-3 w-64">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-sm font-medium text-slate-800 dark:text-slate-200">
              Insert Code Block
            </h3>
            <button
              onClick={() => setIsCodeBlockHelperOpen(false)}
              className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          
          <div className="mb-3">
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
              Language
            </label>
            <input
              type="text"
              value={codeLanguage}
              onChange={(e) => setCodeLanguage(e.target.value.toLowerCase())}
              className="w-full px-2 py-1 text-sm rounded border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
              placeholder="e.g. javascript"
            />
          </div>
          
          <div className="mb-3">
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
              Common Languages
            </label>
            <div className="flex flex-wrap gap-1">
              {popularLanguages.slice(0, 8).map(lang => (
                <button
                  key={lang}
                  onClick={() => setCodeLanguage(lang)}
                  className={`text-xs px-1.5 py-0.5 rounded ${
                    codeLanguage === lang
                      ? 'bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300' 
                      : 'bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  {lang}
                </button>
              ))}
              
              {/* Show more languages button */}
              <button
                onClick={() => {
                  const nextLang = popularLanguages.find(lang => !popularLanguages.slice(0, 8).includes(lang));
                  if (nextLang) setCodeLanguage(nextLang);
                }}
                className="text-xs px-1.5 py-0.5 rounded bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300"
              >
                <Plus className="h-3 w-3" />
              </button>
            </div>
          </div>
          
          <button
            onClick={insertCodeBlock}
            className="w-full py-1.5 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm font-medium"
          >
            Insert
          </button>
        </div>
      )}
      
      {isPreviewMode ? (
        <div className="flex-1 overflow-y-auto p-6 bg-white dark:bg-slate-900">
          <MarkdownPreview content={content} />
        </div>
      ) : (
        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          className="flex-1 p-6 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 outline-none resize-none w-full font-mono"
          style={{ 
            fontSize: `${settings.fontSize}px`, 
            lineHeight: settings.lineSpacing 
          }}
          placeholder="Start writing..."
          spellCheck="false"
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