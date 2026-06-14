import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';
import mysql from 'mysql2/promise';

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

export async function GET(request: Request) {
  try {
    // 获取cookie中的管理员令牌
    const token = request.headers.get('cookie')?.split(';')
      .find(c => c.trim().startsWith('admin_token='))
      ?.split('=')[1];
    
    if (!token) {
      return NextResponse.json({ message: '未登录' }, { status: 401 });
    }
    
    // 在JWT验证之前添加检查
    if (!ADMIN_JWT_SECRET) {
      return NextResponse.json({ message: '服务器配置错误: JWT密钥未设置' }, { status: 500 });
    }
    
    // 验证令牌
    try {
      jwt.verify(token, ADMIN_JWT_SECRET);
    } catch (error) {
      return NextResponse.json({ message: '会话已过期或无效' }, { status: 401 });
    }
    
    // 连接数据库
    const connection = await connectToDatabase();
    
    try {
      // 获取总用户数
      const [totalUsersResult] = await connection.execute(
        'SELECT COUNT(*) as total FROM users'
      );
      const totalUsersArray = totalUsersResult as any[];
      const totalUsers = totalUsersArray[0].total;
      
      // 获取一周前的用户数
      const [lastWeekUsersResult] = await connection.execute(
        'SELECT COUNT(*) as total FROM users WHERE created_at < DATE_SUB(NOW(), INTERVAL 7 DAY)'
      );
      const lastWeekUsersArray = lastWeekUsersResult as any[];
      const lastWeekUsers = lastWeekUsersArray[0].total;
      
      // 计算用户增长百分比
      const userGrowth = lastWeekUsers > 0 
        ? Math.round(((totalUsers - lastWeekUsers) / lastWeekUsers) * 100) 
        : (totalUsers > 0 ? 100 : 0);
      
      // 获取总对话数
      const [totalChatsResult] = await connection.execute(
        'SELECT COUNT(*) as total FROM chat_history'
      );
      const totalChatsArray = totalChatsResult as any[];
      const totalChats = totalChatsArray[0].total;
      
      // 获取一周前的对话数
      const [lastWeekChatsResult] = await connection.execute(
        'SELECT COUNT(*) as total FROM chat_history WHERE created_at < DATE_SUB(NOW(), INTERVAL 7 DAY)'
      );
      const lastWeekChatsArray = lastWeekChatsResult as any[];
      const lastWeekChats = lastWeekChatsArray[0].total;
      
      // 计算对话增长百分比
      const chatGrowth = lastWeekChats > 0 
        ? Math.round(((totalChats - lastWeekChats) / lastWeekChats) * 100)
        : (totalChats > 0 ? 100 : 0);
      
      // 获取活跃用户数 (过去7天内登录的用户)
      const [activeUsersResult] = await connection.execute(
        'SELECT COUNT(*) as total FROM users WHERE last_login >= DATE_SUB(NOW(), INTERVAL 7 DAY)'
      );
      const activeUsersArray = activeUsersResult as any[];
      const activeUsers = activeUsersArray[0].total;
      
      // 获取上周期的活跃用户数 (7-14天前登录的用户)
      const [lastPeriodActiveUsersResult] = await connection.execute(
        'SELECT COUNT(*) as total FROM users WHERE last_login >= DATE_SUB(NOW(), INTERVAL 14 DAY) AND last_login < DATE_SUB(NOW(), INTERVAL 7 DAY)'
      );
      const lastPeriodActiveUsersArray = lastPeriodActiveUsersResult as any[];
      const lastPeriodActiveUsers = lastPeriodActiveUsersArray[0].total;
      
      // 计算活跃用户增长百分比
      const activeGrowth = lastPeriodActiveUsers > 0 
        ? Math.round(((activeUsers - lastPeriodActiveUsers) / lastPeriodActiveUsers) * 100)
        : (activeUsers > 0 ? 100 : 0);
      
      return NextResponse.json({
        success: true,
        stats: {
          totalUsers,
          totalChats,
          activeUsers,
          userGrowth,
          chatGrowth,
          activeGrowth
        }
      });
      
    } finally {
      // 关闭数据库连接
      await connection.end();
    }
    
  } catch (error: any) {
    console.error('获取仪表盘统计数据失败:', error);
    return NextResponse.json({ 
      success: false, 
      message: '获取仪表盘统计数据失败: ' + error.message 
    }, { status: 500 });
  }
} 