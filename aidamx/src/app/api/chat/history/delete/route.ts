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

// 获取用户ID（如果有）
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
    return null;
  }
}

// 删除聊天记录
export async function DELETE(request: Request) {
  try {
    // 获取用户ID
    const userId = await getUserId();
    
    if (!userId) {
      return NextResponse.json({
        success: false,
        message: '用户未登录'
      }, { status: 401 });
    }
    
    // 获取聊天ID
    const url = new URL(request.url);
    const chatId = url.searchParams.get('chatId');
    
    if (!chatId) {
      return NextResponse.json({
        success: false,
        message: '缺少聊天ID参数'
      }, { status: 400 });
    }
    
    // 连接数据库
    const connection = await connectToDatabase();
    
    try {
      // 开始事务
      await connection.beginTransaction();
      
      // 1. 检查聊天记录是否存在且属于当前用户
      const [chatResult] = await connection.execute(
        'SELECT id FROM chat_history WHERE id = ? AND user_id = ?',
        [chatId, userId]
      );
      
      const chats = chatResult as any[];
      
      if (chats.length === 0) {
        await connection.rollback();
        return NextResponse.json({
          success: false,
          message: '聊天记录不存在或不属于当前用户'
        }, { status: 404 });
      }
      
      // 2. 删除聊天消息
      await connection.execute(
        'DELETE FROM chat_messages WHERE chat_id = ?',
        [chatId]
      );
      
      // 3. 删除聊天记录
      await connection.execute(
        'DELETE FROM chat_history WHERE id = ? AND user_id = ?',
        [chatId, userId]
      );
      
      // 提交事务
      await connection.commit();
      
      return NextResponse.json({
        success: true,
        message: '聊天记录已删除'
      });
      
    } catch (error: any) {
      // 回滚事务
      await connection.rollback();
      throw error;
    } finally {
      // 关闭数据库连接
      await connection.end();
    }
    
  } catch (error: any) {
    console.error('删除聊天记录失败:', error);
    return NextResponse.json({
      success: false,
      message: '删除聊天记录失败: ' + error.message
    }, { status: 500 });
  }
} 