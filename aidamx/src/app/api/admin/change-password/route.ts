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
    const { currentPassword, newPassword } = await request.json();
    
    // 验证请求参数
    if (!currentPassword || !newPassword) {
      return NextResponse.json({ message: '请提供当前密码和新密码' }, { status: 400 });
    }
    
    // 连接数据库
    const connection = await connectToDatabase();
    
    try {
      // 查询管理员
      const [adminResults] = await connection.execute(
        'SELECT id, username, password FROM admins WHERE id = ?',
        [decodedToken.adminId]
      );
      
      const adminResultsArray = adminResults as any[];
      
      if (adminResultsArray.length === 0) {
        return NextResponse.json({ message: '管理员不存在' }, { status: 404 });
      }
      
      const admin = adminResultsArray[0];
      
      // 验证当前密码 - 实际项目中应使用bcrypt等库进行密码比对
      // 这里简化处理，直接比较密码
      if (admin.password !== currentPassword) {
        return NextResponse.json({ message: '当前密码错误' }, { status: 401 });
      }
      
      // 更新密码
      await connection.execute(
        'UPDATE admins SET password = ? WHERE id = ?',
        [newPassword, decodedToken.adminId]
      );
      
      return NextResponse.json({
        success: true,
        message: '密码已成功更新',
      });
      
    } finally {
      // 关闭数据库连接
      await connection.end();
    }
    
  } catch (error: any) {
    console.error('修改密码失败:', error);
    return NextResponse.json({ message: '修改密码失败: ' + error.message }, { status: 500 });
  }
}