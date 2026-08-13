import { NextResponse } from 'next/server';
import mysql from 'mysql2/promise';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';

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

// 处理聊天发送请求
export async function POST(request: Request) {
  try {
    // 解析请求体
    const body = await request.json();
    const { content, chatId: existingChatId, modelId: requestedModelId, images } = body;
    
    if (!content && (!images || images.length === 0)) {
      return NextResponse.json({
        success: false,
        message: '消息内容和图片都为空'
      }, { status: 400 });
    }
    
    // 获取用户ID
    const userId = await getUserId();
    
    // 如果用户未登录
    if (!userId) {
      return NextResponse.json({
        success: false,
        message: '用户未登录'
      }, { status: 401 });
    }
    
    // 连接数据库
    const connection = await connectToDatabase();
    
    try {
      // 检查用户是否被封禁
      try {
        const [userStatusResult] = await connection.execute(
          `SELECT is_banned FROM users WHERE id = ?`,
          [userId]
        );
        
        const userStatusArray = userStatusResult as any[];
        
        if (userStatusArray.length > 0 && userStatusArray[0].is_banned) {
          return NextResponse.json({
            success: false,
            message: '您的账户已被封禁，无法发送消息',
            data: {
              id: Date.now().toString(),
              role: 'assistant',
              content: '您的账户已被封禁，请联系管理员解决',
              timestamp: new Date()
            }
          }, { status: 403 });
        }
      } catch (statusError: any) {
        // 如果是字段不存在的错误
        if (statusError.message.includes("Unknown column 'is_banned'")) {
          console.log('is_banned字段不存在，尝试添加...');
          try {
            // 添加is_banned字段
            await connection.execute(
              'ALTER TABLE users ADD COLUMN is_banned BOOLEAN NOT NULL DEFAULT FALSE'
            );
            console.log('已成功添加is_banned字段');
          } catch (alterError: any) {
            console.error('添加is_banned字段失败:', alterError.message);
            // 字段添加失败，但仍然继续处理请求
          }
        } else {
          // 其他错误，记录但继续执行
          console.error('检查用户封禁状态失败:', statusError.message);
        }
      }
      
      // 添加重试函数
      async function fetchWithRetry(url: string, options: RequestInit, maxRetries = 3, delay = 1000) {
        let lastError;
        
        for (let i = 0; i < maxRetries; i++) {
          try {
            const response = await fetch(url, options);
            return response;
          } catch (error) {
            console.error(`API请求失败，正在进行第${i+1}次重试，错误:`, error);
            lastError = error;
            
            // 指数退避，每次重试增加延迟
            await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, i)));
          }
        }
        
        // 如果所有重试都失败，抛出最后的错误
        throw lastError;
      }
      
      // 优先使用请求中指定的模型ID，如果没有则从数据库获取
      let selectedModelId = requestedModelId || '';
      
      if (!selectedModelId) {
        // 首先检查用户是否有自定义模型设置
        const [userSettingsResult] = await connection.execute(`
          SELECT selected_model
          FROM user_model_settings
          WHERE user_id = ?
          LIMIT 1
        `, [userId]);
        
        const userSettingsArray = userSettingsResult as any[];
        
        if (userSettingsArray.length > 0) {
          selectedModelId = userSettingsArray[0].selected_model;
        } else {
          // 如果用户没有自定义设置，使用系统默认设置
          const [systemSettingsResult] = await connection.execute(`
            SELECT selected_model
            FROM model_settings
            ORDER BY id DESC
            LIMIT 1
          `);
          
          const systemSettingsArray = systemSettingsResult as any[];
          
          if (systemSettingsArray.length > 0) {
            selectedModelId = systemSettingsArray[0].selected_model;
          }
        }
      }
      
      if (!selectedModelId) {
        return NextResponse.json({
          success: false,
          message: '未配置模型，请先在管理员面板配置模型'
        }, { status: 400 });
      }
      
      // 获取API设置
      let apiEndpoint = '';
      let apiKey = '';
      
      const [apiSettingsResult] = await connection.execute(`
        SELECT endpoint, api_key
        FROM model_settings
        ORDER BY id DESC
        LIMIT 1
      `);
      
      const apiSettingsArray = apiSettingsResult as any[];
      
      if (apiSettingsArray.length === 0) {
        return NextResponse.json({
          success: false,
          message: '未配置API设置，请先在管理员面板配置API'
        }, { status: 400 });
      }
      
      const apiSettings = apiSettingsArray[0];
      apiEndpoint = apiSettings.endpoint.endsWith('/') 
        ? apiSettings.endpoint 
        : `${apiSettings.endpoint}/`;
      apiKey = apiSettings.api_key;
      
      // 创建或使用现有聊天记录
      let chatId: number;
      
      if (existingChatId) {
        // 验证聊天记录是否属于当前用户
        const [chatCheckResult] = await connection.execute(`
          SELECT id FROM chat_history
          WHERE id = ? AND user_id = ?
          LIMIT 1
        `, [existingChatId, userId]);
        
        const chatCheckArray = chatCheckResult as any[];
        
        if (chatCheckArray.length === 0) {
          // 如果聊天记录不存在或不属于当前用户，创建新的聊天记录
          const [chatResult] = await connection.execute(`
            INSERT INTO chat_history (user_id, title, created_at)
            VALUES (?, ?, NOW())
          `, [userId, `${content.trim().substring(0, 30)}${content.length > 30 ? '...' : ''}`]);
          
          const chatInsertResult = chatResult as any;
          chatId = chatInsertResult.insertId;
        } else {
          // 使用现有聊天记录
          chatId = existingChatId;
          
          // 更新聊天记录的更新时间
          await connection.execute(`
            UPDATE chat_history 
            SET updated_at = NOW() 
            WHERE id = ?
          `, [chatId]);
        }
      } else {
        // 创建新的聊天记录
        const [chatResult] = await connection.execute(`
          INSERT INTO chat_history (user_id, title, created_at)
          VALUES (?, ?, NOW())
        `, [userId, `${content.trim().substring(0, 30)}${content.length > 30 ? '...' : ''}`]);
        
        const chatInsertResult = chatResult as any;
        chatId = chatInsertResult.insertId;
      }
      
      // 处理图片保存（如果有）
      const imagePaths: string[] = [];
      
      if (images && images.length > 0) {
        // 确保上传目录存在
        const uploadDir = path.join(process.cwd(), 'public', 'uploads');
        if (!fs.existsSync(uploadDir)) {
          fs.mkdirSync(uploadDir, { recursive: true });
        }
        
        for (let i = 0; i < images.length; i++) {
          const base64Data = images[i];
          
          // 从base64字符串中提取MIME类型和数据
          const matches = base64Data.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
          
          if (!matches || matches.length !== 3) {
            continue; // 跳过无效的base64数据
          }
          
          const mimeType = matches[1];
          const base64Image = matches[2];
          const fileExtension = mimeType.split('/')[1];
          const fileName = `${Date.now()}_${i}.${fileExtension}`;
          const filePath = path.join(uploadDir, fileName);
          
          // 保存文件
          fs.writeFileSync(filePath, Buffer.from(base64Image, 'base64'));
          
          // 存储相对路径，用于构建URL
          const relativePath = `/uploads/${fileName}`;
          imagePaths.push(relativePath);
        }
      }
      
      // 修改用户消息内容，包含图片标记
      let userMessage = content;
      if (imagePaths.length > 0) {
        // 使用更详细的图片描述，告诉模型有图片需要分析
        userMessage += '\n\n[图片已上传] 请分析这些图片内容并在回复中包含对图片的描述和分析。';
      }
      
      // 存储用户消息
      const [messageResult] = await connection.execute(`
        INSERT INTO chat_messages (chat_id, content, role, created_at)
        VALUES (?, ?, 'user', NOW())
      `, [chatId, userMessage]);
      
      const messageInsertResult = messageResult as any;
      const messageId = messageInsertResult.insertId;
      
      // 存储图片记录
      if (imagePaths.length > 0) {
        for (let i = 0; i < imagePaths.length; i++) {
          const filePath = imagePaths[i];
          const fileName = path.basename(filePath);
          await connection.execute(`
            INSERT INTO chat_images (message_id, file_path, file_name, mime_type, created_at)
            VALUES (?, ?, ?, ?, NOW())
          `, [messageId, filePath, fileName, images[i].match(/^data:([A-Za-z-+\/]+);base64,/)[1]]);
        }
      }
      
      // 获取该聊天的历史消息，构建上下文
      const [historyResult] = await connection.execute(`
        SELECT content, role
        FROM chat_messages
        WHERE chat_id = ?
        ORDER BY created_at ASC
      `, [chatId]);
      
      const historyArray = historyResult as any[];
      
      // 构建消息历史
      const messages = [
        { role: 'system', content: '你是一个智能AI助手。你应该：1) 提供有用、准确、诚实的信息 2) 尊重用户隐私 3) 回答全面但简洁 4) 有礼貌和耐心 5) 在不确定时表明自己的局限性 6) 避免有害、不道德、歧视或非法的内容。当用户上传图片时（消息中包含[图片已上传]标记），请假设你有能力看到这些图片并分析其内容。尽可能详细地描述和分析这些图片内容，根据图片提供相关信息。你的目标是帮助用户解决问题并提供有价值的信息。' },
      ];
      
      // 计算token相关设置
      const estimatedTokensPerMessage = 4; // 每个单词大约消耗的token数
      const maxTokens = 4096; // 大多数模型的最大token限制
      const systemPromptTokens = Math.ceil(messages[0].content.split(' ').length * estimatedTokensPerMessage);
      let totalTokens = systemPromptTokens;
      let currentMessageTokens = Math.ceil(content.split(' ').length * estimatedTokensPerMessage);
      totalTokens += currentMessageTokens;
      
      // 逆序添加历史消息，保证最近的消息被优先添加
      const reversedHistory = [...historyArray].reverse();
      const addedMessages = [];
      
      // 智能添加历史消息，避免超出token限制
      for (const msg of reversedHistory) {
        const msgTokens = Math.ceil(msg.content.split(' ').length * estimatedTokensPerMessage);
        
        // 如果添加这条消息会超出token限制的80%，就停止添加
        // 保留空间给模型的回复
        if (totalTokens + msgTokens > maxTokens * 0.8) {
          break;
        }
        
        totalTokens += msgTokens;
        addedMessages.unshift(msg); // 添加到前面，恢复正确顺序
      }
      
      // 添加所有可以添加的历史消息
      for (const msg of addedMessages) {
        messages.push({
          role: msg.role,
          content: msg.content
        });
      }
      
      // 添加当前用户的最新消息
      messages.push({ 
        role: 'user', 
        content: userMessage // 使用包含图片标记的消息
      });
      
      // 调用API
      try {
        let aiResponse = '';
        
        // 调用标准OpenAI兼容API
        const response = await fetchWithRetry(`${apiEndpoint}v1/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model: selectedModelId,
            messages: messages,
            temperature: 0.7,
          }),
        }, 3, 1000);
        
        if (!response.ok) {
          const errText = await response.text();
          throw new Error(`API请求失败(${response.status}): ${errText}`);
        }
        
        const data = await response.json();
        
        // 检查API响应
        if (!data.choices || !data.choices[0] || !data.choices[0].message) {
          throw new Error('API返回的数据格式不正确');
        }
        
        aiResponse = data.choices[0].message.content;
        }
        
        // 存储AI回复
        await connection.execute(`
          INSERT INTO chat_messages (chat_id, content, role, created_at)
          VALUES (?, ?, 'assistant', NOW())
        `, [chatId, aiResponse]);
        
        // 返回成功响应时包含使用的模型ID和图片URL
        return NextResponse.json({
          success: true,
          data: {
            id: Date.now().toString(),
            role: 'assistant',
            content: aiResponse,
            timestamp: new Date(),
            chatId: chatId,
            modelId: selectedModelId,
            userImagePaths: imagePaths // 返回保存的图片路径
          }
        });
        
      } catch (apiError: any) {
        console.error('API调用失败:', apiError);
        
        // 存储API错误作为AI回复
        const errorMessage = `调用AI模型失败: ${apiError.message}`;
        await connection.execute(`
          INSERT INTO chat_messages (chat_id, content, role, created_at)
          VALUES (?, ?, 'assistant', NOW())
        `, [chatId, errorMessage]);
        
        return NextResponse.json({
          success: false,
          message: errorMessage,
          data: {
            id: Date.now().toString(),
            role: 'assistant',
            content: `抱歉，发生了错误: ${apiError.message}`,
            timestamp: new Date(),
            chatId: chatId,
            modelId: selectedModelId
          }
        }, { status: 500 });
      }
      
    } finally {
      // 关闭数据库连接
      await connection.end();
    }
    
  } catch (error: any) {
    console.error('处理聊天消息失败:', error);
    return NextResponse.json({
      success: false,
      message: `处理聊天消息失败: ${error.message}`
    }, { status: 500 });
  }
}
