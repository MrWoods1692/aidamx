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
    
    // 获取URL参数
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '10');
    const searchQuery = url.searchParams.get('search') || '';
    const offset = (page - 1) * limit;
    
    // 连接数据库
    const connection = await connectToDatabase();
    
    try {
      // 检查数据库表结构
      const [tableInfo] = await connection.execute(
        `SHOW COLUMNS FROM users WHERE Field = 'is_banned'`
      );
      
      const tableInfoArray = tableInfo as any[];
      const hasBannedField = tableInfoArray.length > 0;
      
      // 构建搜索条件
      const searchCondition = searchQuery 
        ? 'WHERE email LIKE ? OR name LIKE ? OR id LIKE ?' 
        : '';
      const searchParams = searchQuery 
        ? [`%${searchQuery}%`, `%${searchQuery}%`, `%${searchQuery}%`] 
        : [];
      
      // 获取用户总数
      const [totalResult] = await connection.execute(
        `SELECT COUNT(*) as total FROM users ${searchCondition}`,
        searchParams
      );
      const totalArray = totalResult as any[];
      const total = totalArray[0].total;
      
      // 获取用户列表 - 根据是否有is_banned字段调整查询
      const [users] = await connection.execute(
        `SELECT id, email, name, created_at, last_login, is_admin, avatar ${hasBannedField ? ', is_banned' : ''}
         FROM users 
         ${searchCondition}
         ORDER BY id ASC 
         LIMIT ${limit} OFFSET ${offset}`,
        searchParams
      );
      
      // 如果没有is_banned字段，为每个用户添加默认值
      const processedUsers = hasBannedField ? users : (users as any[]).map(user => ({
        ...user,
        is_banned: false // 默认值
      }));
      
      return NextResponse.json({
        success: true,
        users: processedUsers,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit)
        }
      });
      
    } finally {
      // 关闭数据库连接
      await connection.end();
    }
    
  } catch (error: any) {
    console.error('获取用户列表失败:', error);
    return NextResponse.json({ 
      success: false, 
      message: '获取用户列表失败: ' + error.message 
    }, { status: 500 });
  }
} 