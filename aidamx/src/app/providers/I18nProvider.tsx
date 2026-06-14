'use client';

import { ReactNode, createContext, useContext, useState, useEffect } from 'react';
import { Locale, useI18nStore } from '../i18n';

// 预加载所有语言文件以避免切换时的延迟
import zhCN from '../i18n/locales/zh-CN.json';
import zhTW from '../i18n/locales/zh-TW.json';
import en from '../i18n/locales/en.json';

interface I18nContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string) => string;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

interface I18nProviderProps {
  children: ReactNode;
}

// 默认的翻译数据
const defaultTranslations = {
  'zh-CN': zhCN,
  'zh-TW': zhTW,
  'en': en
};

export function I18nProvider({ children }: I18nProviderProps) {
  const { locale, setLocale } = useI18nStore();
  const [mounted, setMounted] = useState(false);
  
  // 使用默认翻译数据而不是异步加载，避免闪烁
  const [translations, setTranslations] = useState(defaultTranslations[locale] || defaultTranslations['zh-CN']);

  useEffect(() => {
    setMounted(true);
    
    // 当语言切换时更新翻译
    setTranslations(defaultTranslations[locale] || defaultTranslations['zh-CN']);
    
    // 当语言切换时派发事件
    if (typeof window !== 'undefined' && mounted) {
      const event = new CustomEvent('languagechange', { detail: { locale } });
      window.dispatchEvent(event);
      
      // 确保更新全局样式
      document.documentElement.setAttribute('lang', locale);
      
      // 触发主题切换事件以重新应用颜色
      const themeEvent = new CustomEvent('themechange', {});
      window.dispatchEvent(themeEvent);
    }
  }, [locale, mounted]);

  // 翻译函数
  const t = (key: string): string => {
    try {
      // 支持嵌套的键，如 "app.title"
      const result = key.split('.').reduce<any>((obj, k) => obj && obj[k], translations);
      return typeof result === 'string' ? result : key;
    } catch (error) {
      console.error(`Translation error: ${error}`);
      return key;
    }
  };

  // 使用预渲染的中文内容
  if (!mounted) {
    // 即使在客户端水合前也显示中文
    const preRenderT = (key: string): string => {
      try {
        const result = key.split('.').reduce<any>((obj, k) => obj && obj[k], defaultTranslations['zh-CN']);
        return typeof result === 'string' ? result : key;
      } catch (error) {
        return key;
      }
    };
    
    return (
      <I18nContext.Provider value={{ locale: 'zh-CN', setLocale, t: preRenderT }}>
        {children}
      </I18nContext.Provider>
    );
  }

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  );
}

// 自定义钩子，供组件使用
export function useI18n() {
  const context = useContext(I18nContext);
  if (context === undefined) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
}

// 添加默认导出
export default I18nProvider; 