import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { useRepository } from '../../context/RepositoryContext';
import { useNotes } from '../../context/NoteContext';
import { Github as GitHub, Moon, Sun, Save, Settings, Maximize } from 'lucide-react';
import { useSettings } from '../../context/SettingsContext';

interface HeaderProps {
  openSettings: () => void;
  isPreviewMode: boolean;
  togglePreviewMode: () => void;
  isFocusMode: boolean;
  toggleFocusMode: () => void;
}

const Header: React.FC<HeaderProps> = ({ 
  openSettings, 
  isPreviewMode, 
  togglePreviewMode,
  isFocusMode,
  toggleFocusMode
}) => {
  const { authState, logout } = useAuth();
  const { selectedRepository } = useRepository();
  const { syncStatus, syncNotes } = useNotes();
  const { settings, updateSettings } = useSettings();

  const toggleTheme = () => {
    const newTheme = settings.theme === 'dark' ? 'light' : 'dark';
    updateSettings({ theme: newTheme });
  };

  return (
    <header className="bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 p-3 flex items-center justify-between transition-colors duration-300">
      <div className="flex items-center space-x-2">
        <GitHub className="h-6 w-6 text-slate-700 dark:text-slate-300" />
        <h1 className="font-semibold text-slate-800 dark:text-white text-xl">CommitPad</h1>
        
        {selectedRepository && (
          <span className="ml-3 px-2 py-1 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-sm rounded-md">
            {selectedRepository.name}
          </span>
        )}
      </div>
      
      <div className="flex items-center space-x-3">
        {syncStatus === 'pending' && (
          <button 
            onClick={() => syncNotes()}
            className="flex items-center text-sm text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300"
          >
            <Save className="h-4 w-4 mr-1" />
            Sync
          </button>
        )}
        
        {syncStatus === 'offline' && (
          <span className="text-sm text-red-600 dark:text-red-400 flex items-center">
            <span className="w-2 h-2 bg-red-500 rounded-full mr-2"></span>
            Offline
          </span>
        )}
        
        {syncStatus === 'synced' && (
          <span className="text-sm text-green-600 dark:text-green-400 flex items-center">
            <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
            Synced
          </span>
        )}
        
        <button
          onClick={toggleTheme}
          className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors"
          aria-label="Toggle theme"
        >
          {settings.theme === 'dark' ? (
            <Sun className="h-5 w-5" />
          ) : (
            <Moon className="h-5 w-5" />
          )}
        </button>
        
        <button
          onClick={toggleFocusMode}
          className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors"
          aria-label="Enter focus mode"
          title="Enter focus mode"
        >
          <Maximize className="h-5 w-5" />
        </button>
        
        <button
          onClick={openSettings}
          className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors"
          aria-label="Settings"
        >
          <Settings className="h-5 w-5" />
        </button>
        
        {authState.isAuthenticated && authState.user && (
          <div className="flex items-center">
            <img 
              src={authState.user.avatar_url} 
              alt={authState.user.login}
              className="w-8 h-8 rounded-full"
            />
            <button
              onClick={logout}
              className="ml-2 text-sm text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-white"
            >
              Logout
            </button>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;