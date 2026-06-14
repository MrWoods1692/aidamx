import { NextResponse } from 'next/server';
import mysql from 'mysql2/promise';
import jwt from 'jsonwebtoken';

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

// 验证管理员身份
async function verifyAdmin(request: Request) {
  const token = request.headers.get('cookie')?.split(';')
    .find(c => c.trim().startsWith('admin_token='))
    ?.split('=')[1];
  
  if (!token) {
    return null;
  }
  
  const ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET;
  
  if (!ADMIN_JWT_SECRET) {
    return null;
  }
  
  try {
    const decoded = jwt.verify(token, ADMIN_JWT_SECRET) as { adminId: number, username: string };
    return decoded;
  } catch (error) {
    return null;
  }
}

export async function POST(request: Request) {
  try {
    // 验证管理员身份
    const admin = await verifyAdmin(request);
    
    if (!admin) {
      return NextResponse.json({ success: false, message: '未授权访问' }, { status: 401 });
    }
    
    // 连接数据库
    const connection = await connectToDatabase();
    
    try {
      // 清除设置中的临时模型数据
      await connection.execute(`
        DELETE FROM settings 
        WHERE setting_key = 'ollama_settings'
      `);
      
      // 标记缓存需要刷新
      const timestamp = new Date().toISOString();
      await connection.execute(`
        INSERT INTO settings (setting_key, setting_value, created_at, updated_at)
        VALUES ('cache_invalidated_at', ?, NOW(), NOW())
        ON DUPLICATE KEY UPDATE setting_value = ?, updated_at = NOW()
      `, [timestamp, timestamp]);
      
      return NextResponse.json({
        success: true,
        message: '服务器缓存已清除',
        timestamp
      });
      
    } finally {
      // 关闭数据库连接
      await connection.end();
    }
    
  } catch (error: any) {
    console.error('清除缓存失败:', error);
    return NextResponse.json({ 
      success: false, 
      message: '清除缓存失败: ' + error.message 
    }, { status: 500 });
  }
} 