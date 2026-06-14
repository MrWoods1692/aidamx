import { NextResponse } from 'next/server';
import mysql from 'mysql2/promise';

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

// 验证管理员代码
function verifyAdminCode(code: string | null) {
  const ADMIN_CODE = process.env.ADMIN_CODE;
  
  if (!ADMIN_CODE) {
    throw new Error('服务器配置错误: ADMIN_CODE未设置');
  }
  
  return code === ADMIN_CODE;
}

export async function GET(request: Request) {
  try {
    // 获取URL中的验证码参数
    const url = new URL(request.url);
    const code = url.searchParams.get('code');
    
    // 验证管理员代码
    if (!verifyAdminCode(code)) {
      return NextResponse.json({ success: false, message: '未授权访问' }, { status: 401 });
    }
    
    // 连接数据库
    const connection = await connectToDatabase();
    
    try {
      // 获取所有表信息
      const [tables] = await connection.execute(
        `SELECT TABLE_NAME, TABLE_ROWS, CREATE_TIME, UPDATE_TIME 
         FROM information_schema.TABLES 
         WHERE TABLE_SCHEMA = ?`,
        [process.env.DB_NAME]
      );
      
      // 获取每个表的行数
      const tableInfo = await Promise.all(
        (tables as any[]).map(async (table) => {
          const [countResult] = await connection.execute(
            `SELECT COUNT(*) as count FROM ${table.TABLE_NAME}`
          );
          const count = (countResult as any[])[0].count;
          
          return {
            name: table.TABLE_NAME,
            rows: count,
            created: table.CREATE_TIME,
            updated: table.UPDATE_TIME
          };
        })
      );
      
      // 获取数据库大小
      const [sizeResult] = await connection.execute(
        `SELECT 
          SUM(data_length + index_length) / 1024 / 1024 AS size_mb
         FROM information_schema.TABLES
         WHERE TABLE_SCHEMA = ?`,
        [process.env.DB_NAME]
      );
      
      const dbSize = (sizeResult as any[])[0].size_mb || 0;
      
      return NextResponse.json({ 
        success: true, 
        database: {
          name: process.env.DB_NAME,
          size_mb: dbSize,
          tables: tableInfo,
          tables_count: tableInfo.length
        }
      });
      
    } finally {
      await connection.end();
    }
    
  } catch (error: any) {
    console.error('获取数据库状态失败:', error);
    return NextResponse.json({ 
      success: false, 
      message: '获取数据库状态失败: ' + error.message 
    }, { status: 500 });
  }
} 