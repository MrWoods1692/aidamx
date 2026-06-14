import { NextResponse } from 'next/server';
import mysql from 'mysql2/promise';
import jwt from 'jsonwebtoken';

// 使用环境变量中的管理员JWT密钥
const ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET;

// 确保必要的环境变量已设置
if (!ADMIN_JWT_SECRET) {
  console.error('警告: ADMIN_JWT_SECRET环境变量未设置!');
}

// 数据库连接
async function connectToDatabase() {
  try {
    return await mysql.createConnection({
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT),
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME
    });
  } catch (error) {
    console.error('数据库连接失败:', error);
    throw new Error('数据库连接失败');
  }
}

// 管理员获取所有用户的聊天记录列表
export async function GET(request: Request) {
  try {
    // 获取cookie中的管理员令牌
    const token = request.headers.get('cookie')?.split(';')
      .find(c => c.trim().startsWith('admin_token='))
      ?.split('=')[1];
    
    if (!token) {
      return NextResponse.json({
        success: false,
        message: '未登录'
      }, { status: 401 });
    }
    
    // 在JWT验证之前添加检查
    if (!ADMIN_JWT_SECRET) {
      return NextResponse.json({
        success: false,
        message: '服务器配置错误: JWT密钥未设置'
      }, { status: 500 });
    }
    
    // 验证令牌
    try {
      jwt.verify(token, ADMIN_JWT_SECRET);
    } catch (error) {
      return NextResponse.json({
        success: false,
        message: '会话已过期或无效'
      }, { status: 401 });
    }
    
    // 获取查询参数
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '10');
    const userId = url.searchParams.get('userId');
    const search = url.searchParams.get('search');
    
    // 计算分页偏移量
    const offset = (page - 1) * limit;
    
    // 连接数据库
    const connection = await connectToDatabase();
    
    // 构建查询条件
    let whereClause = '';
    const queryParams: any[] = [];
    
    if (userId) {
      whereClause += ' AND h.user_id = ?';
      queryParams.push(userId);
    }
    
    if (search) {
      whereClause += ' AND (h.title LIKE ? OR u.email LIKE ? OR u.name LIKE ?)';
      const searchTerm = `%${search}%`;
      queryParams.push(searchTerm, searchTerm, searchTerm);
    }
    
    // 获取聊天记录总数
    const [countResult] = await connection.execute(`
      SELECT COUNT(*) as total 
      FROM chat_history h
      JOIN users u ON h.user_id = u.id
      WHERE 1=1 ${whereClause}
    `, queryParams);
    
    const countArray = countResult as any[];
    const total = countArray[0].total;
    
    // 获取聊天记录列表
    const [historyResults] = await connection.execute(`
      SELECT 
        h.id, 
        h.title, 
        h.created_at, 
        h.updated_at,
        h.user_id,
        u.email as user_email,
        u.name as user_name,
        u.avatar as user_avatar,
        (SELECT COUNT(*) FROM chat_messages WHERE chat_id = h.id) as message_count,
        (SELECT content FROM chat_messages WHERE chat_id = h.id ORDER BY created_at ASC LIMIT 1) as first_message
      FROM chat_history h
      JOIN users u ON h.user_id = u.id
      WHERE 1=1 ${whereClause}
      ORDER BY h.updated_at DESC
      LIMIT ${offset}, ${limit}
    `, queryParams);
    
    const historyList = historyResults as any[];
    
    // 计算总页数
    const totalPages = Math.ceil(total / limit);
    
    // 关闭数据库连接
    await connection.end();
    
    return NextResponse.json({
      success: true,
      data: historyList,
      pagination: {
        page,
        limit,
        total,
        totalPages
      }
    });
  } catch (error: any) {
    console.error('获取聊天记录列表失败:', error);
    return NextResponse.json({
      success: false,
      message: `获取聊天记录列表失败: ${error.message || '未知错误'}`
    }, { status: 500 });
  }
} 