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

// POST: 保存模型图标
export async function POST(request: Request) {
  try {
    // 验证管理员身份
    const admin = await verifyAdmin(request);
    
    if (!admin) {
      return NextResponse.json({ message: '未授权访问' }, { status: 401 });
    }
    
    // 解析请求体
    const { modelId, iconPath } = await request.json();
    
    // 验证请求数据
    if (!modelId || !iconPath) {
      return NextResponse.json({ 
        success: false, 
        message: '请提供模型ID和图标路径' 
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
      
      // 插入或更新模型图标
      await connection.execute(`
        INSERT INTO model_icons 
          (model_id, icon_path) 
        VALUES 
          (?, ?)
        ON DUPLICATE KEY UPDATE
          icon_path = VALUES(icon_path),
          updated_at = NOW()
      `, [modelId, iconPath]);
      
      return NextResponse.json({
        success: true,
        message: '模型图标已保存'
      });
      
    } finally {
      // 关闭数据库连接
      await connection.end();
    }
    
  } catch (error: any) {
    console.error('保存模型图标失败:', error);
    return NextResponse.json({ 
      success: false, 
      message: '保存模型图标失败: ' + error.message 
    }, { status: 500 });
  }
} 