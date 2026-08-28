/**
 * 构建产物修复：生成符合 GitHub Pages 规范的 404.html
 * =====================================================
 * 问题背景：
 *   Next.js (App Router) + output:'export' + trailingSlash 模式会为
 *   每条路由生成 out/<route>/index.html（如 out/chat/index.html）。
 *   但浏览器直接访问 /chat 时 GitHub Pages 会尝试读 /chat.html（存在性），
 *   或把动态子路径、无 trailingSlash 的 URL 当作不存在的文件，
 *   最后 404 到 GitHub Pages Custom 404。
 *
 *   Next 导出时也会生成 out/404.html，但内容是 Next 自定义 not-found.tsx
 *   渲染的"假 404 + 1.5s 后跳转"页面 — 用户会看到一个 404 闪动。
 *
 * 本脚本在 build 后运行：
 *   1) 扫描 out/<route>/index.html，收集所有路由
 *   2) 生成一个 out/404.html：
 *      - <head> 同步脚本：将 /Agora.ai/<known-route>[/?<query>][#<hash>]
 *        在浏览器第一次加载 404 时 0ms 内 history.replaceState +
 *        location.reload(true) 到正确路由 index.html；
 *      - 非已知路由（真正 404）：2 秒后跳首页；
 *      - body 保留极简黑色背景（无"404"大字），避免用户看到明显闪屏；
 *      - 同时脚本支持 dup basePath（/Agora.ai/Agora.ai/...）时的去重。
 *
 *   3) 用 index.html 内真正的首屏 SSR DOM + 内联 JS 替换掉原 out/404.html，
 *      让 GitHub Pages 返回 404 状态码时浏览器拿到的视觉=首页 SSR，
 *      不会出现"黑底 404 大字 → 再切回目标页"的视觉闪动。
 */
import { readdirSync, readFileSync, writeFileSync, statSync, existsSync, mkdirSync, copyFileSync } from 'node:fs';
import { join, dirname, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ROOT = join(__dirname, '..');
const OUT_DIR = join(ROOT, 'out');
const BASE_PATH = '/Agora.ai';

function walkIndex(dir, files = []) {
  if (!existsSync(dir)) return files;
  for (const e of readdirSync(dir)) {
    const full = join(dir, e);
    const st = statSync(full);
    if (st.isDirectory()) walkIndex(full, files);
    else if (e === 'index.html') files.push(full);
  }
  return files;
}

function build404Html() {
  const indexFiles = walkIndex(OUT_DIR);
  // 计算已知路由：相对 out/ 的目录名，去掉开头 ./
  const routes = new Set();
  for (const f of indexFiles) {
    const rel = relative(OUT_DIR, dirname(f)).split(sep).join('/');
    if (rel === '.') routes.add('/');
    else routes.add('/' + rel);
  }
  const sorted = Array.from(routes).sort((a, b) => b.length - a.length);
  const routesJson = JSON.stringify(sorted);

  // 选一个 SSR 骨架作为 404 页面 body：优先用首页 index.html（视觉最完整）
  const fallbackHtmlPath = join(OUT_DIR, 'index.html');
  let skeleton = '';
  if (existsSync(fallbackHtmlPath)) {
    skeleton = readFileSync(fallbackHtmlPath, 'utf8');
  } else {
    skeleton = `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"/></head><body style="background:#000"></body></html>`;
  }

  // 注入脚本到 <head> 最开头（beforeInteractive 等效），让历史修正先于首屏渲染可见
  const fixScript = `
<script id="aga-pages-404-fix" data-routes='${routesJson.replace(/'/g, "\\'")}'>
(function(){
  try {
    var BASE = "${BASE_PATH}";
    var routes = [];
    try { routes = JSON.parse(document.getElementById('aga-pages-404-fix').getAttribute('data-routes') || '[]'); } catch(e) {}
    var p = location.pathname;
    // 1) 去除重复 basePath
    var dup = BASE + BASE;
    if (p.indexOf(dup) === 0) {
      var suf = p.substring(dup.length);
      if (!suf || suf === '/') suf = '/';
      else if (suf.charAt(0) !== '/') suf = '/' + suf;
      location.replace(BASE + suf + location.search + location.hash);
      return;
    }
    // 2) 截取 basePath 之后的部分
    var rel = p;
    if (rel.indexOf(BASE) === 0) rel = rel.substring(BASE.length);
    if (rel === '') rel = '/';
    // 去掉尾部斜杠做匹配
    var cleaned = rel;
    while (cleaned.length > 1 && cleaned.charAt(cleaned.length-1) === '/') cleaned = cleaned.substring(0, cleaned.length-1);
    var matched = null;
    for (var i = 0; i < routes.length; i++) {
      var r = routes[i];
      var rc = r;
      while (rc.length > 1 && rc.charAt(rc.length-1) === '/') rc = rc.substring(0, rc.length-1);
      if (rc === cleaned) { matched = r; break; }
    }
    // 3) 命中已知路由：replaceState + 立即 reload (无闪屏：body 已是首页SSR骨架)
    if (matched) {
      var target = BASE + (matched === '/' ? '/' : matched);
      var sameAsCurrent = (target === location.pathname);
      if (!sameAsCurrent) {
        history.replaceState(null, '', target + location.search + location.hash);
        location.reload(true);
      }
      return;
    }
    // 4) 未知路由：2 秒后跳首页
    setTimeout(function(){
      location.replace(BASE + '/' + location.search + location.hash);
    }, 2000);
  } catch(e) {
    setTimeout(function(){ location.replace('${BASE_PATH}/'); }, 2000);
  }
})();
</script>`;

  // 将脚本注入到 <head> 之后的第一行（在 SSR 骨架之上）
  let injected = skeleton;
  const headIdx = injected.indexOf('<head>');
  if (headIdx >= 0) {
    injected = injected.substring(0, headIdx + 6) + fixScript + injected.substring(headIdx + 6);
  } else {
    injected = '<!DOCTYPE html><html><head>' + fixScript + '</head>' + injected;
  }

  // 添加 noindex
  if (injected.indexOf('name="robots"') < 0) {
    const robots = '<meta name="robots" content="noindex" />';
    const hEnd = injected.indexOf('</head>');
    if (hEnd >= 0) injected = injected.substring(0, hEnd) + robots + injected.substring(hEnd);
  }

  const outPath = join(OUT_DIR, '404.html');
  writeFileSync(outPath, injected, 'utf8');
  return { routesCount: sorted.length, routes: sorted, size: injected.length };
}

function main() {
  if (!existsSync(OUT_DIR)) {
    console.error('[generate-gh-pages-404] 未找到 out/，请先 next build');
    process.exit(1);
  }
  const r = build404Html();
  console.log(`[generate-gh-pages-404] 完成：生成 404.html（${r.routesCount} 条已知路由，${r.size.toLocaleString()} bytes）`);
  console.log('  已知路由:', r.routes.join(', '));
}

main();
