"use client";

import Script from "next/script";

/**
 * Next.js 内置 404 兜底（App Router export 时写一份 out/404.html，但我们会在
 * build 后用 scripts/generate-gh-pages-404.mjs 覆盖它，这里只作为开发 fallback）
 *
 * 设计原则：
 *   1) 不展示"404"大字，避免闪屏 —— 背景=页面背景色，内容空白
 *   2) 首屏同步脚本：对已知路由（/chat、/discover、/profile、/material、/membership）
 *      做 history.replaceState，消除 GitHub Pages + trailingSlash 造成的
 *      "404 返回 200 页"的短暂地址错乱
 *   3) 其他未知路径则在 2s 后静默跳首页（不做视觉提示）
 */
export default function NotFound() {
  return (
    <html lang="zh-CN">
      <head>
        <meta name="robots" content="noindex" />
        <style>{`html,body{background:#0a0a0a;margin:0;padding:0;min-height:100vh}`}</style>
        <Script id="aga-client-404-fix" strategy="beforeInteractive">
          {`
            (function () {
              try {
                var BASE = "/Agora.ai";
                var KNOWN = ["","/chat","/discover","/profile","/material","/membership","/design","/render","/video","/ppt"];
                var p = location.pathname;
                var dup = BASE + BASE;
                if (p.indexOf(dup) === 0) {
                  var s = p.substring(dup.length);
                  if (!s || s === "/") s = "/";
                  else if (s.charAt(0) !== "/") s = "/" + s;
                  location.replace(BASE + s + location.search + location.hash);
                  return;
                }
                var rel = p;
                if (rel.indexOf(BASE) === 0) rel = rel.substring(BASE.length);
                if (rel === "") rel = "/";
                if (rel.length > 1 && rel.charAt(rel.length-1) === "/") rel = rel.substring(0, rel.length-1);
                if (KNOWN.indexOf(rel) >= 0) {
                  var target = BASE + (rel === "/" ? "/" : rel + "/");
                  if (target !== location.pathname) {
                    history.replaceState(null, "", target + location.search + location.hash);
                    location.reload(true);
                  }
                  return;
                }
                setTimeout(function(){ location.replace(BASE + "/" + location.search + location.hash); }, 1500);
              } catch(e) {
                setTimeout(function(){ location.replace("/"); }, 1500);
              }
            })();
          `}
        </Script>
      </head>
      <body />
    </html>
  );
}
