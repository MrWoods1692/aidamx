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

// 获取特定聊天的消息列表
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
    
    // 首先验证该聊天记录是否属于当前用户
    const [chatResult] = await connection.execute(`
      SELECT id FROM chat_history
      WHERE id = ? AND user_id = ?
      LIMIT 1
    `, [chatId, userId]);
    
    const chatArray = chatResult as any[];
    
    if (chatArray.length === 0) {
      await connection.end();
      return NextResponse.json({
        success: false,
        message: '聊天记录不存在或无权访问'
      }, { status: 404 });
    }
    
    // 获取聊天消息
    const [messagesResult] = await connection.execute(`
      SELECT id, content, role, created_at
      FROM chat_messages
      WHERE chat_id = ?
      ORDER BY created_at ASC
    `, [chatId]);
    
    const messagesList = messagesResult as any[];

    // 获取所有消息的图片路径
    const [imagesResult] = await connection.execute(`
      SELECT message_id, file_path, file_name, mime_type
      FROM chat_images
      WHERE message_id IN (
        SELECT id FROM chat_messages WHERE chat_id = ?
      )
    `, [chatId]);
    
    const imagesList = imagesResult as any[];
    
    // 建立消息ID到图片路径的映射
    const messageImageMap = new Map();
    imagesList.forEach((img: any) => {
      const messageId = img.message_id.toString();
      if (!messageImageMap.has(messageId)) {
        messageImageMap.set(messageId, []);
      }
      messageImageMap.get(messageId).push(img.file_path);
    });
    
    // 获取聊天标题
    const [titleResult] = await connection.execute(`
      SELECT title
      FROM chat_history
      WHERE id = ?
      LIMIT 1
    `, [chatId]);
    
    const titleArray = titleResult as any[];
    const title = titleArray[0]?.title || '未命名对话';
    
    // 关闭数据库连接
    await connection.end();
    
    // 转换消息格式为前端需要的格式
    const formattedMessages = messagesList.map((msg: any) => {
      // 获取消息的图片路径
      const imagePaths = messageImageMap.get(msg.id.toString()) || [];
      
      // 从内容中移除图片提示标记
      let cleanContent = msg.content;
      if (imagePaths.length > 0) {
        cleanContent = cleanContent.replace(/\[图片已上传\].*$/, '').trim();
      }
      
      return {
        id: msg.id.toString(),
        role: msg.role,
        content: cleanContent,
        timestamp: msg.created_at,
        // 如果有图片，添加到persistentImagePaths
        ...(imagePaths.length > 0 && { persistentImagePaths: imagePaths })
      };
    });
    
    return NextResponse.json({
      success: true,
      data: {
        chatId,
        title,
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