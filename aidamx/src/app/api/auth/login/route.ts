import { NextResponse } from 'next/server';
import mysql from 'mysql2/promise';
import jwt from 'jsonwebtoken';
import { createHash } from 'crypto';

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

// 哈希密码
function hashPassword(password: string): string {
  return createHash('sha256').update(password).digest('hex');
}

export async function POST(request: Request) {
  try {
    // 解析请求体
    const { email, password } = await request.json();
    
    // 验证请求参数
    if (!email || !password) {
      return NextResponse.json({ message: '请提供邮箱和密码' }, { status: 400 });
    }
    
    // 连接数据库
    const connection = await connectToDatabase();
    
    try {
      // 查询用户信息
      const [userResults] = await connection.execute(
        'SELECT id, email, name, password, avatar, created_at FROM users WHERE email = ?',
        [email]
      );
      
      const userResultsArray = userResults as any[];
      
      if (userResultsArray.length === 0) {
        return NextResponse.json({ message: '账号或密码错误' }, { status: 401 });
      }
      
      const user = userResultsArray[0];
      
      // 验证密码
      const hashedPassword = hashPassword(password);
      if (user.password !== hashedPassword) {
        return NextResponse.json({ message: '账号或密码错误' }, { status: 401 });
      }
      
      // 更新最后登录时间
      await connection.execute(
        'UPDATE users SET last_login = NOW() WHERE id = ?',
        [user.id]
      );
      
      // 在JWT签名之前添加检查
      if (!JWT_SECRET) {
        return NextResponse.json({ message: '服务器配置错误: JWT密钥未设置' }, { status: 500 });
      }
      
      // 生成JWT令牌
      const token = jwt.sign(
        { userId: user.id, email: user.email },
        JWT_SECRET,
        { expiresIn: '7d' }
      );
      
      // 设置Cookie - 使用响应对象的cookies方法
      const response = NextResponse.json({
        message: '登录成功',
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          avatar: user.avatar,
          createdAt: user.created_at,
        },
      });
      
      // 在响应中添加cookie
      response.cookies.set({
        name: 'auth_token',
        value: token,
        httpOnly: true,
        secure: false, // 允许HTTP请求发送Cookie
        maxAge: 60 * 60 * 24 * 7, // 7天
        path: '/',
      });
      
      return response;
      
    } finally {
      // 关闭数据库连接
      await connection.end();
    }
    
  } catch (error: any) {
    console.error('登录失败:', error);
    return NextResponse.json({ message: '登录失败: ' + error.message }, { status: 500 });
  }
} 