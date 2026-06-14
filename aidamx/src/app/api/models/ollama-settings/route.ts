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
      // 获取Ollama设置
      const [settingsResult] = await connection.execute(`
        SELECT setting_value
        FROM settings
        WHERE setting_key = 'ollama_settings'
        LIMIT 1
      `);
      
      const rows = settingsResult as any[];
      
      // 如果没有Ollama设置，返回空数据
      if (rows.length === 0) {
        return NextResponse.json({
          success: true,
          data: null
        });
      }
      
      try {
        // 解析设置数据
        const ollamaSettings = JSON.parse(rows[0].setting_value);
        
        return NextResponse.json({
          success: true,
          data: ollamaSettings
        });
      } catch (error) {
        console.error('解析Ollama设置失败:', error);
        return NextResponse.json({
          success: false,
          message: '解析Ollama设置失败',
          data: null
        });
      }
      
    } finally {
      // 关闭数据库连接
      await connection.end();
    }
    
  } catch (error: any) {
    console.error('获取Ollama设置失败:', error);
    return NextResponse.json({ 
      success: false, 
      message: '获取Ollama设置失败: ' + error.message,
      data: null
    }, { status: 500 });
  }
} 