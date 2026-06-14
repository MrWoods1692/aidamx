import { NextResponse } from 'next/server';
import mysql from 'mysql2/promise';
import { cookies } from 'next/headers';
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

// 从cookie获取用户ID
async function getUserId() {
  const cookieStore = await cookies();
  const userToken = cookieStore.get('auth_token')?.value;
  
  if (!userToken) {
    return null;
  }
  
  const JWT_SECRET = process.env.JWT_SECRET;
  
  if (!JWT_SECRET) {
    return null;
  }
  
  try {
    const decoded = jwt.verify(userToken, JWT_SECRET) as { userId: number };
    return decoded.userId;
  } catch (error) {
    console.error('Token验证失败:', error);
    return null;
  }
}

// 获取用户的聊天历史记录列表
export async function GET(request: Request) {
  try {
    // 获取当前登录用户
    const userId = await getUserId();
    if (!userId) {
      return NextResponse.json({
        success: false,
        message: '未登录'
      }, { status: 401 });
    }
    
    // 连接数据库
    const connection = await connectToDatabase();
    
    // 获取聊天历史记录
    const [historyResults] = await connection.execute(`
      SELECT h.id, h.title, h.created_at, h.updated_at,
             (SELECT content FROM chat_messages WHERE chat_id = h.id ORDER BY created_at ASC LIMIT 1) as first_message,
             (SELECT count(*) FROM chat_messages WHERE chat_id = h.id) as message_count
      FROM chat_history h
      WHERE h.user_id = ?
      ORDER BY h.updated_at DESC
    `, [userId]);
    
    const historyList = historyResults as any[];
    
    // 关闭数据库连接
    await connection.end();
    
    return NextResponse.json({
      success: true,
      data: historyList
    });
  } catch (error: any) {
    console.error('获取聊天历史记录失败:', error);
    return NextResponse.json({
      success: false,
      message: `获取聊天历史记录失败: ${error.message || '未知错误'}`
    }, { status: 500 });
  }
} 