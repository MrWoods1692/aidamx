'use client';

import { useEffect, useRef } from 'react';
import { FiAlertTriangle, FiX } from 'react-icons/fi';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  type?: 'danger' | 'warning' | 'info';
}

export default function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmText = '确认',
  cancelText = '取消',
  onConfirm,
  onCancel,
  type = 'danger'
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  
  // 处理键盘事件
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      
      if (e.key === 'Escape') {
        onCancel();
      } else if (e.key === 'Enter') {
        onConfirm();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onCancel, onConfirm]);
  
  // 处理点击外部关闭
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dialogRef.current && !dialogRef.current.contains(e.target as Node)) {
        onCancel();
      }
    };
    
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onCancel]);
  
  if (!isOpen) return null;
  
  // 根据类型确定颜色
  const getColorClasses = () => {
    switch (type) {
      case 'danger':
        return {
          icon: 'text-red-500',
          button: 'bg-red-500 hover:bg-red-600',
          border: 'border-red-200 dark:border-red-800'
        };
      case 'warning':
        return {
          icon: 'text-yellow-500',
          button: 'bg-yellow-500 hover:bg-yellow-600',
          border: 'border-yellow-200 dark:border-yellow-800'
        };
      case 'info':
      default:
        return {
          icon: 'text-[rgb(var(--primary-color))]',
          button: 'bg-[rgb(var(--primary-color))] hover:opacity-90',
          border: 'border-[rgb(var(--border-color))]'
        };
    }
  };
  
  const colors = getColorClasses();
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-fadeIn">
      <div 
        ref={dialogRef}
        className={`bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4 overflow-hidden border ${colors.border} animate-scaleIn`}
        style={{animation: 'scale-in 0.2s ease-out'}}
      >
        <div className="flex justify-between items-center p-4 border-b border-[rgb(var(--border-color))]">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
            <FiAlertTriangle className={`mr-2 ${colors.icon}`} />
            {title}
          </h3>
        </div>
        
        <div className="p-6">
          <p className="text-gray-700 dark:text-gray-300">{message}</p>
        </div>
        
        <div className="flex justify-end gap-3 px-6 py-4 bg-gray-50 dark:bg-gray-700/30">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 text-sm font-medium text-white rounded-md transition-colors ${colors.button}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

// 添加CSS动画
const style = document.createElement('style');
style.textContent = `
  @keyframes scale-in {
    0% { transform: scale(0.95); opacity: 0; }
    100% { transform: scale(1); opacity: 1; }
  }
  @keyframes fade-in {
    0% { opacity: 0; }
    100% { opacity: 1; }
  }
  .animate-fadeIn {
    animation: fade-in 0.2s ease-out;
  }
  .animate-scaleIn {
    animation: scale-in 0.2s ease-out;
  }
`;
if (typeof document !== 'undefined') {
  document.head.appendChild(style);
} 