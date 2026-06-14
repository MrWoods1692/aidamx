import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Theme = 'light' | 'dark';

interface ThemeState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

// 创建主题状态管理
export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      theme: 'light', // 默认主题
      setTheme: (theme: Theme) => set({ theme }),
      toggleTheme: () => set((state) => ({ theme: state.theme === 'light' ? 'dark' : 'light' })),
    }),
    {
      name: 'theme-storage', // localStorage的键名
    }
  )
);

// 用于在组件中应用主题的工具函数
export function useTheme() {
  const { theme, setTheme, toggleTheme } = useThemeStore();
  
  // 在客户端应用主题
  if (typeof window !== 'undefined') {
    document.documentElement.setAttribute('data-theme', theme);
    
    // 处理系统主题变化
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addEventListener('change', (e) => {
      const newTheme = e.matches ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', newTheme);
    });
  }
  
  return { theme, setTheme, toggleTheme };
} 