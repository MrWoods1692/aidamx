import { NextResponse } from 'next/server';
import mysql from 'mysql2/promise';
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

// 验证管理员身份（用于管理页面）
async function verifyAdmin(request: Request) {
  const token = request.headers.get('cookie')?.split(';')
    .find(c => c.trim().startsWith('admin_token='))
    ?.split('=')[1];
  
  if (!token) {
    return null;
  }
  
  const ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET;
  
  if (!ADMIN_JWT_SECRET) {
    return null;
  }
  
  try {
    const decoded = jwt.verify(token, ADMIN_JWT_SECRET) as { adminId: number, username: string };
    return decoded;
  } catch (error) {
    return null;
  }
}

export async function GET(request: Request) {
  try {
    // 连接数据库
    const connection = await connectToDatabase();
    
    try {
      // 首先获取API设置
      const [settingsResult] = await connection.execute(`
        SELECT 
          endpoint, 
          api_key,
          selected_model
        FROM 
          model_settings
        ORDER BY 
          id DESC
        LIMIT 1
      `);
      
      const settingsArray = settingsResult as any[];
      
      if (settingsArray.length === 0) {
        // 没有API设置，返回空数组
        return NextResponse.json({
          success: true,
          data: []
        });
      }
      
      const settings = settingsArray[0];
      const endpoint = settings.endpoint;
      const apiKey = settings.api_key;
      
      if (!endpoint || !apiKey) {
        return NextResponse.json({
          success: true,
          message: 'API设置不完整，请先配置API端点和密钥',
          data: []
        });
      }
      
      // 从API获取模型列表
      const apiEndpoint = endpoint.endsWith('/') ? endpoint : `${endpoint}/`;
      
      try {
        const response = await fetch(`${apiEndpoint}v1/models`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
        });
        
        if (!response.ok) {
          console.error(`API请求失败: ${response.status} ${response.statusText}`);
          return NextResponse.json({
            success: true,
            message: `API请求失败(${response.status})，请检查API密钥是否正确`,
            data: []
          });
        }
        
        const data = await response.json();
        
        if (!data.data || !Array.isArray(data.data)) {
          console.error('API返回的模型数据格式不正确');
          return NextResponse.json({
            success: true,
            message: 'API返回的模型数据格式不正确',
            data: []
          });
        }
        
        // 处理可能的重复项
        const uniqueModelsMap = new Map();
        data.data.forEach((model: {id: string, name?: string}) => {
          if (!uniqueModelsMap.has(model.id)) {
            uniqueModelsMap.set(model.id, model);
          }
        });
        
        const models = Array.from(uniqueModelsMap.values());
        
        // 获取所有模型的自定义图标
        const [iconsResult] = await connection.execute(`
          SELECT 
            model_id, 
            icon_path
          FROM 
            model_icons
        `);
        
        const icons = iconsResult as any[];
        
        // 获取所有模型的标签
        const [tagsResult] = await connection.execute(`
          SELECT 
            model_id, 
            text, 
            color
          FROM 
            model_tags
        `);
        
        const tags = tagsResult as any[];
        
        // 合并数据，将图标和标签添加到对应的模型中
        const modelsWithCustomData = models.map((model: {id: string, name?: string}) => {
          // 找到与模型ID匹配的图标
          const icon = icons.find(icon => icon.model_id === model.id);
          
          // 找到与模型ID匹配的标签
          const modelTags = tags
            .filter(tag => tag.model_id === model.id)
            .map(tag => ({
              text: tag.text,
              color: tag.color
            }));
          
          return {
            id: model.id,
            name: model.name,
            icon: icon ? icon.icon_path : "/images/modelimg/gpt6.png", // 使用默认图标
            tags: modelTags
          };
        });
        
        return NextResponse.json({
          success: true,
          data: modelsWithCustomData
        });
        
      } catch (apiError: any) {
        console.error('API请求错误:', apiError);
        return NextResponse.json({
          success: true,
          message: `API请求错误: ${apiError.message}`,
          data: []
        });
      }
      
    } finally {
      // 关闭数据库连接
      await connection.end();
    }
    
  } catch (error: any) {
    console.error('获取模型列表失败:', error);
    return NextResponse.json({ 
      success: true, 
      message: `获取模型列表失败: ${error.message}`,
      data: []
    }, { status: 500 });
  }
} 