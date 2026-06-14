import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';
import mysql from 'mysql2/promise';

// 使用环境变量中的JWT密钥
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

export async function GET(request: Request) {
  try {
    // 获取cookie中的令牌
    const token = request.headers.get('cookie')?.split(';')
      .find(c => c.trim().startsWith('auth_token='))
      ?.split('=')[1];
    
    if (!token) {
      return NextResponse.json({ isValid: false, message: '未登录' }, { status: 401 });
    }
    
    // 在JWT验证之前添加检查
    if (!JWT_SECRET) {
      return NextResponse.json({ isValid: false, message: '服务器配置错误: JWT密钥未设置' }, { status: 500 });
    }
    
    try {
      // 验证令牌
      const decoded = jwt.verify(token, JWT_SECRET) as { userId: number, email: string };
      
      // 连接数据库
      const connection = await connectToDatabase();
      
      try {
        // 查询用户是否存在
        const [userResults] = await connection.execute(
          'SELECT id, email, name, avatar FROM users WHERE id = ?',
          [decoded.userId]
        );
        
        const userResultsArray = userResults as any[];
        
        if (userResultsArray.length === 0) {
          // 用户在数据库中不存在了
          return NextResponse.json({ 
            isValid: false, 
            message: '用户不存在或已被删除' 
          }, { status: 404 });
        }
        
        const user = userResultsArray[0];
        
        // 返回用户有效，并附带用户数据
        return NextResponse.json({
          isValid: true,
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            avatar: user.avatar
          }
        });
        
      } finally {
        // 关闭数据库连接
        await connection.end();
      }
      
    } catch (jwtError) {
      // JWT验证失败
      return NextResponse.json({ 
        isValid: false, 
        message: '会话已过期或无效' 
      }, { status: 401 });
    }
    
  } catch (error: any) {
    console.error('验证用户状态失败:', error);
    return NextResponse.json({ 
      isValid: false, 
      message: '验证失败: ' + error.message 
    }, { status: 500 });
  }
} 