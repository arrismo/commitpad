import React, { useState } from 'react';
import { useSettings } from '../../context/SettingsContext';
import { AppSettings } from '../../types';
import { X } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const { settings, updateSettings } = useSettings();
  const [formValues, setFormValues] = useState<AppSettings>(settings);
  
  if (!isOpen) return null;
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateSettings(formValues);
    onClose();
  };
  
  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value, type } = e.target;
    
    setFormValues(prev => ({
      ...prev,
      [name]: type === 'checkbox' 
        ? (e.target as HTMLInputElement).checked 
        : type === 'number' 
          ? Number(value) 
          : value,
    }));
  };
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-slate-700">
          <h2 className="text-lg font-medium text-slate-800 dark:text-white">Settings</h2>
          <button
            onClick={onClose}
            className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-4">
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Theme
            </label>
            <select
              name="theme"
              value={formValues.theme}
              onChange={handleChange}
              className="w-full rounded-md border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-600"
            >
              <option value="light">Light</option>
              <option value="dark">Dark</option>
              <option value="system">System</option>
            </select>
          </div>
          
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Font Size: {formValues.fontSize}px
            </label>
            <input
              type="range"
              name="fontSize"
              min="12"
              max="24"
              step="1"
              value={formValues.fontSize}
              onChange={handleChange}
              className="w-full"
            />
          </div>
          
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Line Spacing: {formValues.lineSpacing}
            </label>
            <input
              type="range"
              name="lineSpacing"
              min="1.2"
              max="2.5"
              step="0.1"
              value={formValues.lineSpacing}
              onChange={handleChange}
              className="w-full"
            />
          </div>
          
          <div className="mb-4 flex items-center">
            <input
              type="checkbox"
              id="autoSave"
              name="autoSave"
              checked={formValues.autoSave}
              onChange={handleChange}
              className="rounded border-gray-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500 dark:focus:ring-blue-600 h-4 w-4"
            />
            <label htmlFor="autoSave" className="ml-2 text-sm text-gray-700 dark:text-gray-300">
              Auto-save notes while typing
            </label>
          </div>
          
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Commit Message Template
            </label>
            <input
              type="text"
              name="commitMessageTemplate"
              value={formValues.commitMessageTemplate}
              onChange={handleChange}
              placeholder="Update note: {{title}}"
              className="w-full rounded-md border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-600"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Use {{title}} as a placeholder for the note title
            </p>
          </div>
          
          <div className="flex justify-end space-x-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-md text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-600"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 border border-transparent rounded-md text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-600"
            >
              Save Settings
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SettingsModal;