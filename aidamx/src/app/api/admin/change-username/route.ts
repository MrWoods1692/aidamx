import { NextResponse } from 'next/server';
import mysql from 'mysql2/promise';
import jwt from 'jsonwebtoken';

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

// 验证管理员令牌
async function verifyAdminToken(token: string) {
  if (!ADMIN_JWT_SECRET) {
    throw new Error('服务器配置错误: JWT密钥未设置');
  }
  
  try {
    return jwt.verify(token, ADMIN_JWT_SECRET) as { adminId: number; username: string };
  } catch (error) {
    throw new Error('无效的令牌');
  }
}

export async function POST(request: Request) {
  try {
    // 获取管理员令牌
    const token = request.headers.get('cookie')?.split(';')
      .find(c => c.trim().startsWith('admin_token='))
      ?.split('=')[1];
    
    if (!token) {
      return NextResponse.json({ message: '未授权，请先登录' }, { status: 401 });
    }
    
    // 验证令牌
    let decodedToken;
    try {
      decodedToken = await verifyAdminToken(token);
    } catch (error: any) {
      return NextResponse.json({ message: error.message }, { status: 401 });
    }
    
    // 解析请求体
    const { newUsername, newRealName } = await request.json();
    
    // 验证请求参数
    if (!newUsername) {
      return NextResponse.json({ message: '请提供新用户名' }, { status: 400 });
    }
    
    // 连接数据库
    const connection = await connectToDatabase();
    
    try {
      // 检查用户名是否已存在
      const [existingUsers] = await connection.execute(
        'SELECT id FROM admins WHERE username = ? AND id != ?',
        [newUsername, decodedToken.adminId]
      );
      
      const existingUsersArray = existingUsers as any[];
      
      if (existingUsersArray.length > 0) {
        return NextResponse.json({ message: '用户名已被使用' }, { status: 409 });
      }
      
      // 更新用户名和显示名称
      await connection.execute(
        'UPDATE admins SET username = ?, real_name = ? WHERE id = ?',
        [newUsername, newRealName || null, decodedToken.adminId]
      );
      
      // 获取更新后的管理员信息
      const [adminResults] = await connection.execute(
        'SELECT id, username, real_name FROM admins WHERE id = ?',
        [decodedToken.adminId]
      );
      
      const adminResultsArray = adminResults as any[];
      const admin = adminResultsArray[0];
      
      // 在JWT签名之前添加检查
      if (!ADMIN_JWT_SECRET) {
        return NextResponse.json({ message: '服务器配置错误: JWT密钥未设置' }, { status: 500 });
      }
      
      // 生成新的JWT令牌
      const newToken = jwt.sign(
        { adminId: admin.id, username: admin.username },
        ADMIN_JWT_SECRET,
        { expiresIn: '24h' }
      );
      
      // 设置新的Cookie
      const response = NextResponse.json({
        success: true,
        message: '用户名已成功更新',
        username: admin.username,
        realName: admin.real_name,
      });
      
      // 在响应中添加cookie
      response.cookies.set({
        name: 'admin_token',
        value: newToken,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 60 * 60 * 24, // 24小时
        path: '/',
      });
      
      return response;
      
    } finally {
      // 关闭数据库连接
      await connection.end();
    }
    
  } catch (error: any) {
    console.error('修改用户名失败:', error);
    return NextResponse.json({ message: '修改用户名失败: ' + error.message }, { status: 500 });
  }
} 