import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // 静态导出模式：生成纯静态 HTML/JS/CSS，可托管到 GitHub Pages / Cloudflare Pages
  output: 'export',
  // 导出目录结构：/discover  -> out/discover/index.html（而非 out/discover.html）
  // GitHub Pages 仅识别目录形式的路径，扁平 discover.html 会被 404.html 兜底
  trailingSlash: true,
  // 兼容 GitHub Pages 子路径 https://kangAIGC.github.io/Agora.ai/
  // 部署到自定义域名时改为 '/'
  basePath: '/Agora.ai',
  allowedDevOrigins: ['*.dev.coze.site'],
  images: {
    // 静态导出必须禁用图片优化（无服务端运行时）
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*',
        pathname: '/**',
      },
    ],
  },
  // 禁用构建阶段的 TypeScript 类型检查（使用 `pnpm ts-check` 单独执行即可）
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
