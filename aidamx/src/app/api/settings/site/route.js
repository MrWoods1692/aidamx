/**
 * @file 网站设置API (JS版本)
 * @description 处理网站标题和Logo的获取和更新
 */

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

// 验证管理员身份
async function verifyAdmin(request) {
  const token = request.cookies.get('admin_token')?.value;
  
  if (!token) {
    return null;
  }
  
  const ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET;
  
  if (!ADMIN_JWT_SECRET) {
    return null;
  }
  
  try {
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, ADMIN_JWT_SECRET);
    return decoded;
  } catch (error) {
    return null;
  }
}

// GET: 获取网站设置
export async function GET(request) {
  try {
    // 验证管理员身份
    const admin = await verifyAdmin(request);
    
    if (!admin) {
      return NextResponse.json({ success: false, message: '未授权访问' }, { status: 401 });
    }
    
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
        LIMIT 1
      `);
      
      if (settingsResult.length === 0) {
        return NextResponse.json({
          success: true,
          title: 'Code Assistant',
          logo: '/favicon.ico'
        });
      }
      
      const settings = settingsResult[0];
      
      return NextResponse.json({
        success: true,
        title: settings.site_title,
        logo: settings.site_logo
      });
      
    } finally {
      // 关闭数据库连接
      await connection.end();
    }
    
  } catch (error) {
    console.error('获取网站设置失败:', error);
    return NextResponse.json({ 
      success: false, 
      message: '获取网站设置失败: ' + error.message 
    }, { status: 500 });
  }
}

// POST: 更新网站设置
export async function POST(request) {
  try {
    // 验证管理员身份
    const admin = await verifyAdmin(request);
    
    if (!admin) {
      return NextResponse.json({ success: false, message: '未授权访问' }, { status: 401 });
    }
    
    // 解析请求体
    const { title, logo } = await request.json();
    
    // 验证请求数据
    if (!title) {
      return NextResponse.json({ 
        success: false, 
        message: '网站标题不能为空' 
      }, { status: 400 });
    }
    
    // 连接数据库
    const connection = await connectToDatabase();
    
    try {
      // 检查表中是否有记录
      const [countResult] = await connection.execute('SELECT COUNT(*) as count FROM site_settings');
      const count = countResult[0].count;
      
      if (count === 0) {
        // 如果没有记录，插入新记录
        await connection.execute(`
          INSERT INTO site_settings (site_title, site_logo)
          VALUES (?, ?)
        `, [title, logo || '/favicon.ico']);
      } else {
        // 如果已有记录，更新第一条记录
        await connection.execute(`
          UPDATE site_settings 
          SET 
            site_title = ?,
            site_logo = ?
          WHERE id = 1
        `, [title, logo || '/favicon.ico']);
      }
      
      return NextResponse.json({
        success: true,
        message: '网站设置已更新'
      });
      
    } finally {
      // 关闭数据库连接
      await connection.end();
    }
    
  } catch (error) {
    console.error('更新网站设置失败:', error);
    return NextResponse.json({ 
      success: false, 
      message: '更新网站设置失败: ' + (error.message || '未知错误') 
    }, { status: 500 });
  }
} 