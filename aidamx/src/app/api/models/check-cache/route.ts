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

export async function GET() {
  try {
    // 连接数据库
    const connection = await connectToDatabase();
    
    try {
      // 获取缓存失效时间戳
      const [result] = await connection.execute(`
        SELECT setting_value, updated_at
        FROM settings
        WHERE setting_key = 'cache_invalidated_at'
        ORDER BY updated_at DESC
        LIMIT 1
      `);
      
      const rows = result as any[];
      
      // 如果没有缓存失效标记，则不需要刷新
      if (rows.length === 0) {
        return NextResponse.json({
          success: true,
          needsRefresh: false
        });
      }
      
      // 获取客户端存储的时间戳（如果有）
      const clientTimestamp = new Headers().get('X-Cache-Timestamp');
      
      // 获取服务器时间戳
      const serverTimestamp = rows[0].setting_value;
      const updatedAt = new Date(rows[0].updated_at).getTime();
      
      // 如果没有客户端时间戳，或者服务器时间戳更新，则需要刷新
      if (!clientTimestamp || new Date(clientTimestamp).getTime() < updatedAt) {
        return NextResponse.json({
          success: true,
          needsRefresh: true,
          timestamp: serverTimestamp,
          updatedAt
        });
      }
      
      return NextResponse.json({
        success: true,
        needsRefresh: false,
        timestamp: serverTimestamp
      });
      
    } finally {
      // 关闭数据库连接
      await connection.end();
    }
    
  } catch (error: any) {
    console.error('检查缓存状态失败:', error);
    return NextResponse.json({ 
      success: false, 
      message: '检查缓存状态失败: ' + error.message,
      needsRefresh: true  // 出错时默认需要刷新
    }, { status: 500 });
  }
} 