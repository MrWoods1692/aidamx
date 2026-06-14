import { NextResponse } from 'next/server';
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

export async function POST(request: Request) {
  try {
    // 获取cookie中的管理员令牌
    const token = request.headers.get('cookie')?.split(';')
      .find(c => c.trim().startsWith('admin_token='))
      ?.split('=')[1];
    
    if (!token) {
      return NextResponse.json({ success: false, message: '未登录' }, { status: 401 });
    }
    
    // 在JWT验证之前添加检查
    if (!ADMIN_JWT_SECRET) {
      return NextResponse.json({ success: false, message: '服务器配置错误: JWT密钥未设置' }, { status: 500 });
    }
    
    // 验证令牌
    try {
      jwt.verify(token, ADMIN_JWT_SECRET);
    } catch (error) {
      return NextResponse.json({ success: false, message: '会话已过期或无效' }, { status: 401 });
    }
    
    // 获取请求体
    const body = await request.json();
    const { userId } = body;
    
    if (!userId) {
      return NextResponse.json({ success: false, message: '用户ID不能为空' }, { status: 400 });
    }
    
    // 连接数据库
    const connection = await connectToDatabase();
    
    try {
      // 首先检查用户是否为超级管理员
      const [adminCheckResult] = await connection.execute(
        'SELECT is_admin FROM users WHERE id = ?',
        [userId]
      );
      
      const adminCheck = (adminCheckResult as any[])[0];
      
      if (adminCheck && adminCheck.is_admin) {
        return NextResponse.json({ 
          success: false, 
          message: '不能删除超级管理员账户' 
        }, { status: 403 });
      }
      
      // 删除用户
      const [result] = await connection.execute(
        'DELETE FROM users WHERE id = ?',
        [userId]
      );
      
      const deleteResult = result as any;
      
      if (deleteResult.affectedRows === 0) {
        return NextResponse.json({ 
          success: false, 
          message: '用户不存在或已被删除' 
        }, { status: 404 });
      }
      
      return NextResponse.json({
        success: true,
        message: '用户已成功删除'
      });
      
    } finally {
      // 关闭数据库连接
      await connection.end();
    }
    
  } catch (error: any) {
    console.error('删除用户失败:', error);
    return NextResponse.json({ 
      success: false, 
      message: '删除用户失败: ' + error.message 
    }, { status: 500 });
  }
} 