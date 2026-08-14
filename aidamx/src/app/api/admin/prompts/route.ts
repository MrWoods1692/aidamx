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

// GET: 获取所有提示词设定
export async function GET(request: Request) {
  try {
    const admin = await verifyAdmin(request);
    if (!admin) {
      return NextResponse.json({ message: '未授权访问' }, { status: 401 });
    }

    const connection = await connectToDatabase();
    try {
      // 检查表是否存在
      try {
        await connection.execute(`SELECT 1 FROM prompt_settings LIMIT 1`);
      } catch (err) {
        // 表不存在，创建表
        await connection.execute(`
          CREATE TABLE IF NOT EXISTS \`prompt_settings\` (
            \`id\` INT AUTO_INCREMENT PRIMARY KEY,
            \`name\` VARCHAR(255) NOT NULL,
            \`description\` VARCHAR(500) DEFAULT NULL,
            \`content\` TEXT NOT NULL,
            \`is_active\` BOOLEAN DEFAULT TRUE,
            \`sort_order\` INT DEFAULT 0,
            \`created_at\` DATETIME DEFAULT CURRENT_TIMESTAMP,
            \`updated_at\` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX \`idx_sort_order\` (\`sort_order\`)
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
      }

      const [promptsResult] = await connection.execute(`
        SELECT 
          ps.*,
          COUNT(pm.id) as model_count
        FROM prompt_settings ps
        LEFT JOIN provider_models pm ON ps.id = pm.prompt_id
        GROUP BY ps.id
        ORDER BY ps.sort_order ASC, ps.id ASC
      `);

      return NextResponse.json({
        success: true,
        data: promptsResult as any[]
      });
    } finally {
      await connection.end();
    }
  } catch (error: any) {
    console.error('获取提示词列表失败:', error);
    return NextResponse.json({
      success: false,
      message: '获取提示词列表失败: ' + error.message
    }, { status: 500 });
  }
}

// POST: 创建新提示词
export async function POST(request: Request) {
  try {
    const admin = await verifyAdmin(request);
    if (!admin) {
      return NextResponse.json({ message: '未授权访问' }, { status: 401 });
    }

    const { name, description, content, sortOrder } = await request.json();

    if (!name || !content) {
      return NextResponse.json({
        success: false,
        message: '请提供提示词名称和内容'
      }, { status: 400 });
    }

    const connection = await connectToDatabase();
    try {
      // 检查表是否存在
      try {
        await connection.execute(`SELECT 1 FROM prompt_settings LIMIT 1`);
      } catch (err) {
        await connection.execute(`
          CREATE TABLE IF NOT EXISTS \`prompt_settings\` (
            \`id\` INT AUTO_INCREMENT PRIMARY KEY,
            \`name\` VARCHAR(255) NOT NULL,
            \`description\` VARCHAR(500) DEFAULT NULL,
            \`content\` TEXT NOT NULL,
            \`is_active\` BOOLEAN DEFAULT TRUE,
            \`sort_order\` INT DEFAULT 0,
            \`created_at\` DATETIME DEFAULT CURRENT_TIMESTAMP,
            \`updated_at\` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX \`idx_sort_order\` (\`sort_order\`)
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
      }

      const [result] = await connection.execute(`
        INSERT INTO prompt_settings (name, description, content, sort_order)
        VALUES (?, ?, ?, ?)
      `, [name, description || null, content, sortOrder || 0]);

      return NextResponse.json({
        success: true,
        message: '提示词创建成功',
        data: { id: (result as any).insertId }
      });
    } finally {
      await connection.end();
    }
  } catch (error: any) {
    console.error('创建提示词失败:', error);
    return NextResponse.json({
      success: false,
      message: '创建提示词失败: ' + error.message
    }, { status: 500 });
  }
}
