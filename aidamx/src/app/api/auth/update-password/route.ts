import { NextResponse } from 'next/server';
import mysql from 'mysql2/promise';
import { createHash } from 'crypto';

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
    const { token, password } = await request.json();
    
    // 验证请求参数
    if (!token || !password) {
      return NextResponse.json({ 
        success: false, 
        message: '请提供token和新密码' 
      }, { status: 400 });
    }
    
    // 连接数据库
    const connection = await connectToDatabase();
    
    try {
      // 查询token是否有效
      const [tokenResults] = await connection.execute(
        `SELECT rt.id, rt.user_id, rt.token, rt.expires_at, u.email 
         FROM reset_tokens rt
         JOIN users u ON rt.user_id = u.id
         WHERE rt.token = ? AND rt.expires_at > NOW()`,
        [token]
      );
      
      const tokenResultsArray = tokenResults as any[];
      
      if (tokenResultsArray.length === 0) {
        return NextResponse.json({ 
          success: false, 
          message: '无效或已过期的重置链接' 
        }, { status: 400 });
      }
      
      const tokenInfo = tokenResultsArray[0];
      const userId = tokenInfo.user_id;
      
      // 更新用户密码
      const hashedPassword = hashPassword(password);
      await connection.execute(
        'UPDATE users SET password = ? WHERE id = ?',
        [hashedPassword, userId]
      );
      
      // 删除使用过的token
      await connection.execute(
        'DELETE FROM reset_tokens WHERE token = ?',
        [token]
      );
      
      return NextResponse.json({ 
        success: true, 
        message: '密码已成功重置'
      });
      
    } finally {
      // 关闭数据库连接
      await connection.end();
    }
    
  } catch (error: any) {
    console.error('密码重置失败:', error);
    return NextResponse.json({ 
      success: false, 
      message: '密码重置失败: ' + error.message 
    }, { status: 500 });
  }
} 