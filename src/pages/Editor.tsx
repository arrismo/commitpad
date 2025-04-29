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

const Editor: React.FC = () => {
  const { authState } = useAuth();
  const { selectedRepository } = useRepository();
  const { fetchNotes } = useNotes();
  
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isCreateRepoOpen, setIsCreateRepoOpen] = useState(false);
  const [isSelectRepoOpen, setIsSelectRepoOpen] = useState(false);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  
  // Fetch notes when repository is selected
  useEffect(() => {
    if (selectedRepository) {
      fetchNotes();
    }
  }, [selectedRepository, fetchNotes]);
  
  // If no repository is selected, show the select repo modal
  useEffect(() => {
    if (authState.isAuthenticated && !selectedRepository && !isCreateRepoOpen) {
      setIsSelectRepoOpen(true);
    }
  }, [authState.isAuthenticated, selectedRepository, isCreateRepoOpen]);
  
  return (
    <div className="flex flex-col h-screen bg-white dark:bg-slate-900 transition-colors duration-300">
      <Header 
        openSettings={() => setIsSettingsOpen(true)}
        isPreviewMode={isPreviewMode}
        togglePreviewMode={() => setIsPreviewMode(!isPreviewMode)}
      />
      
      <div className="flex flex-1 overflow-hidden">
        <Sidebar openCreateRepo={() => setIsCreateRepoOpen(true)} />
        
        <main className="flex-1 overflow-hidden">
          <MarkdownEditor 
            isPreviewMode={isPreviewMode}
            togglePreviewMode={() => setIsPreviewMode(!isPreviewMode)}
          />
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