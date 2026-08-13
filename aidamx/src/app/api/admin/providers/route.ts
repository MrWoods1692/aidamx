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

// GET: 获取所有服务商列表
export async function GET(request: Request) {
  try {
    const admin = await verifyAdmin(request);
    if (!admin) {
      return NextResponse.json({ message: '未授权访问' }, { status: 401 });
    }

    const connection = await connectToDatabase();
    try {
      const [providersResult] = await connection.execute(`
        SELECT 
          p.id,
          p.name,
          p.endpoint,
          p.api_key,
          p.is_active,
          p.sort_order,
          p.created_at,
          p.updated_at,
          COUNT(pm.id) as model_count
        FROM providers p
        LEFT JOIN provider_models pm ON p.id = pm.provider_id
        GROUP BY p.id
        ORDER BY p.sort_order ASC, p.id ASC
      `);

      const providers = providersResult as any[];

      return NextResponse.json({
        success: true,
        data: providers
      });
    } finally {
      await connection.end();
    }
  } catch (error: any) {
    console.error('获取服务商列表失败:', error);
    return NextResponse.json({
      success: false,
      message: '获取服务商列表失败: ' + error.message
    }, { status: 500 });
  }
}

// POST: 创建新服务商
export async function POST(request: Request) {
  try {
    const admin = await verifyAdmin(request);
    if (!admin) {
      return NextResponse.json({ message: '未授权访问' }, { status: 401 });
    }

    const { name, endpoint, apiKey, sortOrder } = await request.json();

    if (!name || !endpoint || !apiKey) {
      return NextResponse.json({
        success: false,
        message: '请提供服务商名称、API端点和API密钥'
      }, { status: 400 });
    }

    const connection = await connectToDatabase();
    try {
      const [result] = await connection.execute(`
        INSERT INTO providers (name, endpoint, api_key, sort_order)
        VALUES (?, ?, ?, ?)
      `, [name, endpoint, apiKey, sortOrder || 0]);

      return NextResponse.json({
        success: true,
        message: '服务商创建成功',
        data: { id: (result as any).insertId }
      });
    } finally {
      await connection.end();
    }
  } catch (error: any) {
    console.error('创建服务商失败:', error);
    return NextResponse.json({
      success: false,
      message: '创建服务商失败: ' + error.message
    }, { status: 500 });
  }
}