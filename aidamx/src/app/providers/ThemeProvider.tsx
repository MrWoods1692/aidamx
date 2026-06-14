'use client';

import { ThemeProvider as NextThemesProvider } from 'next-themes';
import { ReactNode, useEffect, useState } from 'react';
import { applyThemeColor } from '../store/themeColorStore';

// 控制是否显示调试日志
const DEBUG_MODE = false;

// 安全的日志函数
const safeLog = (message: string, ...args: any[]) => {
  if (DEBUG_MODE) {
    console.log(message, ...args);
  }
};

interface ThemeProviderProps {
  children: ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const [mounted, setMounted] = useState(false);

  // 确保组件在客户端渲染完成后立即应用主题
  useEffect(() => {
    // 立即设置mounted状态
    setMounted(true);
    
    // 监听主题变化
    const observer = new MutationObserver(() => {
      // 当主题类变化时应用主题颜色
      applyThemeColor();
    });
    
    observer.observe(document.documentElement, { 
      attributes: true,
      attributeFilter: ['class']
    });
    
    // 清理函数
    return () => {
      observer.disconnect();
    };
  }, []);

  return (
    <NextThemesProvider 
      attribute="class"
      defaultTheme="light"
      enableSystem={false}
      disableTransitionOnChange={false}
      storageKey="theme"
    >
      {children}
    </NextThemesProvider>
  );
}

// 添加默认导出
export default ThemeProvider; 