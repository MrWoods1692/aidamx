'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { FiUser, FiLock, FiKey, FiShield, FiAlertCircle } from 'react-icons/fi';
import Link from 'next/link';
import { motion } from 'framer-motion';

export default function AdminLoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [adminCode, setAdminCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  
  // 处理管理员登录
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    
    if (!username || !password || !adminCode) {
      setErrorMsg('请填写完整的登录信息');
      return;
    }
    
    try {
      setIsLoading(true);
      setErrorMsg('');
      
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username,
          password,
          code: adminCode,
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || '登录失败');
      }
      
      // 登录成功，重定向到管理后台
      router.push('/code/dashboard');
      
    } catch (error: any) {
      setErrorMsg(error.message || '登录失败，请稍后重试');
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-100 via-indigo-100 to-purple-100 dark:from-gray-900 dark:via-indigo-950 dark:to-purple-900 p-4">
      <motion.div 
        className="w-full max-w-4xl h-[620px] bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden flex"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        {/* 左侧内容 - 图片区域 */}
        <div className="w-1/2 relative hidden md:block">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-600 flex flex-col items-center justify-center p-12 text-white">
            <Image 
              src="/images/admin-login.svg" 
              alt="管理员登录"
              width={300}
              height={300}
              className="mb-8"
              onError={(e) => {
                // 如果管理员专用图片不存在，使用登录图片
                const target = e.target as HTMLImageElement;
                target.onerror = null;
                target.src = '/images/login-illustration.svg';
              }}
            />
            <h2 className="text-2xl font-bold mb-4 text-center">管理员后台</h2>
            <p className="text-center text-white/80 mb-8">登录管理员账号以访问Code Assistant管理功能</p>
            <div className="flex gap-4">
              <button 
                onClick={() => router.push('/')}
                className="px-6 py-2 bg-white/20 text-white border border-white/30 backdrop-blur-sm rounded-lg font-medium hover:bg-white/30 transition-colors"
              >
                返回首页
              </button>
            </div>
          </div>
        </div>

        {/* 右侧内容 - 登录表单 */}
        <div className="w-full md:w-1/2 p-8 flex flex-col justify-center">
          <div className="mb-8 text-center">
            <div className="flex items-center justify-center mb-2">
              <FiShield className="text-3xl mr-3 text-indigo-600" />
              <h1 className="text-2xl font-bold text-gray-800 dark:text-white">管理员登录</h1>
            </div>
            <p className="text-gray-600 dark:text-gray-300">请输入管理员账号凭据</p>
          </div>

          {errorMsg && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg text-sm flex items-start">
              <FiAlertCircle className="text-lg mr-2 mt-0.5 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}
          
          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1" htmlFor="username">
                用户名
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <FiUser className="text-gray-400" />
                </div>
                <input
                  id="username"
                  type="text"
                  placeholder="请输入管理员用户名"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="block w-full pl-10 pr-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                  required
                />
              </div>
            </div>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1" htmlFor="password">
                密码
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <FiLock className="text-gray-400" />
                </div>
                <input
                  id="password"
                  type="password"
                  placeholder="请输入管理员密码"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-10 pr-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                  required
                />
              </div>
            </div>
            
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1" htmlFor="adminCode">
                管理员验证码
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <FiKey className="text-gray-400" />
                </div>
                <input
                  id="adminCode"
                  type="text"
                  placeholder="请输入管理员验证码"
                  value={adminCode}
                  onChange={(e) => setAdminCode(e.target.value)}
                  className="block w-full pl-10 pr-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                  required
                />
              </div>
            </div>
            
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md text-sm font-medium transition-colors shadow-sm flex items-center justify-center"
            >
              {isLoading ? '登录中...' : '管理员登录'}
            </button>
          </form>
        </div>
      </motion.div>
    </div>
  );
} 