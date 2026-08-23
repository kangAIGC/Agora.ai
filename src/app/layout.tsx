import type { Metadata } from "next";
import { ProjectProvider } from "@/lib/project-store";
import Header from "@/components/Header";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Agora - 通用 AIGC 一站式内容交付平台",
    template: "%s | Agora - 通用 AIGC 一站式内容交付平台",
  },
  description: "Universal AIGC One-Stop Content Delivery Platform - 面向多领域的通用 AIGC 一站式内容交付平台，提供文案创作、资产图渲染、视频生成到网页制作的全流程智能创作服务",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body className="min-h-screen bg-black font-sans text-white antialiased" suppressHydrationWarning>
        <ProjectProvider>
          <Header />
          <main>{children}</main>
          <Toaster richColors position="top-center" />
        </ProjectProvider>
      </body>
    </html>
  );
}
