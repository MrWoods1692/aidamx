'use client';

import React, { useEffect, useState } from 'react';
import Head from 'next/head';

interface SiteSettingsProps {
  children: React.ReactNode;
}

interface SiteSettings {
  site_title: string;
  site_logo: string;
}

export default function SiteSettings({ children }: SiteSettingsProps) {
  const [settings, setSettings] = useState<SiteSettings>({
    site_title: 'AI对话',
    site_logo: '/favicon.ico'
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await fetch('/api/admin/site-settings');
        const data = await response.json();
        
        if (data.success && data.data) {
          setSettings(data.data);
          
          // 动态更新网页标题和图标
          document.title = data.data.site_title;
          
          // 查找并更新网站图标
          const existingLink = document.querySelector('link[rel="icon"]') as HTMLLinkElement;
          if (existingLink) {
            existingLink.href = data.data.site_logo;
          } else {
            const link = document.createElement('link');
            link.rel = 'icon';
            link.href = data.data.site_logo;
            document.head.appendChild(link);
          }
        }
      } catch (error) {
        console.error('加载网站设置失败:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, []);

  // 因为我们要动态改变标题和图标，所以不需要渲染任何内容
  return <>{children}</>;
} 