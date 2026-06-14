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

// GET: 获取模型标签
export async function GET(request: Request) {
  try {
    // 获取URL中的模型ID参数
    const url = new URL(request.url);
    const modelId = url.searchParams.get('modelId');
    
    if (!modelId) {
      return NextResponse.json({ 
        success: false, 
        message: '请提供模型ID' 
      }, { status: 400 });
    }
    
    // 连接数据库
    const connection = await connectToDatabase();
    
    try {
      // 查询模型标签
      const [tagsResult] = await connection.execute(
        'SELECT id, text, color FROM model_tags WHERE model_id = ?',
        [modelId]
      );
      
      const tags = tagsResult as any[];
      
      return NextResponse.json({
        success: true,
        data: tags
      });
      
    } finally {
      // 关闭数据库连接
      await connection.end();
    }
    
  } catch (error: any) {
    console.error('获取模型标签失败:', error);
    return NextResponse.json({ 
      success: false, 
      message: '获取模型标签失败: ' + error.message 
    }, { status: 500 });
  }
}

// POST: 添加模型标签
export async function POST(request: Request) {
  try {
    // 验证管理员身份
    const admin = await verifyAdmin(request);
    
    if (!admin) {
      return NextResponse.json({ message: '未授权访问' }, { status: 401 });
    }
    
    // 解析请求体
    const { modelId, text, color } = await request.json();
    
    // 验证请求数据
    if (!modelId || !text || !color) {
      return NextResponse.json({ 
        success: false, 
        message: '请提供模型ID、标签文本和颜色' 
      }, { status: 400 });
    }
    
    // 连接数据库
    const connection = await connectToDatabase();
    
    try {
      // 确保模型存在
      const [modelResult] = await connection.execute(
        'SELECT id FROM models WHERE id = ?',
        [modelId]
      );
      
      const modelArray = modelResult as any[];
      
      if (modelArray.length === 0) {
        // 模型不存在，先插入模型数据
        await connection.execute(
          'INSERT INTO models (id) VALUES (?)',
          [modelId]
        );
      }
      
      // 查询当前标签数量
      const [tagsCountResult] = await connection.execute(
        'SELECT COUNT(*) as count FROM model_tags WHERE model_id = ?',
        [modelId]
      );
      
      const tagsCountArray = tagsCountResult as any[];
      const tagsCount = tagsCountArray[0].count;
      
      // 限制每个模型最多两个标签
      if (tagsCount >= 2) {
        // 删除最旧的标签
        await connection.execute(
          'DELETE FROM model_tags WHERE model_id = ? ORDER BY created_at ASC LIMIT 1',
          [modelId]
        );
      }
      
      // 添加新标签
      await connection.execute(
        'INSERT INTO model_tags (model_id, text, color) VALUES (?, ?, ?)',
        [modelId, text, color]
      );
      
      return NextResponse.json({
        success: true,
        message: '模型标签已添加'
      });
      
    } finally {
      // 关闭数据库连接
      await connection.end();
    }
    
  } catch (error: any) {
    console.error('添加模型标签失败:', error);
    return NextResponse.json({ 
      success: false, 
      message: '添加模型标签失败: ' + error.message 
    }, { status: 500 });
  }
}

// DELETE: 删除模型标签
export async function DELETE(request: Request) {
  try {
    // 验证管理员身份
    const admin = await verifyAdmin(request);
    
    if (!admin) {
      return NextResponse.json({ message: '未授权访问' }, { status: 401 });
    }
    
    // 获取URL中的标签ID参数
    const url = new URL(request.url);
    const tagId = url.searchParams.get('tagId');
    
    if (!tagId) {
      return NextResponse.json({ 
        success: false, 
        message: '请提供标签ID' 
      }, { status: 400 });
    }
    
    // 连接数据库
    const connection = await connectToDatabase();
    
    try {
      // 删除标签
      await connection.execute(
        'DELETE FROM model_tags WHERE id = ?',
        [tagId]
      );
      
      return NextResponse.json({
        success: true,
        message: '模型标签已删除'
      });
      
    } finally {
      // 关闭数据库连接
      await connection.end();
    }
    
  } catch (error: any) {
    console.error('删除模型标签失败:', error);
    return NextResponse.json({ 
      success: false, 
      message: '删除模型标签失败: ' + error.message 
    }, { status: 500 });
  }
} 