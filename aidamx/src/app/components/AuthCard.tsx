'use client';

import { useState, useEffect } from 'react';
import { LoginForm } from '@/app/components/LoginForm';
import { RegisterForm } from '@/app/components/RegisterForm';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useTranslation } from '@/app/i18n';

export default function AuthCard() {
  const [isLogin, setIsLogin] = useState(true);
  const router = useRouter();
  const { t } = useTranslation();
  
  // 切换登录/注册状态
  const toggleAuthMode = () => {
    setIsLogin(!isLogin);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-100 via-indigo-100 to-purple-100 dark:from-gray-900 dark:via-indigo-950 dark:to-purple-900 p-4">
      <motion.div 
        className="w-full max-w-4xl h-[620px] bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden flex"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        {/* 左侧内容 */}
        <AnimatePresence mode="wait">
          {isLogin ? (
            <motion.div 
              key="login-image"
              className="w-1/2 relative hidden md:block"
              initial={{ x: '-100%', opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: '-100%', opacity: 0 }}
              transition={{ duration: 0.5, ease: "easeInOut" }}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-600 flex flex-col items-center justify-center p-12 text-white">
                <Image 
                  src="/images/login-illustration.svg" 
                  alt={t('auth.login')}
                  width={300}
                  height={300}
                  className="mb-8"
                />
                <h2 className="text-2xl font-bold mb-4 text-center">{t('auth.welcomeBack')}</h2>
                <p className="text-center text-white/80 mb-8">{t('auth.loginDescription')}</p>
                <div className="flex gap-4">
                  <button 
                    onClick={() => router.push('/')}
                    className="px-6 py-2 bg-white/20 text-white border border-white/30 backdrop-blur-sm rounded-lg font-medium hover:bg-white/30 transition-colors"
                  >
                    {t('auth.backToHome')}
                  </button>
                  <button 
                    onClick={toggleAuthMode}
                    className="px-6 py-2 bg-white text-indigo-600 rounded-lg font-medium hover:bg-white/90 transition-colors"
                  >
                    {t('auth.createNewAccount')}
                  </button>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div 
              key="register-form"
              className="w-1/2 relative"
              initial={{ x: '100%', opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: '100%', opacity: 0 }}
              transition={{ duration: 0.5, ease: "easeInOut" }}
            >
              <RegisterForm onToggleMode={toggleAuthMode} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* 右侧内容 */}
        <AnimatePresence mode="wait">
          {isLogin ? (
            <motion.div 
              key="login-form"
              className="w-full md:w-1/2 relative"
              initial={{ x: '100%', opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: '100%', opacity: 0 }}
              transition={{ duration: 0.5, ease: "easeInOut" }}
            >
              <LoginForm onToggleMode={toggleAuthMode} />
            </motion.div>
          ) : (
            <motion.div 
              key="register-image"
              className="w-1/2 relative hidden md:block"
              initial={{ x: '-100%', opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: '-100%', opacity: 0 }}
              transition={{ duration: 0.5, ease: "easeInOut" }}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-purple-500 via-pink-500 to-rose-500 flex flex-col items-center justify-center p-12 text-white">
                <Image 
                  src="/images/register-illustration.svg" 
                  alt={t('auth.register')}
                  width={300}
                  height={300}
                  className="mb-8"
                />
                <h2 className="text-2xl font-bold mb-4 text-center">{t('auth.createAccount')}</h2>
                <p className="text-center text-white/80 mb-8">{t('auth.registerDescription')}</p>
                <div className="flex gap-4">
                  <button 
                    onClick={() => router.push('/')}
                    className="px-6 py-2 bg-white/20 text-white border border-white/30 backdrop-blur-sm rounded-lg font-medium hover:bg-white/30 transition-colors"
                  >
                    {t('auth.backToHome')}
                  </button>
                  <button 
                    onClick={toggleAuthMode}
                    className="px-6 py-2 bg-white text-pink-600 rounded-lg font-medium hover:bg-white/90 transition-colors"
                  >
                    {t('auth.backToLogin')}
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
} 