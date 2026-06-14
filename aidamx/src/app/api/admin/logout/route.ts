import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST() {
  // 创建响应对象
  const response = NextResponse.json({ message: '登出成功' });
  
  // 清除管理员令牌cookie
  response.cookies.set({
    name: 'admin_token',
    value: '',
    expires: new Date(0), // 过期时间设为过去
    path: '/',
  });
  
  return response;
} 