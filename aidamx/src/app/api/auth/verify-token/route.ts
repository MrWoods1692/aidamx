import { NextResponse } from 'next/server';
import mysql from 'mysql2/promise';

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
    // 从URL获取token
    const url = new URL(request.url);
    const token = url.searchParams.get('token');
    
    if (!token) {
      return NextResponse.json({ 
        isValid: false, 
        message: '未提供token' 
      }, { status: 400 });
    }
    
    // 连接数据库
    const connection = await connectToDatabase();
    
    try {
      // 查询token是否有效
      const [tokenResults] = await connection.execute(
        `SELECT rt.id, rt.user_id, rt.token, rt.expires_at 
         FROM reset_tokens rt
         WHERE rt.token = ? AND rt.expires_at > NOW()`,
        [token]
      );
      
      const tokenResultsArray = tokenResults as any[];
      
      if (tokenResultsArray.length === 0) {
        return NextResponse.json({ 
          isValid: false, 
          message: '无效或已过期的token' 
        });
      }
      
      return NextResponse.json({ 
        isValid: true, 
        message: 'token有效'
      });
      
    } finally {
      // 关闭数据库连接
      await connection.end();
    }
    
  } catch (error: any) {
    console.error('验证token失败:', error);
    return NextResponse.json({ 
      isValid: false, 
      message: '验证失败: ' + error.message 
    }, { status: 500 });
  }
} 