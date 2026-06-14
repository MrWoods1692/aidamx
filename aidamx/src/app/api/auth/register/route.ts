import { NextResponse } from 'next/server';
import mysql from 'mysql2/promise';
import jwt from 'jsonwebtoken';
import { createHash } from 'crypto';

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

// 哈希密码
function hashPassword(password: string): string {
  return createHash('sha256').update(password).digest('hex');
}

export async function POST(request: Request) {
  try {
    // 解析请求体
    const { email, password, code, username } = await request.json();
    
    // 验证请求参数
    if (!email || !password || !code || !username) {
      return NextResponse.json({ message: '请填写完整的注册信息' }, { status: 400 });
    }
    
    // 连接数据库
    const connection = await connectToDatabase();
    
    try {
      // 验证验证码
      const [codeResults] = await connection.execute(
        'SELECT * FROM verification_codes WHERE email = ? AND code = ? AND expires_at > NOW()',
        [email, code]
      );
      
      const codeResultsArray = codeResults as any[];
      
      if (codeResultsArray.length === 0) {
        return NextResponse.json({ message: '验证码无效或已过期' }, { status: 400 });
      }
      
      // 检查邮箱是否已注册
      const [existingUsers] = await connection.execute(
        'SELECT id FROM users WHERE email = ?',
        [email]
      );
      
      const existingUsersArray = existingUsers as any[];
      
      if (existingUsersArray.length > 0) {
        // 邮箱已注册，但允许更新用户信息（例如设置密码和用户名）
        const userId = existingUsersArray[0].id;
        
        // 获取现有用户的信息
        const [userResults] = await connection.execute(
          'SELECT password FROM users WHERE id = ?',
          [userId]
        );
        
        const userResultsArray = userResults as any[];
        const user = userResultsArray[0];
        
        // 如果用户已经有密码，说明已经完成注册
        if (user.password) {
          return NextResponse.json({ message: '该邮箱已注册，请直接登录' }, { status: 400 });
        }
        
        // 更新用户信息
        await connection.execute(
          'UPDATE users SET name = ?, password = ?, updated_at = NOW() WHERE id = ?',
          [username, hashPassword(password), userId]
        );
        
        // 查询更新后的用户信息
        const [updatedUser] = await connection.execute(
          'SELECT id, email, name, avatar, created_at FROM users WHERE id = ?',
          [userId]
        );
        
        const updatedUserArray = updatedUser as any[];
        const userInfo = updatedUserArray[0];
        
        // 删除已使用的验证码
        await connection.execute(
          'DELETE FROM verification_codes WHERE email = ?',
          [email]
        );
        
        // 确保JWT密钥已设置
        if (!JWT_SECRET) {
          return NextResponse.json({ message: '服务器配置错误: JWT密钥未设置' }, { status: 500 });
        }
        
        // 生成JWT令牌
        const token = jwt.sign(
          { userId: userInfo.id, email: userInfo.email },
          JWT_SECRET,
          { expiresIn: '7d' }
        );
        
        // 设置Cookie
        const response = NextResponse.json({
          message: '注册成功',
          user: {
            id: userInfo.id,
            email: userInfo.email,
            name: userInfo.name,
            avatar: userInfo.avatar,
            createdAt: userInfo.created_at,
          },
        });
        
        // 在响应中添加cookie
        response.cookies.set({
          name: 'auth_token',
          value: token,
          httpOnly: true,
          secure: false,
          maxAge: 60 * 60 * 24 * 7, // 7天
          path: '/',
        });
        
        return response;
      }
      
      // 创建新用户
      const [result] = await connection.execute(
        'INSERT INTO users (email, name, password, created_at) VALUES (?, ?, ?, NOW())',
        [email, username, hashPassword(password)]
      );
      
      const insertResult = result as any;
      const userId = insertResult.insertId;
      
      // 删除已使用的验证码
      await connection.execute(
        'DELETE FROM verification_codes WHERE email = ?',
        [email]
      );
      
      // 获取新用户信息
      const [newUser] = await connection.execute(
        'SELECT id, email, name, avatar, created_at FROM users WHERE id = ?',
        [userId]
      );
      
      const newUserArray = newUser as any[];
      const userInfo = newUserArray[0];
      
      // 确保JWT密钥已设置
      if (!JWT_SECRET) {
        return NextResponse.json({ message: '服务器配置错误: JWT密钥未设置' }, { status: 500 });
      }
      
      // 生成JWT令牌
      const token = jwt.sign(
        { userId: userInfo.id, email: userInfo.email },
        JWT_SECRET,
        { expiresIn: '7d' }
      );
      
      // 设置Cookie
      const response = NextResponse.json({
        message: '注册成功',
        user: {
          id: userInfo.id,
          email: userInfo.email,
          name: userInfo.name,
          avatar: userInfo.avatar,
          createdAt: userInfo.created_at,
        },
      });
      
      // 在响应中添加cookie
      response.cookies.set({
        name: 'auth_token',
        value: token,
        httpOnly: true,
        secure: false,
        maxAge: 60 * 60 * 24 * 7, // 7天
        path: '/',
      });
      
      return response;
      
    } finally {
      // 关闭数据库连接
      await connection.end();
    }
    
  } catch (error: any) {
    console.error('注册失败:', error);
    return NextResponse.json({ message: '注册失败: ' + error.message }, { status: 500 });
  }
} 