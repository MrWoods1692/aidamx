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

// 更新聊天标题
export async function POST(request: Request) {
  try {
    // 获取当前登录用户
    const userId = await getUserId();
    if (!userId) {
      return NextResponse.json({
        success: false,
        message: '未登录'
      }, { status: 401 });
    }
    
    // 解析请求体
    const body = await request.json();
    const { chatId, title } = body;
    
    // 验证参数
    if (!chatId || !title) {
      return NextResponse.json({
        success: false,
        message: '缺少必要参数'
      }, { status: 400 });
    }
    
    // 连接数据库
    const connection = await connectToDatabase();
    
    // 确认聊天记录属于当前用户
    const [chat] = await connection.execute(`
      SELECT id FROM chat_history 
      WHERE id = ? AND user_id = ?
    `, [chatId, userId]);
    
    if (!(chat as any[]).length) {
      await connection.end();
      return NextResponse.json({
        success: false,
        message: '聊天记录不存在或无权修改'
      }, { status: 403 });
    }
    
    // 更新标题
    await connection.execute(`
      UPDATE chat_history 
      SET title = ?, updated_at = NOW() 
      WHERE id = ? AND user_id = ?
    `, [title, chatId, userId]);
    
    // 关闭数据库连接
    await connection.end();
    
    return NextResponse.json({
      success: true,
      message: '标题更新成功'
    });
  } catch (error: any) {
    console.error('更新聊天标题失败:', error);
    return NextResponse.json({
      success: false,
      message: `更新聊天标题失败: ${error.message || '未知错误'}`
    }, { status: 500 });
  }
} 