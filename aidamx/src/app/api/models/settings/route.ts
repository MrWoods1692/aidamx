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

// 验证管理员身份
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

// GET: 获取当前的模型设置
export async function GET() {
  try {
    // 连接数据库
    const connection = await connectToDatabase();
    
    try {
      // 获取用户ID（如果已登录）
      const userId = await getUserId();
      
      // 如果用户已登录，检查用户是否有自定义设置
      if (userId) {
        const [userSettingsResult] = await connection.execute(`
          SELECT selected_model
          FROM user_model_settings
          WHERE user_id = ?
          LIMIT 1
        `, [userId]);
        
        const userSettingsArray = userSettingsResult as any[];
        
        if (userSettingsArray.length > 0) {
          // 返回用户自定义的模型设置
          return NextResponse.json({
            success: true,
            data: {
              model: userSettingsArray[0].selected_model
            }
          });
        }
      }
      
      // 没有用户设置，检查临时设置（未登录用户）
      const cookieStore = await cookies();
      const tempModel = cookieStore.get('temp_model')?.value;
      if (tempModel) {
        return NextResponse.json({
          success: true,
          data: {
            model: tempModel
          }
        });
      }
      
      // 获取全局设置
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
        return NextResponse.json({
          success: true,
          data: null
        });
      }
      
      const settings = settingsArray[0];
      
      return NextResponse.json({
        success: true,
        data: {
          endpoint: settings.endpoint,
          apiKey: settings.api_key,
          model: settings.selected_model
        }
      });
      
    } finally {
      // 关闭数据库连接
      await connection.end();
    }
    
  } catch (error: any) {
    console.error('获取模型设置失败:', error);
    return NextResponse.json({ 
      success: false, 
      message: '获取模型设置失败: ' + error.message 
    }, { status: 500 });
  }
}

// POST: 保存模型设置（管理员专用）
export async function POST(request: Request) {
  try {
    // 验证管理员身份
    const admin = await verifyAdmin(request);
    
    if (!admin) {
      return NextResponse.json({ message: '未授权访问' }, { status: 401 });
    }
    
    // 解析请求体
    const { endpoint, apiKey, selectedModel, providerId } = await request.json();
    
    // 验证请求数据
    if (!selectedModel) {
      return NextResponse.json({ 
        success: false, 
        message: '请提供选定的模型' 
      }, { status: 400 });
    }
    
    // 连接数据库
    const connection = await connectToDatabase();
    
    try {
      // 确保模型存在
      const [modelResult] = await connection.execute(
        'SELECT id FROM models WHERE id = ?',
        [selectedModel]
      );
      
      const modelArray = modelResult as any[];
      
      if (modelArray.length === 0) {
        // 模型不存在，先插入模型数据
        await connection.execute(
          'INSERT INTO models (id) VALUES (?)',
          [selectedModel]
        );
      }
      
      // 如果有providerId，使用新的多服务商系统
      if (providerId && endpoint && apiKey) {
        // 确保provider存在
        const [providerResult] = await connection.execute(
          'SELECT id FROM providers WHERE id = ?',
          [providerId]
        );
        
        const providerArray = providerResult as any[];
        
        if (providerArray.length === 0) {
          // 创建provider
          await connection.execute(
            'INSERT INTO providers (name, endpoint, api_key, is_active, sort_order) VALUES (?, ?, ?, TRUE, 0)',
            [`Provider ${providerId}`, endpoint, apiKey]
          );
        } else {
          // 更新provider
          await connection.execute(
            'UPDATE providers SET endpoint = ?, api_key = ?, updated_at = NOW() WHERE id = ?',
            [endpoint, apiKey, providerId]
          );
        }
        
        // 插入或更新provider_models
        await connection.execute(`
          INSERT INTO provider_models (provider_id, model_id, display_name, is_enabled, sort_order)
          VALUES (?, ?, ?, TRUE, 0)
          ON DUPLICATE KEY UPDATE
            is_enabled = TRUE,
            updated_at = NOW()
        `, [providerId, selectedModel, selectedModel]);
      }
      
      // 同时更新旧的model_settings表（向后兼容）
      if (endpoint && apiKey) {
        await connection.execute(`
          INSERT INTO model_settings 
            (endpoint, api_key, selected_model) 
          VALUES 
            (?, ?, ?)
          ON DUPLICATE KEY UPDATE
            endpoint = VALUES(endpoint),
            api_key = VALUES(api_key),
            selected_model = VALUES(selected_model),
            updated_at = NOW()
        `, [endpoint, apiKey, selectedModel]);
      }
      
      return NextResponse.json({
        success: true,
        message: '模型设置已保存'
      });
      
    } finally {
      // 关闭数据库连接
      await connection.end();
    }
    
  } catch (error: any) {
    console.error('保存模型设置失败:', error);
    return NextResponse.json({ 
      success: false, 
      message: '保存模型设置失败: ' + error.message 
    }, { status: 500 });
  }
}

// PATCH: 用户选择模型（非管理员可用）
export async function PATCH(request: Request) {
  try {
    // 获取用户ID
    const userId = await getUserId();
    
    // 解析请求体
    const { selectedModel } = await request.json();
    
    // 验证请求数据
    if (!selectedModel) {
      return NextResponse.json({ 
        success: false, 
        message: '请提供选定的模型' 
      }, { status: 400 });
    }
    
    // 连接数据库
    const connection = await connectToDatabase();
    
    try {
      // 首先确认模型存在
      const [modelResult] = await connection.execute(
        'SELECT id FROM models WHERE id = ?',
        [selectedModel]
      );
      
      const modelArray = modelResult as any[];
      
      if (modelArray.length === 0) {
        // 如果模型不存在，先创建它
        try {
          await connection.execute(
            'INSERT INTO models (id) VALUES (?)',
            [selectedModel]
          );
          console.log('已创建新模型:', selectedModel);
        } catch (error) {
          console.error('创建模型失败:', error);
          return NextResponse.json({ 
            success: false,
            message: '所选模型不存在且无法创建'
          }, { status: 500 });
        }
      }
      
      if (userId) {
        // 用户已登录，保存用户的模型选择
        await connection.execute(`
          INSERT INTO user_model_settings
            (user_id, selected_model)
          VALUES
            (?, ?)
          ON DUPLICATE KEY UPDATE
            selected_model = VALUES(selected_model),
            updated_at = NOW()
        `, [userId, selectedModel]);
      } else {
        // 用户未登录，保存为临时会话设置
        // 使用Response对象设置cookie
        const response = NextResponse.json({
          success: true,
          message: '模型选择已保存'
        });
        
        response.cookies.set({
          name: 'temp_model',
          value: selectedModel,
          maxAge: 60 * 60 * 24 * 30, // 30天有效期
          path: '/',
          sameSite: 'strict',
          secure: process.env.NODE_ENV === 'production'
        });
        
        return response;
      }
      
      return NextResponse.json({
        success: true,
        message: '模型选择已保存'
      });
      
    } finally {
      // 关闭数据库连接
      await connection.end();
    }
    
  } catch (error: any) {
    console.error('保存模型选择失败:', error);
    return NextResponse.json({ 
      success: false, 
      message: '保存模型选择失败: ' + error.message 
    }, { status: 500 });
  }
} 