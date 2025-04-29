import React from 'react';
import { Github as GitHub } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const Auth: React.FC = () => {
  const { login, authState } = useAuth();
  
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 flex flex-col justify-center transition-colors duration-300">
      <div className="mx-auto max-w-md w-full px-4">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-white dark:bg-slate-800 shadow-md mb-4">
            <GitHub className="h-8 w-8 text-blue-600 dark:text-blue-400" />
          </div>
          <h1 className="text-3xl font-bold text-slate-800 dark:text-white">CommitPad</h1>
          <p className="mt-2 text-slate-600 dark:text-slate-400">
            Distraction-free notes with GitHub integration
          </p>
        </div>
        
        <div className="bg-white dark:bg-slate-800 shadow-md rounded-lg p-6">
          <div className="space-y-4">
            <div className="text-center">
              <h2 className="text-xl font-semibold text-slate-800 dark:text-white">Welcome</h2>
              <p className="mt-1 text-slate-600 dark:text-slate-400">
                Sign in with GitHub to sync your notes
              </p>
            </div>
            
            {authState.error && (
              <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-3 rounded-md text-sm">
                {authState.error}
              </div>
            )}
            
            <button
              onClick={login}
              disabled={authState.loading}
              className="w-full bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 text-white py-3 rounded-md font-medium flex items-center justify-center transition-colors duration-200"
            >
              {authState.loading ? (
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : (
                <GitHub className="mr-2 h-5 w-5" />
              )}
              {authState.loading ? 'Signing in...' : 'Sign in with GitHub'}
            </button>
          </div>
          
          <div className="mt-6 text-center text-xs text-slate-500 dark:text-slate-500">
            <p>
              By signing in, you agree to store your notes on GitHub. 
              We'll never modify your repositories without your permission.
            </p>
          </div>
        </div>
        
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
          <div className="bg-white dark:bg-slate-800 p-4 rounded-lg shadow-sm">
            <h3 className="font-medium text-slate-800 dark:text-white">Markdown Support</h3>
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
              Write in markdown with live preview
            </p>
          </div>
          <div className="bg-white dark:bg-slate-800 p-4 rounded-lg shadow-sm">
            <h3 className="font-medium text-slate-800 dark:text-white">GitHub Sync</h3>
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
              Automatically syncs with your GitHub repos
            </p>
          </div>
          <div className="bg-white dark:bg-slate-800 p-4 rounded-lg shadow-sm">
            <h3 className="font-medium text-slate-800 dark:text-white">Offline Ready</h3>
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
              Work offline and sync when connected
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Auth;