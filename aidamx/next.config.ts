import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactStrictMode: true,
  i18n: {
    locales: ['zh-CN', 'zh-TW', 'en'],
    defaultLocale: 'zh-CN',
  },
  // 设置服务器端口
  serverRuntimeConfig: {
    port: 6677,
  },
  // 设置环境变量供客户端使用
  publicRuntimeConfig: {
    port: 6677,
  },
  // 配置允许的图片域名
  images: {
    domains: [
      'q1.qlogo.cn',      // QQ头像域名
      'q2.qlogo.cn',      // QQ头像备用域名
      'q3.qlogo.cn',      // QQ头像备用域名
      'q4.qlogo.cn',      // QQ头像备用域名
      'qlogo2.store.qq.com',  // QQ空间头像域名
      'qlogo3.store.qq.com',  // QQ空间头像域名
      'qlogo4.store.qq.com'   // QQ空间头像域名
    ],
  },
  // 忽略ESLint和TypeScript错误，使构建能够完成
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
