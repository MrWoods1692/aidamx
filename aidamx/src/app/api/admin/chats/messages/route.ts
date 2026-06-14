import { NextResponse } from 'next/server';
import mysql from 'mysql2/promise';
import jwt from 'jsonwebtoken';

// 使用环境变量中的管理员JWT密钥
const ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET;

// 确保必要的环境变量已设置
if (!ADMIN_JWT_SECRET) {
  console.error('警告: ADMIN_JWT_SECRET环境变量未设置!');
}

// 数据库连接
async function connectToDatabase() {
  try {
    return await mysql.createConnection({
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT),
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME
    });
  } catch (error) {
    console.error('数据库连接失败:', error);
    throw new Error('数据库连接失败');
  }
}

// 管理员获取特定聊天的消息内容
export async function GET(request: Request) {
  try {
    // 获取cookie中的管理员令牌
    const token = request.headers.get('cookie')?.split(';')
      .find(c => c.trim().startsWith('admin_token='))
      ?.split('=')[1];
    
    if (!token) {
      return NextResponse.json({
        success: false,
        message: '未登录'
      }, { status: 401 });
    }
    
    // 在JWT验证之前添加检查
    if (!ADMIN_JWT_SECRET) {
      return NextResponse.json({
        success: false,
        message: '服务器配置错误: JWT密钥未设置'
      }, { status: 500 });
    }
    
    // 验证令牌
    try {
      jwt.verify(token, ADMIN_JWT_SECRET);
    } catch (error) {
      return NextResponse.json({
        success: false,
        message: '会话已过期或无效'
      }, { status: 401 });
    }
    
    // 从URL参数获取聊天ID
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
    
    // 获取聊天基本信息
    const [chatInfoResult] = await connection.execute(`
      SELECT 
        h.id, 
        h.title, 
        h.created_at, 
        h.updated_at,
        h.user_id,
        u.email as user_email,
        u.name as user_name
      FROM chat_history h
      JOIN users u ON h.user_id = u.id
      WHERE h.id = ?
      LIMIT 1
    `, [chatId]);
    
    const chatInfoArray = chatInfoResult as any[];
    
    if (chatInfoArray.length === 0) {
      await connection.end();
      return NextResponse.json({
        success: false,
        message: '聊天记录不存在'
      }, { status: 404 });
    }
    
    const chatInfo = chatInfoArray[0];
    
    // 获取聊天消息
    const [messagesResult] = await connection.execute(`
      SELECT id, content, role, created_at
      FROM chat_messages
      WHERE chat_id = ?
      ORDER BY created_at ASC
    `, [chatId]);
    
    const messagesList = messagesResult as any[];
    
    // 关闭数据库连接
    await connection.end();
    
    // 转换消息格式为前端需要的格式
    const formattedMessages = messagesList.map((msg: any) => ({
      id: msg.id.toString(),
      role: msg.role,
      content: msg.content,
      timestamp: msg.created_at
    }));
    
    return NextResponse.json({
      success: true,
      data: {
        chatInfo,
        messages: formattedMessages
      }
    });
  } catch (error: any) {
    console.error('获取聊天消息失败:', error);
    return NextResponse.json({
      success: false,
      message: `获取聊天消息失败: ${error.message || '未知错误'}`
    }, { status: 500 });
  }
} 