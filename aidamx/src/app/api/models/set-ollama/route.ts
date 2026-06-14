import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import mysql, { RowDataPacket } from 'mysql2/promise';

// 创建数据库连接函数
async function createConnection() {
  return await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT ? parseInt(process.env.DB_PORT) : 3306
  });
}

interface SettingsRow extends RowDataPacket {
  id: number;
  setting_key: string;
  setting_value: string;
  created_at: Date;
  updated_at: Date;
}

export async function POST(req: NextRequest) {
  try {
    // 获取查询参数
    const url = new URL(req.url);
    const model = url.searchParams.get('model');
    const apiUrl = url.searchParams.get('apiUrl');
    
    if (!model) {
      return NextResponse.json({ success: false, message: '未提供模型名称' }, { status: 400 });
    }
    
    if (!apiUrl) {
      return NextResponse.json({ success: false, message: '未提供 API URL' }, { status: 400 });
    }
    
    // 保存到数据库
    const connection = await createConnection();
    
    try {
      // 检查是否已存在 Ollama 设置
      const [existingRows] = await connection.execute<SettingsRow[]>(
        'SELECT * FROM settings WHERE setting_key = ?',
        ['ollama_settings']
      );
      
      const ollamaSettings = {
        apiUrl,
        model
      };
      
      if (existingRows.length > 0) {
        // 更新现有设置
        await connection.execute(
          'UPDATE settings SET setting_value = ?, updated_at = NOW() WHERE setting_key = ?',
          [JSON.stringify(ollamaSettings), 'ollama_settings']
        );
      } else {
        // 创建新设置
        await connection.execute(
          'INSERT INTO settings (setting_key, setting_value, created_at, updated_at) VALUES (?, ?, NOW(), NOW())',
          ['ollama_settings', JSON.stringify(ollamaSettings)]
        );
      }
      
      // 将 Ollama 模型设置为当前选定的模型
      // 检查是否存在现有模型设置
      const [modelSettingsRows] = await connection.execute<SettingsRow[]>(
        'SELECT * FROM settings WHERE setting_key = ?',
        ['model_settings']
      );
      
      let modelSettings: any = {};
      
      if (modelSettingsRows.length > 0) {
        try {
          modelSettings = JSON.parse(modelSettingsRows[0].setting_value);
        } catch (e) {
          // 如果解析失败，使用空对象
          modelSettings = {};
        }
      }
      
      // 更新模型设置
      modelSettings.selectedModel = `ollama:${model}`;
      modelSettings.modelType = 'ollama';
      
      if (modelSettingsRows.length > 0) {
        // 更新现有设置
        await connection.execute(
          'UPDATE settings SET setting_value = ?, updated_at = NOW() WHERE setting_key = ?',
          [JSON.stringify(modelSettings), 'model_settings']
        );
      } else {
        // 创建新设置
        await connection.execute(
          'INSERT INTO settings (setting_key, setting_value, created_at, updated_at) VALUES (?, ?, NOW(), NOW())',
          ['model_settings', JSON.stringify(modelSettings)]
        );
      }
      
      return NextResponse.json({ 
        success: true, 
        message: '成功设置 Ollama 模型',
        model,
        apiUrl
      });
    } finally {
      connection.end();
    }
  } catch (error: any) {
    console.error('设置 Ollama 模型时出错:', error);
    return NextResponse.json(
      { success: false, message: `设置 Ollama 模型失败: ${error.message}` },
      { status: 500 }
    );
  }
} 