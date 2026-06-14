import { NextResponse } from 'next/server';
import mysql from 'mysql2/promise';
import crypto from 'crypto';
import nodemailer from 'nodemailer';

// 创建邮件传输器
const transporter = nodemailer.createTransport({
  service: 'qq',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_AUTH_CODE, // 授权码，不是QQ邮箱密码
  },
});

// 确保EMAIL配置已设置
if (!process.env.EMAIL_USER || !process.env.EMAIL_AUTH_CODE) {
  console.error('警告: EMAIL_USER或EMAIL_AUTH_CODE环境变量未设置!');
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

// 生成随机的重置令牌
function generateResetToken() {
  return crypto.randomBytes(32).toString('hex');
}

export async function POST(request: Request) {
  try {
    // 解析请求体
    const { email } = await request.json();
    
    // 验证请求参数
    if (!email) {
      return NextResponse.json({ message: '请提供邮箱地址' }, { status: 400 });
    }
    
    // 连接数据库
    const connection = await connectToDatabase();
    
    try {
      // 查询用户是否存在
      const [userResults] = await connection.execute(
        'SELECT id, email, name FROM users WHERE email = ?',
        [email]
      );
      
      const userResultsArray = userResults as any[];
      
      if (userResultsArray.length === 0) {
        // 为防止邮箱枚举攻击，即使用户不存在也返回成功响应
        return NextResponse.json({ message: '如果邮箱存在，我们已发送重置链接' });
      }
      
      const user = userResultsArray[0];
      
      // 生成重置令牌
      const resetToken = generateResetToken();
      const expirationTime = new Date();
      expirationTime.setHours(expirationTime.getHours() + 1); // 有效期1小时
      
      // 假设有一个reset_tokens表存储重置令牌
      // 如果没有这个表，需要先创建
      try {
        await connection.execute(`
          CREATE TABLE IF NOT EXISTS reset_tokens (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            token VARCHAR(64) NOT NULL,
            expires_at DATETIME NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            INDEX idx_token (token)
          )
        `);
      } catch (err) {
        console.error('创建重置令牌表失败:', err);
      }
      
      // 存储重置令牌
      await connection.execute(
        `INSERT INTO reset_tokens (user_id, token, expires_at) VALUES (?, ?, ?)`,
        [user.id, resetToken, expirationTime]
      );
      
      // 生成重置链接
      const resetLink = `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:6677'}/reset-password?token=${resetToken}`;
      console.log('密码重置链接:', resetLink);
      
      // 发送重置密码邮件
      await transporter.sendMail({
        from: `"Code Assistant" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: 'Code Assistant 密码重置',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #3b82f6;">Code Assistant 密码重置</h2>
            <p>您好${user.name ? ' ' + user.name : ''}！</p>
            <p>我们收到了您的密码重置请求。请点击下面的链接重置您的密码：</p>
            <div style="margin: 20px 0;">
              <a href="${resetLink}" style="background-color: #3b82f6; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">
                重置密码
              </a>
            </div>
            <p>或者复制以下链接到浏览器地址栏：</p>
            <p style="word-break: break-all; background-color: #f3f4f6; padding: 10px; font-size: 12px;">
              ${resetLink}
            </p>
            <p>此链接将在1小时后过期。如果您没有请求重置密码，请忽略此邮件。</p>
            <p>谢谢！</p>
            <p style="margin-top: 30px; font-size: 12px; color: #6b7280;">
              此邮件为系统自动发送，请勿回复。
            </p>
          </div>
        `,
      });
      
      return NextResponse.json({ 
        message: '如果邮箱存在，我们已发送重置链接',
        // 注意：在生产环境不应返回token，这里仅为了测试方便
        debug: process.env.NODE_ENV === 'development' ? { resetLink } : undefined
      });
      
    } finally {
      // 关闭数据库连接
      await connection.end();
    }
    
  } catch (error: any) {
    console.error('处理密码重置请求失败:', error);
    return NextResponse.json({ message: '处理请求失败: ' + error.message }, { status: 500 });
  }
} 