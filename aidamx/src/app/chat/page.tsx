'use client';

import { useEffect, useState } from 'react';
import Navbar from "../components/Navbar";
import Sidebar, { useSidebarStore } from "../components/Sidebar";
import ChatArea from "../components/ChatArea";
import { applyThemeColor } from "../store/themeColorStore";

// 控制是否显示调试日志
const DEBUG_MODE = false;

// 安全的日志函数
const safeLog = (message: string, ...args: any[]) => {
  if (DEBUG_MODE) {
    console.log(message, ...args);
  }
};

// 防止桌面端侧边栏闪烁，移动端侧边栏默认隐藏
if (typeof window !== 'undefined') {
  const isMobile = window.innerWidth < 768;
  const style = document.createElement('style');
  style.textContent = `
    @media (min-width: 768px) {
      .sidebar-container {
        opacity: 1 !important;
        visibility: visible !important;
      }
    }
    @media (max-width: 767px) {
      .sidebar-container .w-16.h-full,
      .sidebar-container .w-64.h-full {
        display: none !important;
      }
    }
  `;
  document.head.appendChild(style);
  
  // 预设移动端状态
  if (isMobile) {
    setTimeout(() => {
      const sidebarStore = useSidebarStore.getState();
      sidebarStore.setMobileView(true);
      sidebarStore.setOpen(false);
      sidebarStore.setSmallSidebarOpen(false);
    }, 0);
  }
}

export default function ChatPage() {
  const [mounted, setMounted] = useState(false);
  const { isMobileView, isInitialized } = useSidebarStore();
  
  // 在页面组件中监听主题颜色变化
  useEffect(() => {
    setMounted(true);
    
    // 应用主题色彩
    if (typeof window !== 'undefined') {
      applyThemeColor();
      
      // 监听主题切换事件
      const handleThemeChange = () => {
        console.log('检测到主题变更，应用新的主题颜色');
        applyThemeColor();
      };
      
      window.addEventListener('themeChange', handleThemeChange);
      
      // 监听暗/亮模式切换
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (
            mutation.type === 'attributes' && 
            mutation.attributeName === 'class' &&
            mutation.target === document.documentElement
          ) {
            // 检测是否包含dark类
            const isDark = document.documentElement.classList.contains('dark');
            console.log('检测到class变化，当前模式:', isDark ? '暗色' : '亮色');
            applyThemeColor();
          }
        });
      });
      
      observer.observe(document.documentElement, { 
        attributes: true,
        attributeFilter: ['class']
      });
      
      // 添加媒体查询检测
      // 单独封装移动端检测逻辑，确保复用性
      const checkMobileView = () => {
        // 检测窗口宽度，并更新状态
        const isMobile = window.innerWidth < 768;
        useSidebarStore.getState().setMobileView(isMobile);
        
        // 如果是移动设备，确保侧边栏关闭
        if (isMobile) {
          useSidebarStore.getState().setOpen(false);
          useSidebarStore.getState().setSmallSidebarOpen(false);
        }
      };

      // 初始检测
      checkMobileView();
      
      // 监听窗口大小变化
      window.addEventListener('resize', checkMobileView);
      
      return () => {
        window.removeEventListener('themeChange', handleThemeChange);
        window.removeEventListener('resize', checkMobileView);
        observer.disconnect();
      };
    }
  }, []);
  
  // 在渲染前添加类，防止水合不匹配闪烁
  if (typeof document !== 'undefined' && !mounted) {
    document.documentElement.classList.add('no-hydration');
  }
  
  return (
    <div className="flex flex-col h-screen">
      {/* 导航栏 - 使用纯CSS控制显示/隐藏，不依赖React状态 */}
      <div className="navbar-container">
        <Navbar />
      </div>
      <div className="flex flex-1 overflow-hidden">
        {/* 侧边栏容器 - 通过CSS类控制显示/隐藏 */}
        <div className="sidebar-container">
          <Sidebar />
        </div>
        
        {/* 聊天区域 - 在移动端需要全宽 */}
        <div className="flex-1 overflow-hidden">
          <ChatArea />
        </div>
      </div>
    </div>
  );
} 