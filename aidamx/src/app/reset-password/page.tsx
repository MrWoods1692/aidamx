'use client';

import { useState, FormEvent, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { FiLock, FiArrowLeft, FiCheckCircle } from 'react-icons/fi';
import { useTranslation } from '@/app/i18n';
import { motion } from 'framer-motion';

export default function ResetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isValidating, setIsValidating] = useState(true);
  const [isTokenValid, setIsTokenValid] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const { t } = useTranslation();
  
  // 验证令牌
  useEffect(() => {
    const validateToken = async () => {
      if (!token) {
        setIsTokenValid(false);
        setIsValidating(false);
        setErrorMsg(t('auth.invalidToken'));
        return;
      }
      
      try {
        // 调用验证token的API
        const response = await fetch(`/api/auth/verify-token?token=${token}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });
        
        const data = await response.json();
        
        if (!response.ok || !data.isValid) {
          throw new Error(data.message || t('auth.invalidToken'));
        }
        
        setIsTokenValid(true);
      } catch (error: any) {
        setIsTokenValid(false);
        setErrorMsg(error.message || t('auth.invalidToken'));
      } finally {
        setIsValidating(false);
      }
    };
    
    validateToken();
  }, [token, t]);
  
  // 提交密码重置
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    
    if (!password || !confirmPassword) {
      setErrorMsg(t('auth.fillAllFields'));
      return;
    }
    
    if (password !== confirmPassword) {
      setErrorMsg(t('auth.passwordsDoNotMatch'));
      return;
    }
    
    try {
      setIsLoading(true);
      setErrorMsg('');
      
      // 调用密码重置API
      const response = await fetch('/api/auth/update-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          token, 
          password 
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || t('auth.resetFailed'));
      }
      
      setSuccessMsg(t('auth.passwordResetSuccessful'));
      
      // 5秒后重定向到登录页
      setTimeout(() => {
        router.push('/login');
      }, 5000);
      
    } catch (error: any) {
      setErrorMsg(error.message || t('auth.resetFailed'));
    } finally {
      setIsLoading(false);
    }
  };
  
  // 渲染重置密码表单
  const renderResetForm = () => {
    if (successMsg) {
      return (
        <div className="text-center p-8">
          <div className="text-green-500 dark:text-green-400 text-5xl mb-4">
            <FiCheckCircle className="mx-auto" />
          </div>
          <h3 className="text-xl font-bold text-[rgb(var(--text-primary))] mb-2">
            {t('auth.success')}
          </h3>
          <p className="text-[rgb(var(--text-secondary))] mb-6">
            {successMsg}
          </p>
          <p className="text-[rgb(var(--text-secondary))] text-sm">
            {t('auth.redirectingToLogin')}
          </p>
        </div>
      );
    }
    
    if (isValidating) {
      return (
        <div className="text-center p-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[rgb(var(--primary-color))] mx-auto mb-4"></div>
          <p className="text-[rgb(var(--text-secondary))]">{t('auth.validatingToken')}</p>
        </div>
      );
    }
    
    if (!isTokenValid) {
      return (
        <div className="text-center p-8">
          <div className="text-red-500 dark:text-red-400 text-5xl mb-4">
            <FiArrowLeft className="mx-auto" />
          </div>
          <h3 className="text-xl font-bold text-[rgb(var(--text-primary))] mb-2">
            {t('auth.invalidToken')}
          </h3>
          <p className="text-[rgb(var(--text-secondary))] mb-6">
            {errorMsg || t('auth.tokenExpiredOrInvalid')}
          </p>
          <button
            onClick={() => router.push('/login')}
            className="px-6 py-2.5 bg-[rgb(var(--primary-color))] text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
          >
            {t('auth.backToLogin')}
          </button>
        </div>
      );
    }
    
    return (
      <>
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-[rgb(var(--text-primary))]">
            {t('auth.resetPassword')}
          </h2>
          <p className="text-[rgb(var(--text-secondary))] mt-2">
            {t('auth.forgotPasswordDescription')}
          </p>
        </div>
        
        {errorMsg && (
          <div className="mb-5 p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg text-sm">
            {errorMsg}
          </div>
        )}
        
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-[rgb(var(--text-secondary))] mb-1" htmlFor="password">
              {t('auth.newPassword')}
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <FiLock className="text-[rgb(var(--text-secondary))]" />
              </div>
              <input
                id="password"
                type="password"
                placeholder={t('auth.newPasswordPlaceholder')}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="block w-full pl-10 pr-3 py-2.5 border border-[rgb(var(--border-color))] rounded-lg bg-[rgb(var(--input-bg))] text-[rgb(var(--text-primary))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--primary-color))] focus:border-[rgb(var(--primary-color))] transition-colors"
                required
              />
            </div>
          </div>
            
          <div>
            <label className="block text-sm font-medium text-[rgb(var(--text-secondary))] mb-1" htmlFor="confirmPassword">
              {t('auth.confirmPassword')}
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <FiLock className="text-[rgb(var(--text-secondary))]" />
              </div>
              <input
                id="confirmPassword"
                type="password"
                placeholder={t('auth.confirmNewPasswordPlaceholder')}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="block w-full pl-10 pr-3 py-2.5 border border-[rgb(var(--border-color))] rounded-lg bg-[rgb(var(--input-bg))] text-[rgb(var(--text-primary))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--primary-color))] focus:border-[rgb(var(--primary-color))] transition-colors"
                required
              />
            </div>
          </div>
            
          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2.5 px-4 bg-[rgb(var(--primary-color))] text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity flex items-center justify-center mt-6"
          >
            {isLoading ? t('auth.resetting') : t('auth.resetPasswordButton')}
          </button>
        </form>
      </>
    );
  };
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-100 via-indigo-100 to-purple-100 dark:from-gray-900 dark:via-indigo-950 dark:to-purple-900 p-4">
      <motion.div 
        className="w-full max-w-4xl h-[620px] bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden flex"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        {/* 左侧内容 - 图片 */}
        <div className="w-1/2 relative hidden md:block">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-600 flex flex-col items-center justify-center p-12 text-white">
            <Image 
              src="/images/reset-password-illustration.svg" 
              alt={t('auth.resetPassword')}
              width={300}
              height={300}
              className="mb-8"
              // 如果没有重置密码的插图，可以使用登录插图
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.src = '/images/newmessage.svg';
              }}
            />
            <h2 className="text-2xl font-bold mb-4 text-center">{t('auth.resetPassword')}</h2>
            <p className="text-center text-white/80 mb-8">
              {t('auth.forgotPasswordDescription')}
            </p>
            <div className="flex gap-4">
              <button 
                onClick={() => router.push('/')}
                className="px-6 py-2 bg-white/20 text-white border border-white/30 backdrop-blur-sm rounded-lg font-medium hover:bg-white/30 transition-colors"
              >
                {t('auth.backToHome')}
              </button>
            </div>
          </div>
        </div>

        {/* 右侧内容 - 表单 */}
        <div className="w-full md:w-1/2 flex items-center justify-center p-8">
          <div className="w-full max-w-md">
            {renderResetForm()}
          </div>
        </div>
      </motion.div>
    </div>
  );
} 