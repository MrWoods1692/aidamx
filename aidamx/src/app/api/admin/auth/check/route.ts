import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';
import mysql from 'mysql2/promise';

// 使用环境变量中的管理员JWT密钥
const ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET;

// 确保必要的环境变量已设置
if (!ADMIN_JWT_SECRET) {
  console.error('警告: ADMIN_JWT_SECRET环境变量未设置!');
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
    // 获取cookie中的管理员令牌
    const cookieHeader = request.headers.get('cookie');
    console.log('Cookie 头信息:', cookieHeader);
    
    const token = cookieHeader?.split(';')
      .find(c => c.trim().startsWith('admin_token='))
      ?.split('=')[1];
    
    console.log('提取的token:', token);
    
    if (!token) {
      return NextResponse.json({ message: '未登录' }, { status: 401 });
    }
    
    // 在JWT验证之前添加检查
    if (!ADMIN_JWT_SECRET) {
      console.log('警告: ADMIN_JWT_SECRET环境变量未设置!');
      return NextResponse.json({ message: '服务器配置错误: JWT密钥未设置' }, { status: 500 });
    }
    
    console.log('JWT密钥已设置，长度:', ADMIN_JWT_SECRET.length);
    
    // 验证令牌
    let decoded: { adminId: number, username: string };
    try {
      decoded = jwt.verify(token, ADMIN_JWT_SECRET) as { adminId: number, username: string };
      console.log('JWT验证成功，用户ID:', decoded.adminId);
    } catch (error: any) {
      console.log('JWT验证失败:', error.message);
      throw error;
    }
    
    // 连接数据库
    const connection = await connectToDatabase();
    
    try {
      // 查询管理员
      const [adminResults] = await connection.execute(
        'SELECT id, username, real_name FROM admins WHERE id = ?',
        [decoded.adminId]
      );
      
      const adminResultsArray = adminResults as any[];
      
      if (adminResultsArray.length === 0) {
        return NextResponse.json({ message: '管理员不存在' }, { status: 404 });
      }
      
      const admin = adminResultsArray[0];
      
      return NextResponse.json({
        message: '已登录',
        admin: {
          id: admin.id,
          username: admin.username,
          realName: admin.real_name,
        },
      });
      
    } finally {
      // 关闭数据库连接
      await connection.end();
    }
    
  } catch (error: any) {
    console.error('验证管理员登录状态失败:', error);
    
    // 如果是JWT验证错误，返回401
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return NextResponse.json({ message: '会话已过期或无效' }, { status: 401 });
    }
    
    return NextResponse.json({ message: '验证失败: ' + error.message }, { status: 500 });
  }
} 