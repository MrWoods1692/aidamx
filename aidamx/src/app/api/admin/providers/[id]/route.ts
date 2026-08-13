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

// GET: 获取单个服务商详情（含模型列表）
export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const admin = await verifyAdmin(request);
    if (!admin) {
      return NextResponse.json({ message: '未授权访问' }, { status: 401 });
    }

    const providerId = parseInt(params.id);
    if (isNaN(providerId)) {
      return NextResponse.json({ success: false, message: '无效的服务商ID' }, { status: 400 });
    }

    const connection = await connectToDatabase();
    try {
      const [providerResult] = await connection.execute(`
        SELECT * FROM providers WHERE id = ?
      `, [providerId]);

      const providerArray = providerResult as any[];
      if (providerArray.length === 0) {
        return NextResponse.json({ success: false, message: '服务商不存在' }, { status: 404 });
      }

      const [modelsResult] = await connection.execute(`
        SELECT pm.*, m.name as original_name
        FROM provider_models pm
        LEFT JOIN models m ON pm.model_id = m.id
        WHERE pm.provider_id = ?
        ORDER BY pm.sort_order ASC, pm.id ASC
      `, [providerId]);

      return NextResponse.json({
        success: true,
        data: {
          provider: providerArray[0],
          models: modelsResult as any[]
        }
      });
    } finally {
      await connection.end();
    }
  } catch (error: any) {
    console.error('获取服务商详情失败:', error);
    return NextResponse.json({
      success: false,
      message: '获取服务商详情失败: ' + error.message
    }, { status: 500 });
  }
}

// PUT: 更新服务商
export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    const admin = await verifyAdmin(request);
    if (!admin) {
      return NextResponse.json({ message: '未授权访问' }, { status: 401 });
    }

    const providerId = parseInt(params.id);
    if (isNaN(providerId)) {
      return NextResponse.json({ success: false, message: '无效的服务商ID' }, { status: 400 });
    }

    const { name, endpoint, apiKey, isActive, sortOrder } = await request.json();

    const connection = await connectToDatabase();
    try {
      await connection.execute(`
        UPDATE providers 
        SET name = ?, endpoint = ?, api_key = ?, is_active = ?, sort_order = ?
        WHERE id = ?
      `, [name, endpoint, apiKey, isActive, sortOrder, providerId]);

      return NextResponse.json({
        success: true,
        message: '服务商更新成功'
      });
    } finally {
      await connection.end();
    }
  } catch (error: any) {
    console.error('更新服务商失败:', error);
    return NextResponse.json({
      success: false,
      message: '更新服务商失败: ' + error.message
    }, { status: 500 });
  }
}

// DELETE: 删除服务商
export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const admin = await verifyAdmin(request);
    if (!admin) {
      return NextResponse.json({ message: '未授权访问' }, { status: 401 });
    }

    const providerId = parseInt(params.id);
    if (isNaN(providerId)) {
      return NextResponse.json({ success: false, message: '无效的服务商ID' }, { status: 400 });
    }

    const connection = await connectToDatabase();
    try {
      await connection.execute(`DELETE FROM providers WHERE id = ?`, [providerId]);

      return NextResponse.json({
        success: true,
        message: '服务商删除成功'
      });
    } finally {
      await connection.end();
    }
  } catch (error: any) {
    console.error('删除服务商失败:', error);
    return NextResponse.json({
      success: false,
      message: '删除服务商失败: ' + error.message
    }, { status: 500 });
  }
}