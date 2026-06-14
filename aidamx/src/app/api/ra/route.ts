import { NextResponse } from 'next/server';

const ACCESS_TOKEN = '362856178'; // 用户提供的token

// 支持的音频格式
const AUDIO_FORMATS = {
  'audio-16khz-128kbitrate-mono-mp3': 'audio-16khz-128kbitrate-mono-mp3',
  'audio-24khz-160kbitrate-mono-mp3': 'audio-24khz-160kbitrate-mono-mp3',
  'audio-48khz-192kbitrate-mono-mp3': 'audio-48khz-192kbitrate-mono-mp3',
  'webm-24khz-16bit-mono-opus': 'webm-24khz-16bit-mono-opus',
  'riff-24khz-16bit-mono-pcm': 'riff-24khz-16bit-mono-pcm',
  'raw-24khz-16bit-mono-pcm': 'raw-24khz-16bit-mono-pcm',
};

export async function POST(request: Request) {
  try {
    console.log('收到TTS请求');
    
    // 获取音频格式
    const format = request.headers.get('FORMAT') || 'webm-24khz-16bit-mono-opus';
    console.log('请求的音频格式:', format);
    
    if (!Object.keys(AUDIO_FORMATS).includes(format)) {
      console.log('不支持的音频格式:', format);
      return NextResponse.json({ 
        error: '不支持的音频格式',
        supportedFormats: Object.keys(AUDIO_FORMATS)
      }, { status: 400 });
    }

    // 获取SSML内容
    const ssml = await request.text();
    console.log('SSML内容长度:', ssml.length);
    
    if (!ssml || !ssml.includes('<speak')) {
      console.log('无效的SSML格式');
      return NextResponse.json({ 
        error: '无效的SSML格式' 
      }, { status: 400 });
    }

    // 转发请求到微软Azure TTS服务
    // 这里实际使用的是代理，将请求转发到用户提供的服务
    const externalTtsUrl = 'https://tts.34567.xin/api/ra';
    console.log('转发请求到:', externalTtsUrl);
    
    // 无论输入请求是否有Authorization头，都使用我们设置的token
    try {
      const response = await fetch(externalTtsUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain',
          'FORMAT': format,
          'Authorization': `Bearer ${ACCESS_TOKEN}`
        },
        body: ssml
      });
      
      console.log('TTS服务响应状态:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('TTS服务错误响应:', errorText);
        throw new Error(`语音合成请求失败: ${response.status} ${response.statusText} - ${errorText}`);
      }

      // 获取音频数据
      const audioBuffer = await response.arrayBuffer();
      console.log('获取到音频数据，大小:', audioBuffer.byteLength, '字节');
      
      // 返回音频数据
      return new NextResponse(audioBuffer, {
        headers: {
          'Content-Type': response.headers.get('Content-Type') || 'audio/mpeg',
          'Content-Length': audioBuffer.byteLength.toString(),
        }
      });
    } catch (error) {
      console.error('调用外部TTS服务失败:', error);
      
      // 如果外部TTS服务失败，尝试返回一个指示客户端使用内置TTS的响应
      return NextResponse.json({
        error: '语音服务暂时不可用',
        useBuiltIn: true,
        message: error instanceof Error ? error.message : String(error)
      }, { status: 503 });
    }
  } catch (error: any) {
    console.error('文本转语音处理失败:', error);
    return NextResponse.json({ 
      error: '文本转语音处理失败', 
      message: error.message || String(error) 
    }, { status: 500 });
  }
} 