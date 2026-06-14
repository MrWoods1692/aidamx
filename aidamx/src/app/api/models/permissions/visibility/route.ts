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

// GET: 获取当前模型可见性设置
export async function GET(request: Request) {
  try {
    // 验证管理员身份
    const admin = await verifyAdmin(request);
    
    if (!admin) {
      return NextResponse.json({ success: false, message: '未授权访问' }, { status: 401 });
    }
    
    // 连接数据库
    const connection = await connectToDatabase();
    
    try {
      // 检查models_visibility表是否存在
      const [tableCheckResult] = await connection.query(`
        SHOW TABLES LIKE 'models_visibility'
      `);
      
      const tableCheckArray = tableCheckResult as any[];
      
      // 如果表不存在，创建表
      if (tableCheckArray.length === 0) {
        await connection.query(`
          CREATE TABLE models_visibility (
            id INT AUTO_INCREMENT PRIMARY KEY,
            visibility_mode ENUM('admin_only', 'specific_users', 'all_users') NOT NULL DEFAULT 'all_users',
            specific_user_id INT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY (specific_user_id),
            FOREIGN KEY (specific_user_id) REFERENCES users(id) ON DELETE CASCADE
          )
        `);
        
        // 插入默认设置（所有用户可见）
        await connection.query(`
          INSERT INTO models_visibility (visibility_mode) VALUES ('all_users')
        `);
      }
      
      // 获取当前可见性设置
      const [visibilityResult] = await connection.query(`
        SELECT visibility_mode, specific_user_id
        FROM models_visibility
        ORDER BY id DESC
        LIMIT 1
      `);
      
      const visibilityArray = visibilityResult as any[];
      
      if (visibilityArray.length === 0) {
        // 没有设置，插入默认设置并返回
        await connection.query(`
          INSERT INTO models_visibility (visibility_mode) VALUES ('all_users')
        `);
        
        return NextResponse.json({
          success: true,
          data: {
            visibility_mode: 'all_users',
            specific_user_id: null
          }
        });
      }
      
      // 如果有specific_user_id，获取用户信息
      let specificUser = null;
      if (visibilityArray[0].visibility_mode === 'specific_users' && visibilityArray[0].specific_user_id) {
        const [userResult] = await connection.query(`
          SELECT id, name, email
          FROM users
          WHERE id = ?
        `, [visibilityArray[0].specific_user_id]);
        
        const userArray = userResult as any[];
        if (userArray.length > 0) {
          specificUser = {
            id: userArray[0].id,
            name: userArray[0].name,
            email: userArray[0].email
          };
        }
      }
      
      return NextResponse.json({
        success: true,
        data: {
          visibility_mode: visibilityArray[0].visibility_mode,
          specific_user_id: visibilityArray[0].specific_user_id,
          specific_user: specificUser
        }
      });
      
    } finally {
      // 关闭数据库连接
      await connection.end();
    }
  } catch (error: any) {
    console.error('获取模型可见性设置失败:', error);
    return NextResponse.json({ 
      success: false, 
      message: '获取模型可见性设置失败: ' + error.message 
    }, { status: 500 });
  }
}

// POST: 设置模型可见性
export async function POST(request: Request) {
  try {
    // 验证管理员身份
    const admin = await verifyAdmin(request);
    
    if (!admin) {
      return NextResponse.json({ success: false, message: '未授权访问' }, { status: 401 });
    }
    
    // 解析请求体
    const { visibility_mode, specific_user_id } = await request.json();
    
    // 验证请求数据
    if (!visibility_mode || !['admin_only', 'specific_users', 'all_users'].includes(visibility_mode)) {
      return NextResponse.json({ 
        success: false, 
        message: '请提供有效的可见性模式：admin_only, specific_users, 或 all_users' 
      }, { status: 400 });
    }
    
    // 如果是特定用户模式，检查用户ID是否提供
    if (visibility_mode === 'specific_users' && !specific_user_id) {
      return NextResponse.json({ 
        success: false, 
        message: '指定特定用户可见时，必须提供用户ID' 
      }, { status: 400 });
    }
    
    // 连接数据库
    const connection = await connectToDatabase();
    
    try {
      // 检查models_visibility表是否存在
      const [tableCheckResult] = await connection.query(`
        SHOW TABLES LIKE 'models_visibility'
      `);
      
      const tableCheckArray = tableCheckResult as any[];
      
      // 如果表不存在，创建表
      if (tableCheckArray.length === 0) {
        await connection.query(`
          CREATE TABLE models_visibility (
            id INT AUTO_INCREMENT PRIMARY KEY,
            visibility_mode ENUM('admin_only', 'specific_users', 'all_users') NOT NULL DEFAULT 'all_users',
            specific_user_id INT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY (specific_user_id),
            FOREIGN KEY (specific_user_id) REFERENCES users(id) ON DELETE CASCADE
          )
        `);
      }
      
      // 如果是特定用户模式，验证用户存在
      if (visibility_mode === 'specific_users') {
        const [userResult] = await connection.query(`
          SELECT id FROM users WHERE id = ?
        `, [specific_user_id]);
        
        const userArray = userResult as any[];
        if (userArray.length === 0) {
          return NextResponse.json({ 
            success: false, 
            message: '指定的用户不存在' 
          }, { status: 400 });
        }
      }
      
      // 清除现有设置并插入新设置
      await connection.query(`DELETE FROM models_visibility`);
      
      if (visibility_mode === 'specific_users') {
        await connection.query(`
          INSERT INTO models_visibility (visibility_mode, specific_user_id)
          VALUES (?, ?)
        `, [visibility_mode, specific_user_id]);
      } else {
        await connection.query(`
          INSERT INTO models_visibility (visibility_mode)
          VALUES (?)
        `, [visibility_mode]);
      }
      
      return NextResponse.json({
        success: true,
        message: '模型可见性设置已保存'
      });
      
    } finally {
      // 关闭数据库连接
      await connection.end();
    }
    
  } catch (error: any) {
    console.error('保存模型可见性设置失败:', error);
    return NextResponse.json({ 
      success: false, 
      message: '保存模型可见性设置失败: ' + error.message 
    }, { status: 500 });
  }
} 