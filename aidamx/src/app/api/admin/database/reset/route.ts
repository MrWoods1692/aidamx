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
      // 删除所有表
      // 顺序很重要：先删除依赖表，再删除被依赖表
      const tables = [
        // 可能存在的活动日志表
        'activity_logs',
        'user_activities',
        'admin_logs',
        'login_history',
        'registration_logs',
        
        // 模型相关表（按照依赖关系顺序）
        'model_tags',
        'model_icons',
        'model_settings',
        'user_model_settings',
        'models',
        
        // 聊天相关表
        'chat_messages',
        'chat_history',
        'chat_images',
        
        // 用户相关表
        'verification_codes',
        'users',
        'admins'
      ];
      
      // 获取现有表名
      const [existingTablesResult] = await connection.execute(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = ?
      `, [process.env.DB_NAME]);
      
      const existingTables = (existingTablesResult as any[]).map(row => row.table_name);
      console.log('现有表:', existingTables);
      
      // 禁用外键检查
      await connection.execute('SET FOREIGN_KEY_CHECKS=0');
      
      // 删除表
      for (const table of tables) {
        try {
          await connection.execute(`DROP TABLE IF EXISTS ${table}`);
          console.log(`表 ${table} 已删除`);
        } catch (err) {
          console.error(`删除表 ${table} 失败`, err);
        }
      }
      
      // 确保所有表都被删除
      for (const existingTable of existingTables) {
        if (!tables.includes(existingTable)) {
          try {
            await connection.execute(`DROP TABLE IF EXISTS ${existingTable}`);
            console.log(`额外表 ${existingTable} 已删除`);
          } catch (err) {
            console.error(`删除额外表 ${existingTable} 失败`, err);
          }
        }
      }
      
      // 重新启用外键检查
      await connection.execute('SET FOREIGN_KEY_CHECKS=1');
      
      // 创建响应对象
      const response = NextResponse.json({ 
        success: true, 
        message: '数据库已重置，请调用初始化API重新创建表结构', 
      });
      
      // 清除所有认证相关的cookie
      response.cookies.set({
        name: 'auth_token',
        value: '',
        expires: new Date(0),
        path: '/',
      });
      
      response.cookies.set({
        name: 'admin_token',
        value: '',
        expires: new Date(0),
        path: '/',
      });
      
      return response;
      
    } finally {
      await connection.end();
    }
    
  } catch (error: any) {
    console.error('数据库重置失败:', error);
    return NextResponse.json({ 
      success: false, 
      message: '数据库重置失败: ' + error.message 
    }, { status: 500 });
  }
} 