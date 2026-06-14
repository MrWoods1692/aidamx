import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import mysql from 'mysql2/promise';
import jwt from 'jsonwebtoken';

// 使用环境变量中的管理员JWT密钥和验证码，不提供后备值
const ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET;
const ADMIN_CODE = process.env.ADMIN_CODE;

// 确保必要的环境变量已设置
if (!ADMIN_JWT_SECRET) {
  console.error('警告: ADMIN_JWT_SECRET环境变量未设置!');
}

if (!ADMIN_CODE) {
  console.error('警告: ADMIN_CODE环境变量未设置!');
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
    // 解析请求体
    const { username, password, code } = await request.json();
    
    // 验证请求参数
    if (!username || !password || !code) {
      return NextResponse.json({ message: '请提供用户名、密码和验证码' }, { status: 400 });
    }
    
    // 验证管理员验证码
    if (code !== ADMIN_CODE) {
      return NextResponse.json({ message: '管理员验证码错误' }, { status: 401 });
    }
    
    // 连接数据库
    const connection = await connectToDatabase();
    
    try {
      // 查询管理员
      const [adminResults] = await connection.execute(
        'SELECT id, username, password, real_name FROM admins WHERE username = ?',
        [username]
      );
      
      const adminResultsArray = adminResults as any[];
      
      if (adminResultsArray.length === 0) {
        return NextResponse.json({ message: '管理员不存在' }, { status: 404 });
      }
      
      const admin = adminResultsArray[0];
      
      // 验证密码 - 实际项目中应使用bcrypt等库进行密码比对
      // 这里简化处理，直接比较密码
      if (admin.password !== password) {
        return NextResponse.json({ message: '密码错误' }, { status: 401 });
      }
      
      // 更新最后登录时间
      await connection.execute(
        'UPDATE admins SET last_login = NOW() WHERE id = ?',
        [admin.id]
      );
      
      // 在JWT签名之前添加检查
      if (!ADMIN_JWT_SECRET) {
        return NextResponse.json({ message: '服务器配置错误: JWT密钥未设置' }, { status: 500 });
      }
      
      // 生成JWT令牌
      const token = jwt.sign(
        { adminId: admin.id, username: admin.username },
        ADMIN_JWT_SECRET,
        { expiresIn: '24h' }
      );
      
      // 设置Cookie - 使用响应对象的cookie方法
      const response = NextResponse.json({
        message: '登录成功',
        admin: {
          id: admin.id,
          username: admin.username,
          realName: admin.real_name,
        },
      });
      
      // 在响应中添加cookie
      response.cookies.set({
        name: 'admin_token',
        value: token,
        httpOnly: true,
        secure: false,
        maxAge: 60 * 60 * 24, // 24小时
        path: '/',
      });
      
      return response;
      
    } finally {
      // 关闭数据库连接
      await connection.end();
    }
    
  } catch (error: any) {
    console.error('管理员登录失败:', error);
    return NextResponse.json({ message: '管理员登录失败: ' + error.message }, { status: 500 });
  }
} 