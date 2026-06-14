import type { Metadata } from "next";
import "./globals.css";
import "./fonts.css";
import Providers from "./providers";
import { getSiteSettings } from "@/lib/siteSettings";

// 动态获取元数据
export async function generateMetadata(): Promise<Metadata> {
  // 获取网站设置
  const settings = await getSiteSettings();
  
  return {
    title: settings.title || 'Code Assistant',
    description: "Code Assistant with multiple language support",
    icons: {
      icon: settings.logo || '/favicon.ico',
    }
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <link 
          rel="stylesheet" 
          href="https://static.zeoseven.com/zsft/442/main/result.css" 
          precedence="default" 
        />
        <link
          rel="preload"
          href="https://static.zeoseven.com/zsft/dx/main.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        <style dangerouslySetInnerHTML={{ __html: `
          :root {
            --navbar-height: 64px;
            --card-bg: 255, 255, 255;   /* 纯白色作为卡片背景 */
            --sidebar-bg: 255, 255, 255; /* 纯白色作为侧边栏背景 */
            --input-bg: 255, 255, 255;   /* 保持输入框为纯白色背景 */
            --primary-color: 100, 108, 255; /* 紫色作为强调色 */
            --primary-hover: 116, 123, 255;
            --border-color: 220, 220, 225; /* 适中的边框颜色 */
            --text-primary: 33, 33, 33;
            --text-secondary: 75, 85, 99;
          }
          .dark {
            --card-bg: 33, 33, 33;     /* 深色模式卡片背景 */
            --sidebar-bg: 30, 30, 30;  /* 深色模式侧边栏背景 */
            --input-bg: 42, 42, 42;    /* 深色模式下使用暗灰色背景 */
            --border-color: 82, 90, 105; /* 适中的深色模式边框颜色 */
            --text-primary: 255, 255, 255;
            --text-secondary: 200, 200, 200;
          }
          /* 基本样式 */
          .navbar {
            height: var(--navbar-height) !important;
            background-color: rgb(var(--card-bg)) !important;
            border-bottom: 1px solid rgb(var(--border-color));
          }
          .welcome-navbar {
            background-color: transparent !important;
            border-bottom: none !important;
          }
          .w-16.h-full, .w-64.h-full {
            background-color: rgb(var(--sidebar-bg)) !important;
          }
          .border, .border-r, .border-l, .border-t, .border-b {
            border-color: rgb(var(--border-color)) !important;
          }
          textarea, input, .chat-input {
            background-color: rgb(var(--input-bg)) !important;
          }
          /* 确保图标正确显示 */
          svg {
            display: inline-block;
            vertical-align: middle;
          }
        `}} />
        <script dangerouslySetInnerHTML={{ __html: `
          (function() {
            try {
              // 检查本地存储中的主题模式（暗/亮）
              const storedTheme = localStorage.getItem('theme');
              const isDarkMode = storedTheme === 'dark';
              
              // 立即应用正确的主题类
              if (isDarkMode) {
                document.documentElement.classList.add('dark');
              } else {
                document.documentElement.classList.remove('dark');
              }
              
              // 读取保存的主题颜色并立即应用
              const themeStorage = localStorage.getItem('theme-color-storage');
              if (themeStorage) {
                try {
                  const parsed = JSON.parse(themeStorage);
                  if (parsed.state && parsed.state.currentColorId && parsed.state.colors) {
                    const currentColorId = parsed.state.currentColorId;
                    const colors = parsed.state.colors;
                    
                    // 找到对应的主题颜色
                    const currentColor = colors.find(c => c.id === currentColorId);
                    if (currentColor) {
                      // 立即应用主题颜色到CSS变量
                      document.documentElement.style.setProperty('--primary-color', currentColor.primary);
                      document.documentElement.style.setProperty('--primary-hover', currentColor.hover);
                      
                      // 根据当前是否为暗色模式设置对应的背景色
                      if (isDarkMode) {
                        document.documentElement.style.setProperty('--sidebar-bg', currentColor.bgDark);
                        document.documentElement.style.setProperty('--card-bg', currentColor.bgDark);
                      } else {
                        document.documentElement.style.setProperty('--sidebar-bg', currentColor.bgLight);
                        document.documentElement.style.setProperty('--card-bg', currentColor.bgLight);
                      }
                    }
                  }
                } catch (e) {
                  console.error('解析主题存储失败', e);
                }
              }
              
              // 尝试从本地存储中获取网站设置
              try {
                const storedSettings = localStorage.getItem('site-settings');
                if (storedSettings) {
                  const settings = JSON.parse(storedSettings);
                  // 如果标题将要改变，则预先设置标题，防止闪烁
                  if (settings.title && document.title !== settings.title) {
                    document.title = settings.title;
                  }
                }
              } catch (e) {
                console.error('应用存储的网站设置失败:', e);
              }
            } catch (e) {
              console.error('初始化主题颜色失败:', e);
            }
          })();
        `}} />
      </head>
      <body className="min-h-screen maple-font">
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}


