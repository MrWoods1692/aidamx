import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import mysql from 'mysql2/promise';

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

// 连接数据库
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

// 获取QQ用户信息
async function getQQInfo(qqNumber: string) {
  try {
    // 主要API尝试
    const response = await fetch(`http://api.mmp.cc/api/qqname?qq=${qqNumber}`);
    if (response.ok) {
      const data = await response.json();
      
      if (data.code === 200) {
        return {
          name: data.data.name || '',
          avatar: data.data.imgur3 || '', // 使用高质量头像
        };
      }
    }
    
    // 如果主要API失败，尝试备用QQ官方接口
    console.log('主要QQ API失败，尝试备用方案...');
    
    // 使用QQ官方接口
    return {
      // QQ昵称获取可能需要其他方式，暂时使用QQ号作为备用
      name: `QQ用户${qqNumber}`,
      // 使用QQ官方头像接口，有多个备选域名
      avatar: `https://q1.qlogo.cn/g?b=qq&nk=${qqNumber}&s=100`,
    };
  } catch (error) {
    console.error('获取QQ信息失败:', error);
    
    // 即使出错也返回官方QQ头像链接作为备用
    return {
      name: `QQ用户${qqNumber}`,
      avatar: `https://q1.qlogo.cn/g?b=qq&nk=${qqNumber}&s=100`,
    };
  }
}

// 生成验证码
function generateVerificationCode() {
  return Math.floor(100000 + Math.random() * 900000).toString(); // 6位数字
}

export async function POST(request: Request) {
  try {
    // 解析请求体
    const { email } = await request.json();
    
    // 验证邮箱格式
    if (!email || typeof email !== 'string' || !email.endsWith('@qq.com')) {
      return NextResponse.json({ message: '请提供有效的QQ邮箱' }, { status: 400 });
    }
    
    // 提取QQ号
    const qqNumber = email.replace('@qq.com', '');
    
    // 获取QQ用户信息
    const { name, avatar } = await getQQInfo(qqNumber);
    
    // 生成验证码
    const verificationCode = generateVerificationCode();
    const expirationTime = new Date(Date.now() + 10 * 60 * 1000); // 10分钟过期
    
    // 连接数据库
    const connection = await connectToDatabase();
    
    try {
      // 检查是否已有这个邮箱的记录
      const [existingUsers] = await connection.execute(
        'SELECT * FROM users WHERE email = ?',
        [email]
      );
      
      const existingUserArray = existingUsers as any[];
      
      // 如果不存在用户，创建一个新用户
      if (existingUserArray.length === 0) {
        await connection.execute(
          'INSERT INTO users (email, name, avatar, created_at) VALUES (?, ?, ?, NOW())',
          [email, name, avatar]
        );
      } else if (name && avatar) {
        // 如果用户存在但没有头像或昵称，更新用户信息
        const user = existingUserArray[0];
        if (!user.name || !user.avatar) {
          await connection.execute(
            'UPDATE users SET name = COALESCE(?, name), avatar = COALESCE(?, avatar) WHERE email = ?',
            [name, avatar, email]
          );
        }
      }
      
      // 保存验证码到数据库并返回
      await connection.execute(
        'INSERT INTO verification_codes (email, code, expires_at) VALUES (?, ?, ?) ' +
        'ON DUPLICATE KEY UPDATE code = VALUES(code), expires_at = VALUES(expires_at)',
        [email, verificationCode, expirationTime]
      );
      
      // 发送验证码邮件
      await transporter.sendMail({
        from: `"Code Assistant" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: 'Code Assistant 登录验证码',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #3b82f6;">Code Assistant 登录验证码</h2>
            <p>您好${name ? ' ' + name : ''}！</p>
            <p>您的登录验证码是：</p>
            <div style="background-color: #f3f4f6; padding: 10px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 5px; margin: 20px 0;">
              ${verificationCode}
            </div>
            <p>此验证码将在 10 分钟后过期。如果您没有请求此验证码，请忽略此邮件。</p>
            <p>谢谢！</p>
            <p style="margin-top: 30px; font-size: 12px; color: #6b7280;">
              此邮件为系统自动发送，请勿回复。
            </p>
          </div>
        `,
      });
      
      // 始终返回验证码，以支持自动填充功能
      return NextResponse.json({ 
        message: '验证码已发送到您的邮箱', 
        code: verificationCode  // 返回验证码以便自动填充
      });
      
    } finally {
      // 关闭数据库连接
      await connection.end();
    }
    
  } catch (error: any) {
    console.error('验证码发送失败:', error);
    return NextResponse.json({ message: '验证码发送失败: ' + error.message }, { status: 500 });
  }
} 