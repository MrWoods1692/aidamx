import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Locale = 'zh-CN' | 'zh-TW' | 'en';

type Language = {
  code: Locale;
  name: string;
};

interface I18nState {
  locale: Locale;
  languages: Language[];
  setLocale: (locale: Locale) => void;
}

// 定义可用的语言
const languages: Language[] = [
  { code: 'zh-CN', name: '简体中文' },
  { code: 'zh-TW', name: '繁體中文' },
  { code: 'en', name: 'English' },
];

// 检测浏览器语言
const detectBrowserLanguage = (): Locale => {
  if (typeof window === 'undefined') {
    return 'zh-CN'; // 服务器端默认使用简体中文
  }
  
  const browserLang = navigator.language;
  
  if (browserLang.startsWith('zh-TW') || browserLang.startsWith('zh-HK')) {
    return 'zh-TW';
  } else if (browserLang.startsWith('zh')) {
    return 'zh-CN';
  } else {
    return 'zh-CN'; // 其他语言默认使用简体中文
  }
};

// 创建I18n状态管理并持久化
export const useI18nStore = create<I18nState>()(
  persist(
    (set) => ({
      locale: detectBrowserLanguage(), // 基于浏览器语言的智能默认值
      languages,
      setLocale: (locale: Locale) => set({ locale }),
    }),
    {
      name: 'language-preference', // localStorage存储键名
    }
  )
);

// 用于获取翻译内容的工具函数
export function useTranslation() {
  const { locale } = useI18nStore();
  
  const t = (key: string) => {
    try {
      // 预加载常用语言文件以避免动态导入延迟
      let messages;
      
      switch (locale) {
        case 'zh-CN':
          messages = require('./locales/zh-CN.json');
          break;
        case 'zh-TW':
          messages = require('./locales/zh-TW.json');
          break;
        case 'en':
          messages = require('./locales/en.json');
          break;
        default:
          messages = require('./locales/zh-CN.json');
      }
      
      // 支持嵌套的键，如 "app.title"
      const result = key.split('.').reduce((obj, k) => obj && obj[k], messages);
      return typeof result === 'string' ? result : key;
    } catch (error) {
      console.error(`Translation error: ${error}`);
      return key;
    }
  };
  
  return { t, locale };
} 