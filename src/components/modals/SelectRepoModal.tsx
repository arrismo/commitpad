import React, { useEffect, useState } from 'react';
import { useRepository } from '../../context/RepositoryContext';
import { Repository } from '../../types';
import { X, Search, FolderPlus } from 'lucide-react';

interface SelectRepoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateRepo: () => void;
}

const SelectRepoModal: React.FC<SelectRepoModalProps> = ({ isOpen, onClose, onCreateRepo }) => {
  const { repositories, loading, error, fetchRepositories, selectRepository } = useRepository();
  const [searchTerm, setSearchTerm] = useState('');
  
  useEffect(() => {
    if (isOpen) {
      fetchRepositories();
    }
  }, [isOpen, fetchRepositories]);
  
  if (!isOpen) return null;
  
  const filteredRepos = repositories.filter(repo => 
    repo.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    repo.full_name.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  const handleSelectRepo = (repo: Repository) => {
    selectRepository(repo);
    onClose();
  };
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-xl max-h-[80vh]">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-slate-700">
          <h2 className="text-lg font-medium text-slate-800 dark:text-white">Select Repository</h2>
          <button
            onClick={onClose}
            className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        
        <div className="p-4 border-b border-gray-200 dark:border-slate-700">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Search repositories..."
              className="w-full pl-9 pr-3 py-2 rounded-md border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-600"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
        
        <div className="overflow-y-auto max-h-[40vh]">
          {loading ? (
            <div className="p-6 text-center">
              <svg className="animate-spin mx-auto h-6 w-6 text-gray-500 dark:text-gray-400" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <p className="mt-2 text-gray-500 dark:text-gray-400">Loading repositories...</p>
            </div>
          ) : error ? (
            <div className="p-6 text-center text-red-500 dark:text-red-400">
              <p>{error}</p>
            </div>
          ) : filteredRepos.length === 0 ? (
            <div className="p-6 text-center text-gray-500 dark:text-gray-400">
              <p>No repositories found</p>
            </div>
          ) : (
            <ul className="divide-y divide-gray-200 dark:divide-slate-700">
              {filteredRepos.map(repo => (
                <li
                  key={repo.id}
                  className="p-4 hover:bg-gray-50 dark:hover:bg-slate-700 cursor-pointer"
                  onClick={() => handleSelectRepo(repo)}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium text-slate-800 dark:text-slate-200">{repo.name}</h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">{repo.full_name}</p>
                    </div>
                    <span 
                      className={`text-xs px-2 py-1 rounded-full ${
                        repo.private 
                          ? 'bg-gray-100 dark:bg-slate-700 text-gray-800 dark:text-gray-300' 
                          : 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-400'
                      }`}
                    >
                      {repo.private ? 'Private' : 'Public'}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
        
        <div className="p-4 border-t border-gray-200 dark:border-slate-700">
          <button
            onClick={onCreateRepo}
            className="w-full flex items-center justify-center px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-md text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-600"
          >
            <FolderPlus className="h-4 w-4 mr-2" />
            Create New Repository
          </button>
        </div>
      </div>
    </div>
  );
};

export default SelectRepoModal;