import { NextResponse } from 'next/server';
import mysql from 'mysql2/promise';
import jwt from 'jsonwebtoken';

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

async function verifyAdmin(request: Request) {
  const token = request.headers.get('cookie')?.split(';')
    .find(c => c.trim().startsWith('admin_token='))
    ?.split('=')[1];
  
  if (!token) return null;
  
  const ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET;
  if (!ADMIN_JWT_SECRET) return null;
  
  try {
    const decoded = jwt.verify(token, ADMIN_JWT_SECRET) as { adminId: number, username: string };
    return decoded;
  } catch (error) {
    return null;
  }
}

// PUT: 更新模型显示名称
export async function PUT(request: Request) {
  try {
    const admin = await verifyAdmin(request);
    if (!admin) {
      return NextResponse.json({ message: '未授权访问' }, { status: 401 });
    }

    const { providerId, modelId, displayName, isEnabled, sortOrder } = await request.json();

    if (!providerId || !modelId) {
      return NextResponse.json({
        success: false,
        message: '请提供服务商ID和模型ID'
      }, { status: 400 });
    }

    const connection = await connectToDatabase();
    try {
      // 检查记录是否存在
      const [existingResult] = await connection.execute(`
        SELECT id FROM provider_models WHERE provider_id = ? AND model_id = ?
      `, [providerId, modelId]);

      if ((existingResult as any[]).length === 0) {
        return NextResponse.json({
          success: false,
          message: '模型不存在'
        }, { status: 404 });
      }

      // 更新显示名称和其他字段
      const updateFields: string[] = [];
      const updateValues: any[] = [];

      if (displayName !== undefined) {
        updateFields.push('display_name = ?');
        updateValues.push(displayName);
      }
      if (isEnabled !== undefined) {
        updateFields.push('is_enabled = ?');
        updateValues.push(isEnabled);
      }
      if (sortOrder !== undefined) {
        updateFields.push('sort_order = ?');
        updateValues.push(sortOrder);
      }

      if (updateFields.length > 0) {
        updateFields.push('updated_at = NOW()');
        updateValues.push(providerId, modelId);

        await connection.execute(`
          UPDATE provider_models 
          SET ${updateFields.join(', ')}
          WHERE provider_id = ? AND model_id = ?
        `, updateValues);
      }

      return NextResponse.json({
        success: true,
        message: '模型显示名称更新成功'
      });
    } finally {
      await connection.end();
    }
  } catch (error: any) {
    console.error('更新模型显示名称失败:', error);
    return NextResponse.json({
      success: false,
      message: '更新模型显示名称失败: ' + error.message
    }, { status: 500 });
  }
}