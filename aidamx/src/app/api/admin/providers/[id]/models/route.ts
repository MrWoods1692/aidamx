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

// GET: 从服务商API获取模型列表并同步到数据库
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
      // 获取服务商信息
      const [providerResult] = await connection.execute(`
        SELECT * FROM providers WHERE id = ?
      `, [providerId]);

      const providerArray = providerResult as any[];
      if (providerArray.length === 0) {
        return NextResponse.json({ success: false, message: '服务商不存在' }, { status: 404 });
      }

      const provider = providerArray[0];
      const endpoint = provider.endpoint.endsWith('/') ? provider.endpoint : `${provider.endpoint}/`;

      // 从服务商API获取模型列表
      const response = await fetch(`${endpoint}v1/models`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${provider.api_key}`
        },
      });

      if (!response.ok) {
        return NextResponse.json({
          success: false,
          message: `API请求失败(${response.status})，请检查API密钥是否正确`
        }, { status: 500 });
      }

      const data = await response.json();

      if (!data.data || !Array.isArray(data.data)) {
        return NextResponse.json({
          success: false,
          message: 'API返回的模型数据格式不正确'
        }, { status: 500 });
      }

      // 同步模型到数据库
      const models = data.data;
      for (const model of models) {
        // 确保模型存在于models表
        await connection.execute(
          'INSERT IGNORE INTO models (id, name) VALUES (?, ?)',
          [model.id, model.name || model.id]
        );

        // 插入或更新provider_models表
        await connection.execute(`
          INSERT INTO provider_models (provider_id, model_id, display_name, is_enabled)
          VALUES (?, ?, ?, TRUE)
          ON DUPLICATE KEY UPDATE
            display_name = COALESCE(VALUES(display_name), display_name),
            updated_at = NOW()
        `, [providerId, model.id, model.name || model.id]);
      }

      // 获取同步后的模型列表
      const [modelsResult] = await connection.execute(`
        SELECT pm.*, m.name as original_name
        FROM provider_models pm
        LEFT JOIN models m ON pm.model_id = m.id
        WHERE pm.provider_id = ?
        ORDER BY pm.sort_order ASC, pm.id ASC
      `, [providerId]);

      return NextResponse.json({
        success: true,
        message: `成功同步 ${models.length} 个模型`,
        data: modelsResult as any[]
      });
    } finally {
      await connection.end();
    }
  } catch (error: any) {
    console.error('获取服务商模型失败:', error);
    return NextResponse.json({
      success: false,
      message: '获取服务商模型失败: ' + error.message
    }, { status: 500 });
  }
}