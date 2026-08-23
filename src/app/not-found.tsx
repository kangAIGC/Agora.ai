"use client";

import Script from "next/script";

/**
 * 自定义 404 页面
 *
 * GitHub Pages + Next.js 静态导出 + basePath 已知 Bug：
 *   next/link 会把 href="/chat" 渲染为 /basePath/chat；
 *   当客户端路由失败（e.g. 冷启动、硬跳转或 query 参数带 project）时，
 *   Next.js 回退到 404 页面，同时 GitHub Pages 的路径处理偶尔会
 *   叠加第二次 basePath，导致 /Agora.ai/Agora.ai/... 404。
 *
 * 此页面在 <head> 同步执行一个脚本，立即检测并修复 URL，避免死链。
 */
export default function NotFound() {
  return (
    <html lang="zh-CN">
      <head>
        <meta name="robots" content="noindex" />
        {/* inline 同步脚本：在页面完全加载前就执行，避免用户看到一闪而过的 404 */}
        <Script id="gh-pages-basepath-fix" strategy="beforeInteractive">
          {`
            (function () {
              try {
                var BASE = "/Agora.ai";
                var p = location.pathname;
                // /Agora.ai/Agora.ai  -> /Agora.ai/
                var dup = BASE + BASE;
                if (p.indexOf(dup) === 0) {
                  var suffix = p.substring(dup.length);
                  if (!suffix || suffix === "/") suffix = "/";
                  else if (suffix.charAt(0) !== "/") suffix = "/" + suffix;
                  location.replace(BASE + suffix + location.search + location.hash);
                  return;
                }
                // 其他 404：2 秒后跳首页
                setTimeout(function () {
                  location.replace(BASE + "/" + location.search + location.hash);
                }, 1500);
              } catch (e) {
                setTimeout(function () { location.replace("/"); }, 1500);
              }
            })();
          `}
        </Script>
      </head>
      <body style={{ background: "#000", color: "#888", fontFamily: "system-ui,sans-serif", display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", margin: 0 }}>
        <div style={{ textAlign: "center" }}>
          <p style={{ fontSize: 48, margin: 0, color: "#fff" }}>404</p>
          <p>正在跳转到正确页面…</p>
          <p style={{ fontSize: 12, opacity: 0.5, marginTop: 32 }}>Redirecting to correct URL…</p>
        </div>
      </body>
    </html>
  );
}
