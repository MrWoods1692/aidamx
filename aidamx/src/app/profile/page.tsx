'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { FiUser, FiMail, FiCalendar, FiUpload, FiHome, FiGlobe, FiSun, FiMoon, FiMessageCircle } from 'react-icons/fi';
import { useUserStore } from '../components/Navbar';
import Image from 'next/image';
import Link from 'next/link';
import { useTheme } from 'next-themes';
import { useI18n } from '../providers/I18nProvider';
import { Locale, useI18nStore } from '../i18n';

// 用户类型
interface User {
  id?: string;
  email?: string;
  name?: string;
  avatar?: string;
  createdAt?: string;
}

export default function ProfilePage() {
  const router = useRouter();
  const { isLoggedIn, user, login, logout } = useUserStore();
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme, resolvedTheme } = useTheme();
  const { t } = useI18n();
  const { languages, setLocale, locale } = useI18nStore();
  const [languageMenuOpen, setLanguageMenuOpen] = useState(false);
  
  // 用户信息
  const [userName, setUserName] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  
  useEffect(() => {
    setMounted(true);
    
    // 如果用户未登录，重定向到登录页
    if (mounted && !isLoggedIn) {
      router.push('/login');
      return;
    }
    
    // 填充用户信息
    if (mounted && user) {
      setUserName(user.name || '');
    }
  }, [mounted, isLoggedIn, user, router]);
  
  // 如果尚未加载，显示加载中
  if (!mounted || !isLoggedIn) {
    return null;
  }
  
  // 更新用户信息
  const updateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setIsUpdating(true);
      setSuccessMsg('');
      setErrorMsg('');
      
      // 发送更新请求
      const response = await fetch('/api/user/update', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: userName,
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || '更新失败');
      }
      
      // 更新本地用户信息
      login({
        ...user,
        name: userName,
      });
      
      setSuccessMsg(t('common.success'));
      
    } catch (error: any) {
      setErrorMsg(error.message || '更新失败，请稍后重试');
    } finally {
      setIsUpdating(false);
    }
  };
  
  const formatDate = (dateString?: string) => {
    if (!dateString) return '未知';
    
    const date = new Date(dateString);
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  // 切换主题
  const toggleTheme = () => {
    document.documentElement.classList.add('no-transition');
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
    
    window.requestAnimationFrame(() => {
      document.documentElement.classList.remove('no-transition');
    });
  };

  // 切换语言
  const changeLanguage = (newLocale: Locale) => {
    setLocale(newLocale);
    setLanguageMenuOpen(false);
  };

  // 获取当前语言名称
  const getCurrentLanguageName = () => {
    const currentLang = languages.find(lang => lang.code === locale);
    return currentLang ? currentLang.name : '简体中文';
  };
  
  // 修复类型错误，将user断言为User类型
  const userInfo = user as User;
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-500/10 via-indigo-500/10 to-purple-500/10 dark:from-blue-900 dark:via-indigo-900 dark:to-purple-900 overflow-hidden">
      {/* 导航栏 - 改为透明 */}
      <header className="fixed top-0 left-0 right-0 h-16 z-10 bg-transparent backdrop-blur-sm">
        <div className="max-w-full mx-auto px-2 md:px-4 h-full flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Image 
              src="/images/biaotilogo.png"
              alt={t('app.title')}
              width={32}
              height={32}
              className="rounded-md"
            />
            <span className="text-xl font-semibold text-gray-800 dark:text-white">{t('app.title')}</span>
            
            {/* 返回聊天按钮 */}
            <Link
              href="/chat"
              className="flex items-center gap-1 ml-3 text-sm text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 p-2 rounded"
            >
              <FiMessageCircle className="text-lg" />
              <span className="whitespace-nowrap">{t('sidebar.conversations')}</span>
            </Link>
          </div>
          
          <div className="flex items-center gap-4">
            {/* 语言切换 */}
            <div className="relative">
              <button 
                className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 p-2 rounded"
                onClick={() => setLanguageMenuOpen(!languageMenuOpen)}
              >
                <FiGlobe className="text-lg" />
                <span className="whitespace-nowrap text-left">{getCurrentLanguageName()}</span>
              </button>
              
              {languageMenuOpen && (
                <div 
                  className="absolute right-0 top-full mt-1 rounded-md shadow-lg z-50 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 min-w-[8rem]"
                >
                  {languages.map((lang) => (
                    <button
                      key={lang.code}
                      onClick={() => changeLanguage(lang.code)}
                      className={`block w-full text-left px-4 py-2 text-sm whitespace-nowrap hover:bg-gray-100 dark:hover:bg-gray-700 ${
                        locale === lang.code ? 'text-blue-600 dark:text-blue-400' : 'text-gray-700 dark:text-gray-300'
                      }`}
                    >
                      {lang.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </header>
      
      {/* 页面内容 */}
      <main className="pt-28 pb-12 px-4 bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-900 dark:via-indigo-950 dark:to-purple-900 min-h-screen">
        <div className="max-w-4xl mx-auto">
          {/* 个人资料卡片 - 使用CSS变量让卡片颜色随主题变化 */}
          <div className="rounded-xl shadow-lg overflow-hidden border border-[rgb(var(--border-color))] mb-6" 
               style={{ backgroundColor: 'rgb(var(--card-bg))' }}>
            <div className="px-6 pt-8 pb-8">
            <div className="flex flex-col md:flex-row gap-8">
                {/* 左侧头像与基本信息 */}
              <div className="w-full md:w-1/3 flex flex-col items-center">
                  <div className="relative w-24 h-24 mb-4">
                    <div className="w-full h-full rounded-full overflow-hidden border-4 border-white dark:border-gray-800 bg-white dark:bg-gray-700 shadow-md">
                    <Image
                      src={user?.avatar || '/images/default-avatar.png'}
                      alt="头像"
                        width={96}
                        height={96}
                      className="object-cover w-full h-full"
                    />
                  </div>
                </div>
                
                  <h2 className="text-xl font-semibold mb-2 text-[rgb(var(--text-primary))]">{userName || user?.email || t('app.title')}</h2>
                <p className="text-[rgb(var(--text-secondary))] mb-6 text-center">{user?.email}</p>
                
                  <div className="w-full p-4 rounded-lg" style={{ backgroundColor: 'rgb(var(--bg-secondary))' }}>
                  <div className="flex items-center mb-3">
                    <FiMail className="mr-2 text-[rgb(var(--text-secondary))]" />
                      <span className="text-sm text-[rgb(var(--text-primary))]">{t('auth.email')}: {user?.email}</span>
                  </div>
                  <div className="flex items-center">
                    <FiCalendar className="mr-2 text-[rgb(var(--text-secondary))]" />
                      <span className="text-sm text-[rgb(var(--text-primary))]">{t('profile.registerTime')}: {formatDate(userInfo.createdAt)}</span>
                  </div>
                </div>
              </div>
              
              {/* 右侧表单 */}
              <div className="w-full md:w-2/3">
                  <h3 className="text-xl font-semibold mb-6 text-[rgb(var(--text-primary))]">{t('sidebar.profile')}</h3>
                  
                {successMsg && (
                  <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 rounded-lg text-sm">
                    {successMsg}
                  </div>
                )}
                
                {errorMsg && (
                  <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg text-sm">
                    {errorMsg}
                  </div>
                )}
                
                <form onSubmit={updateProfile}>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-[rgb(var(--text-secondary))] mb-1" htmlFor="name">
                        {t('profile.username')}
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <FiUser className="text-[rgb(var(--text-secondary))]" />
                      </div>
                      <input
                        id="name"
                        type="text"
                        placeholder="设置您的用户名"
                        value={userName}
                        onChange={(e) => setUserName(e.target.value)}
                        className="block w-full pl-10 pr-3 py-2 border border-[rgb(var(--border-color))] rounded-md bg-[rgb(var(--input-bg))] text-[rgb(var(--text-primary))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--primary-color))] focus:border-[rgb(var(--primary-color))] transition-colors"
                      />
                    </div>
                  </div>
                  
                  <button
                    type="submit"
                    disabled={isUpdating}
                      className="py-2.5 px-6 bg-[rgb(var(--primary-color))] text-white rounded-md text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-70"
                  >
                      {isUpdating ? t('profile.updating') : t('profile.updateProfile')}
                  </button>
                </form>
                
                <div className="mt-8 pt-6 border-t border-[rgb(var(--border-color))]">
                    <h3 className="text-lg font-medium mb-4 text-[rgb(var(--text-primary))]">{t('profile.accountSecurity')}</h3>
                  
                  <button
                    onClick={() => {
                      logout();
                      // 使用更直接的方式重定向到首页
                      window.location.href = '/';
                    }}
                      className="py-2.5 px-6 bg-red-500 text-white rounded-md text-sm font-medium hover:opacity-90 transition-opacity"
                  >
                      {t('app.logout')}
                  </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
} 