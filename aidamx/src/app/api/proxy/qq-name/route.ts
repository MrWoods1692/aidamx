import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const qq = searchParams.get('qq');
  
  if (!qq) {
    return NextResponse.json({ error: '缺少QQ号参数' }, { status: 400 });
  }

  try {
    // 从服务器端发起请求，这样不会有跨域问题
    const response = await fetch(`http://api.mmp.cc/api/qqname?qq=${qq}`, {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Accept-Charset': 'utf-8'
      }
    });
    
    // 检查响应状态
    if (!response.ok) {
      throw new Error(`API响应错误: ${response.status}`);
    }
    
    // 获取响应文本，确保编码正确
    const text = await response.text();
    
    // 解析JSON
    let data;
    try {
      data = JSON.parse(text);
    } catch (error) {
      console.error('JSON解析错误:', text);
      throw new Error('JSON解析错误');
    }
    
    // 记录日志，方便调试
    console.log('获取QQ昵称成功:', data);
    
    return NextResponse.json(data);
  } catch (error) {
    console.error('获取QQ昵称失败:', error);
    return NextResponse.json({ 
      error: '获取QQ昵称失败', 
      message: error instanceof Error ? error.message : String(error) 
    }, { status: 500 });
  }
} 