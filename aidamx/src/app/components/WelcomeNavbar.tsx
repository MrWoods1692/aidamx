'use client';

import { useTheme } from 'next-themes';
import { useI18n } from '../providers/I18nProvider';
import { useI18nStore } from '../i18n';
import { FiSun, FiMoon, FiGlobe, FiUser, FiLogOut } from 'react-icons/fi';
import { useEffect, useState, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useUserStore } from './Navbar';

export default function WelcomeNavbar() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const { t } = useI18n();
  const { languages, setLocale, locale } = useI18nStore();
  const [mounted, setMounted] = useState(false);
  const [languageMenuOpen, setLanguageMenuOpen] = useState(false);
  
  // 用户状态
  const { isLoggedIn, user, logout } = useUserStore();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  
  // 确保组件在客户端渲染完成后才开始工作
  useEffect(() => {
    setMounted(true);
    
    // 点击外部关闭用户菜单
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    
    return () => {
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
  
  const changeLanguage = (newLocale: string) => {
    setLocale(newLocale as any);
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
        window.location.href = '/';
      }
    } catch (error) {
      console.error('登出失败:', error);
      // 即使API调用失败，也清除本地状态
      logout();
      window.location.href = '/';
    }
  };

  return (
    <div 
      className="welcome-navbar"
      style={{ 
        backgroundColor: 'transparent', 
        backdropFilter: 'none',
        boxShadow: 'none',
        borderBottom: 'none',
        position: 'absolute',
        width: '100%',
        zIndex: 10
      }}
    >
      <div className="flex items-center gap-3">
        <Image 
          src="/images/biaotilogo.png" 
          alt={mounted ? t('app.title') : 'Logo'} 
          width={32} 
          height={32} 
          className="rounded-md"
        />
        <span className="text-xl font-semibold text-black hidden md:inline">{mounted ? t('app.title') : 'Code Assistant'}</span>
        {/* 汉堡菜单按钮已移除 */}
      </div>
      
      <div className="flex items-center gap-4">
        {/* 语言切换 */}
        <div className="relative">
          <button 
            className="flex items-center gap-1 text-sm text-black hover:text-[rgb(var(--primary-color))] p-2 rounded"
            onClick={mounted ? () => setLanguageMenuOpen(!languageMenuOpen) : undefined}
            onMouseEnter={mounted ? () => setLanguageMenuOpen(true) : undefined}
          >
            <FiGlobe className="text-lg" />
            <span className="whitespace-nowrap text-left">{getCurrentLanguageName()}</span>
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
        
        {/* 登录按钮或用户头像 */}
        {mounted && !isLoggedIn ? (
          <Link 
            href="/login" 
            className="flex items-center gap-1 text-sm bg-[rgb(var(--primary-color))] text-white py-1.5 px-3 rounded-md hover:opacity-90 transition-opacity"
          >
            <FiUser className="text-lg" />
            <span>{t('auth.login')}</span>
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
              <span className="text-sm hidden md:inline text-black">{user?.name || user?.email || t('auth.login')}</span>
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
                  <span>{t('sidebar.profile')}</span>
                </Link>
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-2 px-4 py-2 text-sm hover:bg-[rgba(var(--primary-color),0.1)] w-full text-left"
                >
                  <FiLogOut className="text-[rgb(var(--text-secondary))]" />
                  <span>{locale.startsWith('zh') ? '退出登录' : t('auth.logout')}</span>
                </button>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
} 