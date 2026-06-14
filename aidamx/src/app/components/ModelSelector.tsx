'use client';

import { useState } from 'react';
import { FiChevronDown } from 'react-icons/fi';

interface Model {
  id: string;
  name: string;
  icon: string;
}

interface ModelSelectorProps {
  models: Model[];
  selectedModel: Model | null;
  onSelect: (model: Model) => void;
}

export default function ModelSelector({ models, selectedModel, onSelect }: ModelSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 px-4 py-2 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
      >
        {selectedModel ? (
          <>
            <img 
              src={selectedModel.icon} 
              alt={selectedModel.name} 
              className="w-6 h-6 rounded-full"
            />
            <span className="text-sm font-medium text-gray-900 dark:text-white">
              {selectedModel.name}
            </span>
          </>
        ) : (
          <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
            选择模型
          </span>
        )}
        <FiChevronDown className="w-4 h-4 text-gray-500 dark:text-gray-400" />
      </button>
      
      {isOpen && (
        <div className="absolute z-50 mt-1 w-64 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
          <div className="py-1">
            {models.map((model) => (
              <button
                key={model.id}
                onClick={() => {
                  onSelect(model);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center space-x-3 px-4 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${
                  selectedModel?.id === model.id ? 'bg-gray-50 dark:bg-gray-700' : ''
                }`}
              >
                <img 
                  src={model.icon} 
                  alt={model.name} 
                  className="w-6 h-6 rounded-full"
                />
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {model.name}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
} 