'use client';

import { useTheme } from 'next-themes';
import { useI18n } from '../providers/I18nProvider';
import { Locale, useI18nStore } from '../i18n';
import { FiSun, FiMoon, FiGlobe, FiMenu, FiUser, FiLogOut, FiSettings, FiGrid } from 'react-icons/fi';
import { useEffect, useState, useRef } from 'react';
import Image from 'next/image';
import { useSidebarStore } from './Sidebar';
import Link from 'next/link';

// 创建用户状态存储
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface UserState {
  isLoggedIn: boolean;
  user: {
    id?: string;
    email?: string;
    name?: string;
    avatar?: string;
  } | null;
  login: (userData: any) => void;
  logout: () => void;
}

export const useUserStore = create<UserState>()(
  persist(
    (set) => ({
      isLoggedIn: false,
      user: null,
      login: (userData) => set({ isLoggedIn: true, user: userData }),
      logout: () => set({ isLoggedIn: false, user: null }),
    }),
    {
      name: 'user-storage',
    }
  )
);

export default function Navbar() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const { t } = useI18n();
  const { languages, setLocale, locale } = useI18nStore();
  const [mounted, setMounted] = useState(false);
  const [languageMenuOpen, setLanguageMenuOpen] = useState(false);
  const { 
    isOpen, 
    toggle: toggleSidebar, 
    toggleSmallSidebar, 
    isMobileView,
    closeWithAnimation,
    closeSmallWithAnimation
  } = useSidebarStore();
  
  // 用户状态
  const { isLoggedIn, user, logout } = useUserStore();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  
  // 确保组件在客户端渲染完成后才开始工作
  useEffect(() => {
    setMounted(true);

    // 监听主题颜色变化事件
    const handleThemeColorChange = () => {
      // 强制刷新导航栏背景色
      const navbar = document.querySelector('.navbar');
      if (navbar instanceof HTMLElement) {
        // 应用当前计算样式并触发重绘
        const computedStyle = getComputedStyle(document.documentElement);
        const cardBg = computedStyle.getPropertyValue('--card-bg').trim();
        navbar.style.backgroundColor = `rgb(${cardBg})`;
        
        // 记录调试信息
        console.log('导航栏样式已更新', 
          navbar.style.backgroundColor, 
          '卡片背景色:', `rgb(${cardBg})`
        );
      }
    };

    window.addEventListener('themecolorchange', handleThemeColorChange);
    
    // 点击外部关闭用户菜单
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    
    return () => {
      window.removeEventListener('themecolorchange', handleThemeColorChange);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);
  
  // 优化主题切换，确保同步变化
  const toggleTheme = () => {
    // 临时去除过渡效果，然后立即添加回来
    document.documentElement.classList.add('no-transition');
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
    
    // 使用requestAnimationFrame确保DOM更新后再恢复过渡效果
    window.requestAnimationFrame(() => {
      document.documentElement.classList.remove('no-transition');
    });
  };
  
  const changeLanguage = (newLocale: Locale) => {
    setLocale(newLocale);
    setLanguageMenuOpen(false);
  };
  
  // 在客户端水合前显示的语言名称
  const getCurrentLanguageName = () => {
    const currentLang = languages.find(lang => lang.code === locale);
    return currentLang ? currentLang.name : '简体中文';
  };

  // 处理用户退出登录
  const handleLogout = async () => {
    try {
      // 调用登出API清除服务器端cookie
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (response.ok) {
        // 清除客户端状态
        logout();
        setUserMenuOpen(false);
        // 重定向到首页
        window.location.href = '/';
      }
    } catch (error) {
      console.error('登出失败:', error);
      // 即使API调用失败，也清除本地状态
      logout();
      window.location.href = '/';
    }
  };

  // 使用相同的HTML结构，但内容根据mounted状态有条件地渲染
  // 这样可以避免两个完全不同结构的DOM树在水合时导致的布局跳动
  return (
    <div 
      className="navbar h-[64px]" 
      style={{ 
        backgroundColor: 'rgb(var(--card-bg))',
        borderBottomColor: 'rgb(var(--border-color))',
        transition: 'background-color 0.3s ease, border-color 0.3s ease' // 添加过渡动画
      }}
      id="main-navbar" // 添加ID方便调试和选择
    >
      <div className="flex items-center gap-3">
        {/* 在移动端，调整布局顺序：Logo 在最左侧 */}
        <Image 
          src="/images/biaotilogo.png" 
          alt={mounted ? t('app.title') : 'Logo'} 
          width={32} 
          height={32} 
          className="rounded-md"
        />
        
        {/* 只在非移动端显示标题 */}
        {mounted && !isMobileView && (
          <span className="text-xl font-semibold">{t('app.title')}</span>
        )}
        {!mounted && (
          <span className="text-xl font-semibold">Code Assistant</span>
        )}
        
        {/* 移动端侧边栏汉堡菜单按钮 */}
        {mounted && isMobileView && (
          <div className="flex gap-2">
            {/* 小侧边栏汉堡菜单 */}
            <button 
              className="p-1.5 rounded-md hover:bg-[rgba(var(--primary-color),0.1)] text-[rgb(var(--primary-color))] flex items-center justify-center"
              onClick={toggleSmallSidebar}
              aria-label="小侧边栏"
            >
              <FiGrid size={18} />
            </button>
            
            {/* 大侧边栏汉堡菜单 */}
            <button 
              className="p-1.5 rounded-md hover:bg-[rgba(var(--primary-color),0.1)] text-[rgb(var(--primary-color))] flex items-center justify-center"
              onClick={toggleSidebar}
              aria-label="大侧边栏"
            >
              <FiMenu size={20} />
            </button>
          </div>
        )}
        
        {/* 桌面端侧边栏切换按钮 */}
        {mounted && !isMobileView && (
          <button 
            className="p-1.5 rounded-md hover:bg-[rgba(var(--primary-color),0.1)] text-[rgb(var(--primary-color))] flex items-center justify-center"
            onClick={toggleSidebar}
            aria-label={isOpen ? "收起侧边栏" : "展开侧边栏"}
          >
            <FiMenu size={20} />
          </button>
        )}
      </div>
      
      <div className="flex items-center gap-4">
        {/* 语言切换 */}
        <div className="relative">
          <button 
            className="flex items-center gap-1 text-sm text-[rgb(var(--text-secondary))] hover:text-[rgb(var(--primary-color))] p-2 rounded"
            onClick={mounted ? () => setLanguageMenuOpen(!languageMenuOpen) : undefined}
            onMouseEnter={mounted ? () => setLanguageMenuOpen(true) : undefined}
          >
            <FiGlobe className="text-lg" />
            <span className="min-w-[3rem] text-left hidden md:inline">{getCurrentLanguageName()}</span>
          </button>
          
          {mounted && languageMenuOpen && (
            <div 
              className="absolute left-0 top-full mt-1 rounded-md shadow-lg z-50 border border-[rgb(var(--border-color))] min-w-[8rem]"
              style={{ backgroundColor: 'rgb(var(--card-bg))' }}
              onMouseLeave={() => setLanguageMenuOpen(false)}
            >
              {languages.map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => changeLanguage(lang.code)}
                  className={`block w-full text-left px-4 py-2 text-sm whitespace-nowrap hover:bg-[rgba(var(--primary-color),0.1)] ${
                    locale === lang.code ? 'text-[rgb(var(--primary-color))]' : ''
                  }`}
                >
                  {lang.name}
                </button>
              ))}
            </div>
          )}
        </div>
        
        {/* 主题切换 */}
        <button
          onClick={mounted ? toggleTheme : undefined}
          className="p-2 rounded-full hover:bg-[rgba(var(--primary-color),0.1)] text-[rgb(var(--text-secondary))] transition-colors"
          aria-label={mounted ? (resolvedTheme === 'dark' ? t('app.theme.light') : t('app.theme.dark')) : '主题切换'}
        >
          {mounted && resolvedTheme === 'dark' ? (
            <FiSun className="text-lg text-[rgb(var(--primary-color))]" />
          ) : (
            <FiMoon className="text-lg" />
          )}
        </button>
        
        {/* 登录按钮或用户头像 - 移到最右边 */}
        {mounted && !isLoggedIn ? (
          <Link 
            href="/login" 
            className="flex items-center gap-1 text-sm bg-[rgb(var(--primary-color))] text-white py-1.5 px-3 rounded-md hover:opacity-90 transition-opacity"
          >
            <FiUser className="text-lg" />
            <span>登录</span>
          </Link>
        ) : mounted && isLoggedIn ? (
          <div className="relative" ref={userMenuRef}>
            <button 
              className="flex items-center gap-2 cursor-pointer"
              onClick={() => setUserMenuOpen(!userMenuOpen)}
            >
              <div className="w-8 h-8 rounded-full overflow-hidden border-2 border-[rgb(var(--primary-color))]">
                <Image 
                  src={user?.avatar || '/images/default-avatar.png'} 
                  alt="User Avatar" 
                  width={32} 
                  height={32}
                  className="object-cover w-full h-full"
                />
              </div>
              <span className="text-sm hidden md:inline">{user?.name || user?.email || '用户'}</span>
            </button>
            
            {userMenuOpen && (
              <div 
                className="absolute right-0 top-full mt-1 rounded-md shadow-lg z-50 border border-[rgb(var(--border-color))] min-w-[160px] py-1"
                style={{ backgroundColor: 'rgb(var(--card-bg))' }}
              >
                <Link
                  href="/profile"
                  className="flex items-center gap-2 px-4 py-2 text-sm hover:bg-[rgba(var(--primary-color),0.1)]"
                  onClick={() => setUserMenuOpen(false)}
                >
                  <FiUser className="text-[rgb(var(--text-secondary))]" />
                  <span>个人中心</span>
                </Link>
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-2 px-4 py-2 text-sm hover:bg-[rgba(var(--primary-color),0.1)] w-full text-left"
                >
                  <FiLogOut className="text-[rgb(var(--text-secondary))]" />
                  <span>退出登录</span>
                </button>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
} 