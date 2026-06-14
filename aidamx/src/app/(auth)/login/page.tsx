'use client';

import dynamic from 'next/dynamic';

// 动态导入AuthCard组件以避免hydration错误
const AuthCard = dynamic(() => import('../../components/AuthCard'), { ssr: false });

export default function LoginPage() {
  return <AuthCard />;
} 