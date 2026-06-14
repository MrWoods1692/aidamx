import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { writeFile } from 'fs/promises';
import path from 'path';
import { mkdir } from 'fs/promises';

// 验证管理员身份
async function verifyAdmin(request: NextRequest) {
  const token = request.cookies.get('admin_token')?.value;
  
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

// 生成唯一文件名
function generateUniqueFilename(originalFilename: string): string {
  const extension = path.extname(originalFilename);
  const timestamp = Date.now();
  const randomString = Math.random().toString(36).substring(2, 10);
  return `logo_${timestamp}_${randomString}${extension}`;
}

// POST: 上传Logo图片
export async function POST(request: NextRequest) {
  try {
    // 验证管理员身份
    const admin = await verifyAdmin(request);
    
    if (!admin) {
      return NextResponse.json({ 
        success: false, 
        message: '未授权访问' 
      }, { status: 401 });
    }
    
    // 解析表单数据
    const formData = await request.formData();
    const file = formData.get('logo') as File;
    
    if (!file) {
      return NextResponse.json({ 
        success: false, 
        message: '未提供文件' 
      }, { status: 400 });
    }
    
    // 校验文件类型
    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml', 'image/x-icon'];
    if (!validTypes.includes(file.type)) {
      return NextResponse.json({ 
        success: false, 
        message: '不支持的文件类型，请上传图片文件' 
      }, { status: 400 });
    }
    
    // 校验文件大小（限制为2MB）
    if (file.size > 2 * 1024 * 1024) {
      return NextResponse.json({ 
        success: false, 
        message: '文件大小超过限制（最大2MB）' 
      }, { status: 400 });
    }
    
    // 读取文件数据
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    
    // 定义保存路径
    const uploadDir = path.join(process.cwd(), 'public', 'uploads');
    const uniqueFilename = generateUniqueFilename(file.name);
    const filePath = path.join(uploadDir, uniqueFilename);
    
    // 确保上传目录存在
    try {
      await mkdir(uploadDir, { recursive: true });
    } catch (error) {
      console.error('创建上传目录失败:', error);
    }
    
    // 保存文件
    await writeFile(filePath, buffer);
    
    // 返回文件的相对URL
    const fileUrl = `/uploads/${uniqueFilename}`;
    
    return NextResponse.json({
      success: true,
      url: fileUrl,
      message: '文件上传成功'
    });
    
  } catch (error: any) {
    console.error('上传Logo失败:', error);
    return NextResponse.json({ 
      success: false, 
      message: '上传Logo失败: ' + error.message 
    }, { status: 500 });
  }
} 