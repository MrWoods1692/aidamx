'use client';

import { useRouter } from 'next/navigation';
import Image from 'next/image';
import WelcomeNavbar from './components/WelcomeNavbar';
import './welcome.css'; // 导入专用样式文件
import { useI18n } from './providers/I18nProvider';
import { useEffect, useState } from 'react';
import confetti from 'canvas-confetti';

// 透明导航栏样式
const transparentNavbarStyle = `
  .welcome-navbar {
    background-color: transparent !important;
    border-bottom: none !important;
    box-shadow: none !important;
  }
`;

export default function WelcomePage() {
  const router = useRouter();
  const { t } = useI18n(); // 引入i18n翻译功能
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  // 礼花动画函数
  const fireConfetti = () => {
    const count = 200;
    const defaults = {
      origin: { y: 0.7 }
    };

    function fire(particleRatio: number, opts: any) {
      confetti({
        ...defaults,
        ...opts,
        particleCount: Math.floor(count * particleRatio)
      });
    }

    fire(0.25, {
      spread: 26,
      startVelocity: 55,
    });
    fire(0.2, {
      spread: 60,
    });
    fire(0.35, {
      spread: 100,
      decay: 0.91,
      scalar: 0.8
    });
    fire(0.1, {
      spread: 120,
      startVelocity: 25,
      decay: 0.92,
      scalar: 1.2
    });
    fire(0.1, {
      spread: 120,
      startVelocity: 45,
    });
  };

  const handleStartChat = () => {
    // 播放礼花碎屑动画
    if (isClient) {
      fireConfetti();
      
      // 延迟一秒后跳转，让用户有时间欣赏礼花效果
      setTimeout(() => {
        // 跳转到主聊天界面
        router.push('/chat');
      }, 1000);
    } else {
      // 如果在服务器端渲染时，直接跳转
      router.push('/chat');
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-[rgb(var(--bg-light))] dark:bg-[rgb(var(--bg-dark))]">
      {/* 内联样式覆盖 */}
      <style jsx global>{transparentNavbarStyle}</style>
      
      <WelcomeNavbar />
      
      <div className="relative flex-1 flex flex-col items-center justify-center overflow-hidden">
        {/* 背景SVG */}
        <div className="absolute inset-0 w-full h-full z-0">
          <Image 
            src="/images/hl.svg" 
            alt="Background" 
            fill
            style={{ objectFit: 'cover' }}
            priority
          />
        </div>
        
        {/* 文字和按钮 */}
        <div className="relative z-10 text-center px-8 py-8 max-w-4xl mx-auto mt-[-100px]">
          {/* 欢迎标题 - 使用i18n翻译，应用特殊字体 */}
          <h1 className="text-6xl md:text-8xl font-extrabold mb-5 text-black welcome-title">
            {t('welcome.title')}
          </h1>
          
          {/* 描述文字 - 使用i18n翻译 */}
          <p className="text-lg md:text-xl mb-20 text-black">
            {t('welcome.description')}
          </p>
          
          {/* 按钮 - 添加指引线条样式 */}
          <div className="button-guide">
            <span className="click-here-text">{t('welcome.clickHere')}</span>
            <button
              onClick={handleStartChat}
              className="px-8 py-4 bg-white rounded-full font-bold shadow-xl hover:shadow-2xl hover:bg-[#f8f8ff] hover:scale-105 transition-all mx-auto border-2 border-[#4338ca] cursor-pointer"
            >
              <span className="gold-text text-lg">{t('welcome.startButton')}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
} 