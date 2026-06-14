'use client';

import { useState, FormEvent, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { FiMail, FiLock, FiArrowLeft, FiKey, FiInfo, FiUser } from 'react-icons/fi';
import { useUserStore } from '@/app/components/Navbar';
import { useTranslation } from '@/app/i18n';

interface RegisterFormProps {
  onToggleMode: () => void;
}

interface QQNameResponse {
  code: number;
  qq: string;
  data: {
    name: string;
    mail: string;
    avatar: string;
    qzone: string;
    imgurl: string;
    imgur2: string;
    imgur3: string;
    imgur4: string;
  };
  time: string;
}

export function RegisterForm({ onToggleMode }: RegisterFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [qqNumber, setQqNumber] = useState(''); // 存储QQ号
  const [qqName, setQqName] = useState(''); // 存储QQ昵称
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [code, setCode] = useState('');
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [showQQTip, setShowQQTip] = useState(false);
  const [isLoadingQQName, setIsLoadingQQName] = useState(false);
  const [codeAutoFilled, setCodeAutoFilled] = useState(false); // 新增状态，用于跟踪验证码是否自动填充
  
  const { login } = useUserStore();
  const { t } = useTranslation();
  
  // 修改处理QQ号输入的函数，不再自动获取QQ昵称
  const handleQQInput = (input: string) => {
    let cleanInput = '';
    
    // 检查是否包含@qq（处理完整和不完整的邮箱后缀）
    if (input.includes('@qq')) {
      // 分割并只保留@之前的部分
      cleanInput = input.split('@')[0];
      setShowQQTip(true);
      setTimeout(() => setShowQQTip(false), 3000); // 3秒后隐藏提示
    } else {
      cleanInput = input;
    }
    
    // 确保只包含数字
    const digitsOnly = cleanInput.replace(/\D/g, '');
    
    // 设置QQ号和邮箱
    setQqNumber(digitsOnly);
    setEmail(`${digitsOnly}@qq.com`);
    
    // 不再自动获取QQ昵称
    // 清除可能存在的旧昵称
    if (digitsOnly.length < 5) {
      setQqName('');
    }
  };
  
  // 添加一个新的函数，在聚焦密码框时获取QQ昵称
  const handlePasswordFocus = () => {
    // 当QQ号长度大于5时，尝试获取QQ昵称
    if (qqNumber.length > 5) {
      fetchQQName(qqNumber);
    }
  };
  
  // 获取QQ昵称
  const fetchQQName = async (qq: string) => {
    if (!qq) return;
    
    try {
      setIsLoadingQQName(true);
      setQqName(''); // 清空之前的昵称
      
      // 使用本地API代理
      const response = await fetch(`/api/proxy/qq-name?qq=${qq}`);
      
      if (!response.ok) {
        throw new Error('获取QQ昵称失败');
      }
      
      // 使用text()方法获取响应，然后手动解析JSON，确保编码正确
      const text = await response.text();
      console.log('API响应原始文本:', text);
      
      let data;
      try {
        data = JSON.parse(text);
      } catch (error) {
        console.error('JSON解析错误:', error);
        throw new Error('JSON解析错误');
      }
      
      console.log('解析后的数据:', data);
      
      if (data.code === 200 && data.data && data.data.name) {
        console.log('获取到的QQ昵称:', data.data.name);
        setQqName(data.data.name);
      } else {
        // API调用成功但没有返回有效数据，使用默认格式
        console.log('未获取到有效QQ昵称，使用默认格式');
        setQqName(`QQ_${qq}`);
      }
    } catch (error) {
      console.error('获取QQ昵称失败:', error);
      // 获取失败时使用默认格式
      setQqName(`QQ_${qq}`);
    } finally {
      setIsLoadingQQName(false);
    }
  };
  
  // 发送验证码
  const handleSendCode = async () => {
    if (!qqNumber) {
      setErrorMsg(t('auth.completeInfo'));
      return;
    }
    
    try {
      setIsSendingCode(true);
      setErrorMsg('');
      setCodeAutoFilled(false); // 重置自动填充状态
      
      const response = await fetch('/api/auth/send-code', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || '发送验证码失败');
      }
      
      // 如果API返回了验证码，则自动填入
      if (data.code) {
        setCode(data.code);
        setCodeAutoFilled(true); // 标记验证码已自动填充
        
        // 3秒后隐藏自动填充提示
        setTimeout(() => {
          setCodeAutoFilled(false);
        }, 3000);
      }
      
      // 设置倒计时
      setCountdown(60);
      const timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      
    } catch (error: any) {
      setErrorMsg(error.message || '发送验证码失败，请稍后重试');
    } finally {
      setIsSendingCode(false);
    }
  };
  
  // 提交注册
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    
    if (!qqNumber || !password || !code) {
      setErrorMsg(t('auth.completeInfo'));
      return;
    }
    
    if (password !== confirmPassword) {
      setErrorMsg(t('auth.passwordMismatch'));
      return;
    }
    
    try {
      setIsLoading(true);
      setErrorMsg('');
      
      // 使用获取到的QQ昵称或默认格式
      const username = qqName || `QQ_${qqNumber}`;
      
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password, code, username }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || '注册失败');
      }
      
      // 注册成功，保存用户信息，自动登录
      login(data.user);
      
      // 重定向到首页
      router.push('/');
      
    } catch (error: any) {
      setErrorMsg(error.message || '注册失败，请稍后重试');
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <div className="h-full flex flex-col p-6">
      <div className="flex items-center justify-between mb-4">
        <button 
          onClick={() => router.push('/')}
          className="flex items-center text-[rgb(var(--text-secondary))] hover:text-[rgb(var(--primary-color))] transition-colors md:hidden"
        >
          <FiArrowLeft className="mr-2" />
          <span>{t('auth.backToHome')}</span>
        </button>
      </div>
      
      <div className="text-center mb-4">
        <div className="flex justify-center mb-2">
          <Image 
            src="/images/biaotilogo.png" 
            alt="Logo" 
            width={50} 
            height={50} 
            className="rounded-xl"
          />
        </div>
        <h2 className="text-xl font-bold text-[rgb(var(--text-primary))]">
          {t('auth.createAccount')}
        </h2>
        <p className="text-[rgb(var(--text-secondary))] mt-1 text-sm">
          {t('auth.registerDescription')}
        </p>
      </div>
      
      {errorMsg && (
        <div className="mb-3 p-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg text-sm">
          {errorMsg}
        </div>
      )}
      
      <form onSubmit={handleSubmit} className="space-y-3 flex-1">
        <div>
          <label className="block text-sm font-medium text-[rgb(var(--text-secondary))] mb-1" htmlFor="qqNumber">
            {t('auth.email')}
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <FiMail className="text-[rgb(var(--text-secondary))]" />
            </div>
            <input
              id="qqNumber"
              type="text"
              placeholder={t('auth.qqPlaceholder')}
              value={qqNumber}
              onChange={(e) => handleQQInput(e.target.value)}
              className="block w-full pl-10 pr-24 py-2 border border-[rgb(var(--border-color))] rounded-lg bg-[rgb(var(--input-bg))] text-[rgb(var(--text-primary))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--primary-color))] focus:border-[rgb(var(--primary-color))] transition-colors"
              required
            />
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
              <span className="text-[rgb(var(--text-secondary))] text-sm">@qq.com</span>
            </div>
          </div>
          {showQQTip && (
            <div className="mt-1 text-xs flex items-center text-blue-500 dark:text-blue-400">
              <FiInfo className="mr-1" />
              <span>已自动提取QQ号，将使用 {qqNumber}@qq.com 注册</span>
            </div>
          )}
          {qqName && (
            <div className="mt-1 text-xs flex items-center text-green-500 dark:text-green-400">
              <FiUser className="mr-1" />
              <span>{t('auth.gotQQName')}: {qqName}</span>
            </div>
          )}
          {isLoadingQQName && (
            <div className="mt-1 text-xs flex items-center text-gray-500 dark:text-gray-400">
              <span>{t('auth.loadingQQName')}</span>
            </div>
          )}
        </div>
        
        <div>
          <label className="block text-sm font-medium text-[rgb(var(--text-secondary))] mb-1" htmlFor="password">
            {t('auth.password')}
          </label>
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
              onFocus={handlePasswordFocus}
              className="block w-full pl-10 pr-3 py-2 border border-[rgb(var(--border-color))] rounded-lg bg-[rgb(var(--input-bg))] text-[rgb(var(--text-primary))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--primary-color))] focus:border-[rgb(var(--primary-color))] transition-colors"
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
              placeholder={t('auth.confirmPasswordPlaceholder')}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="block w-full pl-10 pr-3 py-2 border border-[rgb(var(--border-color))] rounded-lg bg-[rgb(var(--input-bg))] text-[rgb(var(--text-primary))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--primary-color))] focus:border-[rgb(var(--primary-color))] transition-colors"
              required
            />
          </div>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-[rgb(var(--text-secondary))] mb-1" htmlFor="code">
            {t('auth.verificationCode')}
          </label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <FiKey className="text-[rgb(var(--text-secondary))]" />
              </div>
              <input
                id="code"
                type="text"
                placeholder={t('auth.codePlaceholder')}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="block w-full pl-10 pr-3 py-2 border border-[rgb(var(--border-color))] rounded-lg bg-[rgb(var(--input-bg))] text-[rgb(var(--text-primary))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--primary-color))] focus:border-[rgb(var(--primary-color))] transition-colors"
                required
              />
            </div>
            <button
              type="button"
              onClick={handleSendCode}
              disabled={countdown > 0 || isSendingCode}
              className={`w-32 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
                countdown > 0 || isSendingCode
                  ? 'bg-gray-100 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
                  : 'bg-[rgb(var(--primary-color))] text-white hover:opacity-90'
              }`}
            >
              {countdown > 0 ? `${countdown}${t('auth.retryAfter')}` : isSendingCode ? t('auth.sending') : t('auth.getCode')}
            </button>
          </div>
        </div>
        {codeAutoFilled && (
          <div className="mt-1 text-xs flex items-center text-green-500 dark:text-green-400">
            <FiInfo className="mr-1" />
            <span>验证码已自动填入</span>
          </div>
        )}
        
        <button
          type="submit"
          disabled={isLoading}
          className="w-full py-2.5 px-4 bg-[rgb(var(--primary-color))] text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity flex items-center justify-center mt-4"
        >
          {isLoading ? t('auth.registerProcess') : t('auth.registerButton')}
        </button>
      </form>
    </div>
  );
} 