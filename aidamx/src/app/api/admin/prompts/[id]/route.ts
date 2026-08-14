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

// PUT: 更新提示词
export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    const admin = await verifyAdmin(request);
    if (!admin) {
      return NextResponse.json({ message: '未授权访问' }, { status: 401 });
    }

    const promptId = parseInt(params.id);
    if (isNaN(promptId)) {
      return NextResponse.json({ success: false, message: '无效的提示词ID' }, { status: 400 });
    }

    const { name, description, content, isActive, sortOrder } = await request.json();

    const connection = await connectToDatabase();
    try {
      const updateFields: string[] = [];
      const updateValues: any[] = [];

      if (name !== undefined) {
        updateFields.push('name = ?');
        updateValues.push(name);
      }
      if (description !== undefined) {
        updateFields.push('description = ?');
        updateValues.push(description);
      }
      if (content !== undefined) {
        updateFields.push('content = ?');
        updateValues.push(content);
      }
      if (isActive !== undefined) {
        updateFields.push('is_active = ?');
        updateValues.push(isActive);
      }
      if (sortOrder !== undefined) {
        updateFields.push('sort_order = ?');
        updateValues.push(sortOrder);
      }

      if (updateFields.length === 0) {
        return NextResponse.json({
          success: false,
          message: '没有需要更新的字段'
        }, { status: 400 });
      }

      updateFields.push('updated_at = NOW()');
      updateValues.push(promptId);

      await connection.execute(`
        UPDATE prompt_settings SET ${updateFields.join(', ')} WHERE id = ?
      `, updateValues);

      return NextResponse.json({
        success: true,
        message: '提示词更新成功'
      });
    } finally {
      await connection.end();
    }
  } catch (error: any) {
    console.error('更新提示词失败:', error);
    return NextResponse.json({
      success: false,
      message: '更新提示词失败: ' + error.message
    }, { status: 500 });
  }
}

// DELETE: 删除提示词
export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const admin = await verifyAdmin(request);
    if (!admin) {
      return NextResponse.json({ message: '未授权访问' }, { status: 401 });
    }

    const promptId = parseInt(params.id);
    if (isNaN(promptId)) {
      return NextResponse.json({ success: false, message: '无效的提示词ID' }, { status: 400 });
    }

    const connection = await connectToDatabase();
    try {
      // 检查是否有模型正在使用此提示词
      try {
        const [usageResult] = await connection.execute(`
          SELECT COUNT(*) as count FROM provider_models WHERE prompt_id = ?
        `, [promptId]);
        
        if ((usageResult as any[])[0].count > 0) {
          return NextResponse.json({
            success: false,
            message: '该提示词正在被模型使用，请先解除关联后再删除'
          }, { status: 400 });
        }
      } catch (err) {
        // provider_models 表可能还没有 prompt_id 字段，忽略
      }

      await connection.execute(`DELETE FROM prompt_settings WHERE id = ?`, [promptId]);

      return NextResponse.json({
        success: true,
        message: '提示词删除成功'
      });
    } finally {
      await connection.end();
    }
  } catch (error: any) {
    console.error('删除提示词失败:', error);
    return NextResponse.json({
      success: false,
      message: '删除提示词失败: ' + error.message
    }, { status: 500 });
  }
}
