'use client';

import React, { ReactNode, useEffect } from 'react';
import ThemeProvider from './ThemeProvider';
import I18nProvider from './I18nProvider';
import { applyThemeColor } from '../store/themeColorStore';

interface ProvidersProps {
  children: ReactNode;
}

function Providers({ children }: ProvidersProps) {
  // 确保在客户端渲染时应用主题颜色
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // 等待DOM完全加载
      if (document.readyState === 'complete') {
        applyThemeColor();
      } else {
        window.addEventListener('load', () => {
          applyThemeColor();
        });
      }
      
      // 也可以在首次渲染后应用一次
      const timeout = setTimeout(() => {
        applyThemeColor();
      }, 100);
      
      return () => clearTimeout(timeout);
    }
  }, []);
  
  return (
    <ThemeProvider>
      <I18nProvider>
        {children}
      </I18nProvider>
    </ThemeProvider>
  );
}

export { ThemeProvider, I18nProvider, Providers };
export default Providers; 