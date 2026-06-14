import { NextResponse } from 'next/server';
import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';

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

// 检查表是否存在
async function checkTableExists(connection: any, tableName: string): Promise<boolean> {
  const [rows] = await connection.execute(
    `SELECT COUNT(*) as count FROM information_schema.TABLES 
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?`, 
    [process.env.DB_NAME, tableName]
  );
  return (rows as any[])[0].count > 0;
}

// 检查字段是否存在
async function checkColumnExists(connection: any, tableName: string, columnName: string): Promise<boolean> {
  const [rows] = await connection.execute(
    `SELECT COUNT(*) as count FROM information_schema.COLUMNS 
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?`, 
    [process.env.DB_NAME, tableName, columnName]
  );
  return (rows as any[])[0].count > 0;
}

export async function GET(request: Request) {
  try {
    // 获取URL中的验证码参数
    const url = new URL(request.url);
    const code = url.searchParams.get('code');
    const forceReset = url.searchParams.get('force') === 'true';
    
    // 验证管理员代码
    if (!verifyAdminCode(code)) {
      return NextResponse.json({ success: false, message: '未授权访问' }, { status: 401 });
    }
    
    // 读取SQL脚本
    const sqlPath = path.join(process.cwd(), 'database', 'init.sql');
    const sqlScript = fs.readFileSync(sqlPath, 'utf8');
    
    // 连接数据库并执行脚本
    const connection = await connectToDatabase();
    
    try {
      // 禁用外键检查
      await connection.execute('SET FOREIGN_KEY_CHECKS=0');
      
      // 获取现有表列表
      let createdTables = 0;
      let modifiedTables = 0;
      
      // 分析并执行SQL语句
      const createTableStatements = sqlScript.split(';')
        .filter(statement => statement.trim().length > 0 && statement.includes('CREATE TABLE'));
      
      for (const statement of createTableStatements) {
        // 提取表名
        const tableNameMatch = statement.match(/CREATE TABLE IF NOT EXISTS `(\w+)`/);
        if (!tableNameMatch) continue;
        
        const tableName = tableNameMatch[1];
        const tableExists = await checkTableExists(connection, tableName);
        
        if (!tableExists) {
          // 表不存在，直接创建
          await connection.execute(statement);
          createdTables++;
        } else if (forceReset) {
          // 强制重建表
          await connection.execute(`DROP TABLE IF EXISTS ${tableName}`);
          await connection.execute(statement);
          createdTables++;
          modifiedTables++;
        } else {
          // 表已存在，检查是否需要添加字段
          const columnMatches = statement.matchAll(/`(\w+)` ([^,]+),?/g);
          for (const match of Array.from(columnMatches)) {
            const columnName = match[1];
            const columnDefinition = match[2];
            
            // 跳过id字段
            if (columnName === 'id') continue;
            
            const columnExistsFlag = await checkColumnExists(connection, tableName, columnName);
            if (!columnExistsFlag) {
              // 字段不存在，添加字段
              console.log(`Adding column ${columnName} to table ${tableName}`);
              try {
                await connection.execute(
                  `ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDefinition}`
                );
                modifiedTables++;
              } catch (err) {
                console.error(`Error adding column ${columnName} to ${tableName}:`, err);
              }
            }
          }
        }
      }
      
      // 重新启用外键检查
      await connection.execute('SET FOREIGN_KEY_CHECKS=1');
      
      // 执行其他非创建表的语句（如插入默认数据）
      const otherStatements = sqlScript.split(';')
        .filter(statement => statement.trim().length > 0 && !statement.includes('CREATE TABLE'));
      
      for (const statement of otherStatements) {
        try {
          await connection.execute(statement);
        } catch (err) {
          console.error('执行其他SQL语句失败:', err);
        }
      }
      
      return NextResponse.json({ 
        success: true, 
        message: '数据库初始化成功', 
        details: {
          createdTables,
          modifiedTables,
          totalStatements: createTableStatements.length + otherStatements.length
        }
      });
      
    } finally {
      await connection.end();
    }
    
  } catch (error: any) {
    console.error('数据库初始化失败:', error);
    return NextResponse.json({ 
      success: false, 
      message: '数据库初始化失败: ' + error.message 
    }, { status: 500 });
  }
} 