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

// GET: 获取网站设置
export async function GET() {
  try {
    // 连接数据库
    const connection = await connectToDatabase();
    
    try {
      // 获取网站设置
      const [settingsResult] = await connection.execute(`
        SELECT 
          site_title, 
          site_logo
        FROM 
          site_settings
        ORDER BY 
          id DESC
        LIMIT 1
      `);
      
      const settingsArray = settingsResult as any[];
      
      if (settingsArray.length === 0) {
        return NextResponse.json({
          success: true,
          data: {
            site_title: 'AI对话',
            site_logo: '/favicon.ico'
          }
        });
      }
      
      const settings = settingsArray[0];
      
      return NextResponse.json({
        success: true,
        data: {
          site_title: settings.site_title,
          site_logo: settings.site_logo
        }
      });
      
    } finally {
      // 关闭数据库连接
      await connection.end();
    }
    
  } catch (error: any) {
    console.error('获取网站设置失败:', error);
    return NextResponse.json({ 
      success: false, 
      message: '获取网站设置失败: ' + error.message 
    }, { status: 500 });
  }
}

// POST: 更新网站设置（管理员专用）
export async function POST(request: Request) {
  try {
    // 验证管理员身份
    const admin = await verifyAdmin(request);
    
    if (!admin) {
      return NextResponse.json({ message: '未授权访问' }, { status: 401 });
    }
    
    // 解析请求体
    const { site_title, site_logo } = await request.json();
    
    // 验证请求数据
    if (!site_title) {
      return NextResponse.json({ 
        success: false, 
        message: '请提供网站标题' 
      }, { status: 400 });
    }
    
    // 连接数据库
    const connection = await connectToDatabase();
    
    try {
      // 更新网站设置
      await connection.execute(`
        INSERT INTO site_settings 
          (site_title, site_logo) 
        VALUES 
          (?, ?)
        ON DUPLICATE KEY UPDATE
          site_title = VALUES(site_title),
          site_logo = VALUES(site_logo),
          updated_at = NOW()
      `, [site_title, site_logo || '/favicon.ico']);
      
      return NextResponse.json({
        success: true,
        message: '网站设置已更新'
      });
      
    } finally {
      // 关闭数据库连接
      await connection.end();
    }
    
  } catch (error: any) {
    console.error('更新网站设置失败:', error);
    return NextResponse.json({ 
      success: false, 
      message: '更新网站设置失败: ' + error.message 
    }, { status: 500 });
  }
} 