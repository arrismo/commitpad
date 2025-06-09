import React, { useState, useEffect } from 'react';
import Header from '../components/layout/Header';
import Sidebar from '../components/layout/Sidebar';
import MarkdownEditor from '../components/editor/MarkdownEditor';
import SettingsModal from '../components/modals/SettingsModal';
import CreateRepoModal from '../components/modals/CreateRepoModal';
import SelectRepoModal from '../components/modals/SelectRepoModal';
import { useAuth } from '../context/AuthContext';
import { useRepository } from '../context/RepositoryContext';
import { useNotes } from '../context/NoteContext';
import { Maximize, Minimize } from 'lucide-react';

const Editor: React.FC = () => {
  const { authState } = useAuth();
  const { selectedRepository } = useRepository();
  const { fetchNotes } = useNotes();
  
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isCreateRepoOpen, setIsCreateRepoOpen] = useState(false);
  const [isSelectRepoOpen, setIsSelectRepoOpen] = useState(false);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [isFocusMode, setIsFocusMode] = useState(false);
  
  // Fetch notes when repository is selected
  useEffect(() => {
    if (selectedRepository) {
      fetchNotes();
    }
  }, [selectedRepository, fetchNotes]);
  
  // Track if we've already shown the repo selection modal
  const [initialSelectionDone, setInitialSelectionDone] = useState(false);
  
  // If no repository is selected, show the select repo modal, but only on initial load
  useEffect(() => {
    // Only show the select repo modal if:
    // 1. User is authenticated
    // 2. No repository is selected
    // 3. We're not creating a new repo
    // 4. We haven't already gone through initial selection
    if (authState.isAuthenticated && !selectedRepository && !isCreateRepoOpen) {
      if (!initialSelectionDone) {
        // First time showing the modal - this is intentional
        setIsSelectRepoOpen(true);
        setInitialSelectionDone(true);
      }
    } else if (selectedRepository) {
      // If we have a repository, close the modal and mark selection as done
      setIsSelectRepoOpen(false);
      setInitialSelectionDone(true);
    }
  }, [authState.isAuthenticated, selectedRepository, isCreateRepoOpen, initialSelectionDone]);
  
  // Listen for the custom event to open the switch repo modal
  useEffect(() => {
    const handler = () => setIsSelectRepoOpen(true);
    window.addEventListener('open-switch-repo-modal', handler);
    return () => window.removeEventListener('open-switch-repo-modal', handler);
  }, []);
  
  const toggleFocusMode = () => {
    setIsFocusMode(!isFocusMode);
  };
  
  return (
    <div className="flex flex-col h-screen bg-white dark:bg-slate-900 transition-colors duration-300">
      {!isFocusMode && (
        <Header 
          openSettings={() => setIsSettingsOpen(true)}
          isPreviewMode={isPreviewMode}
          togglePreviewMode={() => setIsPreviewMode(!isPreviewMode)}
          isFocusMode={isFocusMode}
          toggleFocusMode={toggleFocusMode}
        />
      )}
      
      <div className="flex flex-1 overflow-hidden">
        {!isFocusMode && (
          <Sidebar openCreateRepo={() => setIsCreateRepoOpen(true)} />
        )}
        
        <main className={`flex-1 overflow-hidden relative ${isFocusMode ? 'bg-white dark:bg-slate-900' : ''}`}>
          <MarkdownEditor 
            isPreviewMode={isPreviewMode}
            togglePreviewMode={() => setIsPreviewMode(!isPreviewMode)}
          />
          
          {isFocusMode && (
            <button 
              onClick={toggleFocusMode}
              className="absolute top-3 right-3 p-2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors z-50"
              title="Exit focus mode"
            >
              <Minimize className="h-4 w-4" />
            </button>
          )}
        </main>
      </div>
      
      {/* Modals */}
      <SettingsModal 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)} 
      />
      
      <CreateRepoModal 
        isOpen={isCreateRepoOpen} 
        onClose={() => setIsCreateRepoOpen(false)} 
      />
      
      <SelectRepoModal 
        isOpen={isSelectRepoOpen} 
        onClose={() => setIsSelectRepoOpen(false)}
        onCreateRepo={() => {
          setIsSelectRepoOpen(false);
          setIsCreateRepoOpen(true);
        }}
      />
    </div>
  );
};

export default Editor;