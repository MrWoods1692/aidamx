'use client';

import { useState, useEffect, useRef } from 'react';
import { useThemeColorStore, applyThemeColor } from '../store/themeColorStore';
import { CSSProperties } from 'react';

interface ThemeColorPickerProps {
  isOpen: boolean;
  onClose: () => void;
  buttonRef: React.RefObject<HTMLButtonElement>;
}

export default function ThemeColorPicker({ isOpen, onClose, buttonRef }: ThemeColorPickerProps) {
  const { colors, currentColorId, setCurrentColorId } = useThemeColorStore();
  const [mounted, setMounted] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  
  // 确保组件在客户端渲染完成后才工作
  useEffect(() => {
    setMounted(true);
  }, []);
  
  // 处理点击外部关闭面板
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        panelRef.current && 
        !panelRef.current.contains(event.target as Node) &&
        buttonRef.current && 
        !buttonRef.current.contains(event.target as Node)
      ) {
        onClose();
      }
    };
    
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose, buttonRef]);
  
  // 选择颜色主题
  const handleSelectColor = (colorId: string) => {
    setCurrentColorId(colorId);
    
    // 立即应用颜色并触发重绘
    setTimeout(() => {
      // 应用颜色
      applyThemeColor();
      
      // 触发自定义事件，通知颜色已更改
      const event = new CustomEvent('themecolorchange', { detail: { colorId } });
      window.dispatchEvent(event);
      
      // 触发窗口resize事件，帮助某些组件刷新
      window.dispatchEvent(new Event('resize'));
      
      // 关闭选择器
      onClose();
    }, 0);
  };
  
  if (!mounted || !isOpen) return null;
  
  // 仅显示前6种颜色
  const displayColors = colors.slice(0, 6);
  
  // 计算面板位置
  const getPosition = (): CSSProperties => {
    if (!buttonRef.current) return {};
    
    const buttonRect = buttonRef.current.getBoundingClientRect();
    return {
      position: 'fixed',
      top: `${buttonRect.top}px`,
      left: `${buttonRect.right + 5}px`,
    };
  };
  
  return (
    <div 
      ref={panelRef}
      className="z-50 rounded-lg shadow-lg p-2 w-auto"
      style={{ 
        backgroundColor: 'rgb(var(--card-bg))',
        border: '1px solid rgb(var(--border-color))',
        ...getPosition()
      }}
    >
      <div className="grid grid-cols-3 gap-2">
        {displayColors.map((color) => (
          <button
            key={color.id}
            className={`w-8 h-8 rounded-full flex items-center justify-center transition-transform ${
              currentColorId === color.id ? 'ring-2 ring-offset-1 scale-110' : ''
            } ${color.id === 'white' ? 'border border-gray-300' : ''}`}
            style={{ 
              backgroundColor: color.id === 'white' ? 'rgb(255, 255, 255)' : `rgb(${color.primary})`,
            }}
            onClick={() => handleSelectColor(color.id)}
            title={color.name}
          >
            {currentColorId === color.id && (
              <span className={`${color.id === 'white' ? 'text-blue-500' : 'text-white'} text-xs`}>✓</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
} 