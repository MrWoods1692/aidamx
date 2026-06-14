import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import mysql from 'mysql2/promise';
import jwt from 'jsonwebtoken';

// 使用环境变量中的JWT密钥，不提供后备值
const JWT_SECRET = process.env.JWT_SECRET;

// 确保JWT密钥已设置
if (!JWT_SECRET) {
  console.error('警告: JWT_SECRET环境变量未设置!');
}

// 数据库连接
async function connectToDatabase() {
  try {
    return await mysql.createConnection({
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT || '3306'),
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
    });
  } catch (error) {
    console.error('数据库连接失败:', error);
    throw new Error('数据库连接失败');
  }
}

// 验证JWT令牌获取用户ID
function getUserIdFromToken(request: Request) {
  // 从请求的headers中获取cookie
  const cookieHeader = request.headers.get('cookie') || '';
  const cookies = Object.fromEntries(
    cookieHeader.split('; ').map(cookie => {
      const [name, ...value] = cookie.split('=');
      return [name, value.join('=')];
    })
  );
  
  const authToken = cookies['auth_token'];
  
  if (!authToken) {
    throw new Error('未登录');
  }
  
  // 确保JWT密钥已设置
  if (!JWT_SECRET) {
    throw new Error('服务器配置错误: JWT密钥未设置');
  }
  
  try {
    const decoded = jwt.verify(authToken, JWT_SECRET) as { userId: string };
    return decoded.userId;
  } catch (error) {
    throw new Error('无效的登录凭证');
  }
}

export async function PUT(request: Request) {
  try {
    // 获取请求体数据
    const { name } = await request.json();
    
    // 验证必填字段
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ message: '请提供有效的用户名' }, { status: 400 });
    }
    
    // 从JWT令牌获取用户ID
    let userId;
    try {
      userId = getUserIdFromToken(request);
    } catch (error: any) {
      return NextResponse.json({ message: error.message }, { status: 401 });
    }
    
    // 连接数据库
    const connection = await connectToDatabase();
    
    try {
      // 更新用户信息
      await connection.execute(
        'UPDATE users SET name = ? WHERE id = ?',
        [name, userId]
      );
      
      // 获取更新后的用户信息
      const [userResults] = await connection.execute(
        'SELECT id, email, name, avatar, created_at FROM users WHERE id = ?',
        [userId]
      );
      
      const userResultsArray = userResults as any[];
      
      if (userResultsArray.length === 0) {
        return NextResponse.json({ message: '用户不存在' }, { status: 404 });
      }
      
      const user = userResultsArray[0];
      
      // 返回更新后的用户数据
      return NextResponse.json({
        message: '用户信息更新成功',
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          avatar: user.avatar,
          createdAt: user.created_at,
        },
      });
      
    } finally {
      // 关闭数据库连接
      await connection.end();
    }
    
  } catch (error: any) {
    console.error('更新用户信息失败:', error);
    return NextResponse.json({ message: '更新用户信息失败: ' + error.message }, { status: 500 });
  }
} 