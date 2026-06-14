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

// 自动生成聊天标题
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
    
    // 解析请求数据
    const data = await request.json();
    const { chatId, localTitle } = data;
    
    if (!chatId) {
      return NextResponse.json({
        success: false,
        message: '缺少聊天ID'
      }, { status: 400 });
    }
    
    // 连接数据库
    const connection = await connectToDatabase();
    
    // 验证该聊天记录是否属于当前用户
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
    
    // 确定要使用的标题
    let title = '';
    
    // 优先使用前端传递的本地标题
    if (localTitle) {
      title = localTitle;
    } else {
      // 只有当前端没有提供标题时，才获取消息内容生成标题
      // 获取前几条聊天消息
      const [messagesResult] = await connection.execute(`
        SELECT content, role 
        FROM chat_messages 
        WHERE chat_id = ? 
        ORDER BY created_at ASC 
        LIMIT 3
      `, [chatId]);
      
      const messagesArray = messagesResult as any[];
      
      if (messagesArray.length === 0) {
        await connection.end();
        return NextResponse.json({
          success: false,
          message: '聊天记录中没有消息'
        }, { status: 400 });
      }
      
      // 使用第一条用户消息作为标题基础
      const userMessage = messagesArray.find(msg => msg.role === 'user');
      if (userMessage) {
        // 提取消息的前30个字符作为标题
        title = userMessage.content.trim().substring(0, 30);
        
        // 如果消息被截断，添加省略号
        if (userMessage.content.length > 30) {
          title += '...';
        }
      } else {
        // 如果没有用户消息，使用AI的第一条回复
        const assistantMessage = messagesArray.find(msg => msg.role === 'assistant');
        if (assistantMessage) {
          title = assistantMessage.content.trim().substring(0, 30);
          if (assistantMessage.content.length > 30) {
            title += '...';
          }
        } else {
          title = '新对话';
        }
      }
    }
    
    // 更新聊天标题
    await connection.execute(`
      UPDATE chat_history
      SET title = ?, updated_at = NOW()
      WHERE id = ? AND user_id = ?
    `, [title, chatId, userId]);
    
    // 关闭数据库连接
    await connection.end();
    
    return NextResponse.json({
      success: true,
      data: {
        title
      },
      message: '聊天标题生成成功'
    });
  } catch (error: any) {
    console.error('生成聊天标题失败:', error);
    return NextResponse.json({
      success: false,
      message: `生成聊天标题失败: ${error.message || '未知错误'}`
    }, { status: 500 });
  }
} 