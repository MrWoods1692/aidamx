'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { FiMail, FiLock, FiArrowLeft } from 'react-icons/fi';
import { useUserStore } from '@/app/components/Navbar';
import { useTranslation } from '@/app/i18n';
import { useI18nStore } from '@/app/i18n';

interface LoginFormProps {
  onToggleMode: () => void;
}

export function LoginForm({ onToggleMode }: LoginFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [qqNumber, setQQNumber] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetMessage, setResetMessage] = useState('');
  const [resetSuccess, setResetSuccess] = useState(false);
  const [showQQTip, setShowQQTip] = useState(false);
  const { t } = useTranslation();
  const { locale } = useI18nStore();
  
  const { login } = useUserStore();
  
  const handleQQInput = (input: string) => {
    let cleanInput = '';
    
    if (input.includes('@qq')) {
      cleanInput = input.split('@')[0];
      setShowQQTip(true);
      setTimeout(() => setShowQQTip(false), 3000);
    } else {
      cleanInput = input;
    }
    
    const digitsOnly = cleanInput.replace(/\D/g, '');
    
    setQQNumber(digitsOnly);
    setEmail(`${digitsOnly}@qq.com`);
  };
  
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    
    const loginEmail = email.includes('@') ? email : `${email}@qq.com`;
    
    if (!loginEmail || !password) {
      setErrorMsg(t('auth.completeInfo'));
      return;
    }
    
    try {
      setIsLoading(true);
      setErrorMsg('');
      
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: loginEmail, password }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || t('auth.loginFailed'));
      }
      
      login(data.user);
      
      router.push('/');
      
    } catch (error: any) {
      setErrorMsg(error.message || t('auth.loginFailed'));
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleForgotPassword = async (e: FormEvent) => {
    e.preventDefault();
    
    const resetEmailComplete = resetEmail.includes('@') ? resetEmail : `${resetEmail}@qq.com`;
    
    if (!resetEmailComplete) {
      setResetMessage(t('auth.enterEmail'));
      return;
    }
    
    try {
      setResetLoading(true);
      setResetMessage('');
      
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: resetEmailComplete }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || t('auth.resetFailed'));
      }
      
      setResetSuccess(true);
      setResetMessage(data.message || t('auth.resetEmailSent'));
      
      if (data.debug) {
        console.log('调试信息:', data.debug);
      }
      
    } catch (error: any) {
      setResetMessage(error.message || t('auth.resetFailed'));
      setResetSuccess(false);
    } finally {
      setResetLoading(false);
    }
  };
  
  const handleResetQQInput = (input: string) => {
    let cleanInput = '';
    
    if (input.includes('@qq')) {
      cleanInput = input.split('@')[0];
    } else {
      cleanInput = input;
    }
    
    const digitsOnly = cleanInput.replace(/\D/g, '');
    
    setResetEmail(`${digitsOnly}@qq.com`);
  };
  
  return (
    <div className="h-full flex flex-col p-6 justify-center">
      <div className="absolute top-6 left-6">
        <button 
          onClick={() => router.push('/')}
          className="flex items-center text-[rgb(var(--text-secondary))] hover:text-[rgb(var(--primary-color))] transition-colors md:hidden"
        >
          <FiArrowLeft className="mr-2" />
          <span>{t('auth.backToHome')}</span>
        </button>
      </div>
        
      <div className="text-center mb-8">
        <div className="flex justify-center mb-4">
          <Image 
            src="/images/biaotilogo.png" 
            alt="Logo" 
            width={64} 
            height={64} 
            className="rounded-xl"
          />
        </div>
        <h2 className="text-2xl font-bold text-[rgb(var(--text-primary))]">
          {t('auth.welcomeBack')}
        </h2>
        <p className="text-[rgb(var(--text-secondary))] mt-2">
          {t('auth.loginDescription')}
        </p>
      </div>
        
      {errorMsg && (
        <div className="mb-5 p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg text-sm">
          {errorMsg}
        </div>
      )}
        
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-[rgb(var(--text-secondary))] mb-1" htmlFor="email">
            {t('auth.email')}
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <FiMail className="text-[rgb(var(--text-secondary))]" />
            </div>
            <input
              id="email"
              type="text"
              placeholder={t('auth.qqPlaceholder') || "QQ号"}
              value={qqNumber}
              onChange={(e) => handleQQInput(e.target.value)}
              className="block w-full pl-10 pr-24 py-2.5 border border-[rgb(var(--border-color))] rounded-lg bg-[rgb(var(--input-bg))] text-[rgb(var(--text-primary))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--primary-color))] focus:border-[rgb(var(--primary-color))] transition-colors"
              required
            />
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
              <span className="text-[rgb(var(--text-secondary))] text-sm">@qq.com</span>
            </div>
          </div>
          {showQQTip && (
            <div className="mt-1 text-xs flex items-center text-blue-500 dark:text-blue-400">
              <span>已自动提取QQ号，将使用 {qqNumber}@qq.com 登录</span>
            </div>
          )}
        </div>
          
        <div>
          <div className="flex justify-between mb-1">
            <label className="block text-sm font-medium text-[rgb(var(--text-secondary))]" htmlFor="password">
              {t('auth.password')}
            </label>
            <button 
              type="button"
              onClick={() => {
                setShowForgotPassword(true);
                console.log('当前语言:', locale);
              }} 
              className="text-xs text-[rgb(var(--primary-color))] hover:underline"
            >
              {t('auth.forgotPassword')}
            </button>
          </div>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <FiLock className="text-[rgb(var(--text-secondary))]" />
            </div>
            <input
              id="password"
              type="password"
              placeholder={t('auth.passwordPlaceholder')}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
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
          {isLoading ? t('auth.loginProcess') : t('auth.loginButton')}
        </button>
      </form>
      
      {showForgotPassword && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md">
            <h3 className="text-xl font-bold text-[rgb(var(--text-primary))] mb-4">
              {t('auth.forgotPassword')}
            </h3>
            
            {resetSuccess ? (
              <div>
                <div className="p-4 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 rounded-lg mb-4">
                  {resetMessage}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowForgotPassword(false);
                    setResetSuccess(false);
                    setResetMessage('');
                    setResetEmail('');
                  }}
                  className="w-full py-2.5 px-4 bg-[rgb(var(--primary-color))] text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
                >
                  {t('auth.backToLogin')}
                </button>
              </div>
            ) : (
              <div>
                <p className="text-[rgb(var(--text-secondary))] mb-4">
                  {t('auth.forgotPasswordDescription')}
                </p>
                
                {resetMessage && (
                  <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg text-sm">
                    {resetMessage}
                  </div>
                )}
                
                <form onSubmit={handleForgotPassword} className="space-y-5">
                  <div>
                    <label htmlFor="resetEmail" className="block text-sm font-medium text-[rgb(var(--text-secondary))] mb-2">
                      {t('auth.email')}
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <FiMail className="text-[rgb(var(--text-secondary))]" />
                      </div>
                      <input
                        id="resetEmail"
                        type="text"
                        placeholder={t('auth.qqPlaceholder') || "QQ号"}
                        value={resetEmail.replace('@qq.com', '')}
                        onChange={(e) => handleResetQQInput(e.target.value)}
                        className="block w-full pl-10 pr-24 py-2.5 border border-[rgb(var(--border-color))] rounded-lg bg-[rgb(var(--input-bg))] text-[rgb(var(--text-primary))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--primary-color))] focus:border-[rgb(var(--primary-color))] transition-colors"
                        required
                      />
                      <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                        <span className="text-[rgb(var(--text-secondary))] text-sm">@qq.com</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex space-x-3">
                    <button
                      type="button"
                      onClick={() => setShowForgotPassword(false)}
                      className="flex-1 py-2.5 px-4 border border-[rgb(var(--border-color))] text-[rgb(var(--text-primary))] rounded-lg text-sm font-medium hover:bg-[rgb(var(--hover-color))] transition-colors"
                    >
                      {t('common.cancel')}
                    </button>
                    <button
                      type="submit"
                      disabled={resetLoading}
                      className="flex-1 py-2.5 px-4 bg-[rgb(var(--primary-color))] text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity flex items-center justify-center"
                    >
                      {resetLoading ? t('auth.sending') : t('auth.sendResetLink')}
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
} 