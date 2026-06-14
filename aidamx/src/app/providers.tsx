'use client';

import { ThemeProvider } from 'next-themes';
import { useEffect, useState } from 'react';
import { I18nProvider } from './providers/I18nProvider';

export default function Providers({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  
  // 等待客户端渲染完成
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <I18nProvider>
        {children}
      </I18nProvider>
    </ThemeProvider>
  );
} 