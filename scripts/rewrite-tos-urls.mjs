/**
 * 构建后 URL 替换脚本
 *
 * 在 `pnpm next build` 生成 out/ 后运行，把静态 HTML / JSON 中的本地资源路径
 * 替换为 TOS 公开桶 URL。源码（public/ 与 src/）保持本地路径不变，
 * dev 模式走本地，build 产物走 TOS。
 *
 * 用法: node scripts/rewrite-tos-urls.mjs
 *
 * 规则:
 *   - 绝对路径 "/mock-xxx/yyy.png"、"/bg3.mp4"  →  ${TOS_BASE_URL}/mock-xxx/yyy.png
 *   - 相对路径 '1.mp4'、"img1.png"（带资源扩展名，按 HTML 所在 out 子目录解析）
 *                                              →  ${TOS_BASE_URL}/<dir>/1.mp4
 *   - 已是 https:// 的跳过
 *
 * 若 NEXT_PUBLIC_TOS_BASE_URL 未配置，直接退出（不影响部署）。
 */
import { readdirSync, readFileSync, writeFileSync, statSync, existsSync } from 'node:fs';
import { join, dirname, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ROOT = join(__dirname, '..');
const OUT_DIR = join(ROOT, 'out');

const TOS_BASE_URL = (process.env.NEXT_PUBLIC_TOS_BASE_URL || '').replace(/\/$/, '');

// 资源扩展名（小写，无点），用于匹配需替换的路径
const ASSET_EXT = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'mp4', 'webm', 'mov'];
const EXT_PATTERN = ASSET_EXT.join('|');
// 已带 basePath 前缀的绝对路径（/Agora.ai/...）也需要处理
const BASE_PATH = '/Agora.ai';

function walk(dir, files = []) {
  if (!existsSync(dir)) return files;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      walk(full, files);
    } else if (/\.(html|json)$/i.test(entry)) {
      files.push(full);
    }
  }
  return files;
}

function rewriteFile(filePath) {
  const raw = readFileSync(filePath, 'utf8');
  // 文件在 out/ 下的相对目录（用于解析相对路径），用 / 分隔
  const relDir = dirname(relative(OUT_DIR, filePath)).split(sep).join('/');
  // 基础 key 前缀：relDir 为 '.' 时表示根目录，前缀为空
  const basePrefix = relDir === '.' ? '' : relDir + '/';

  let count = 0;

  // 1) 绝对路径：匹配引号包裹的本地绝对路径（可选 basePath 前缀），资源扩展名结尾
  //    形如 "/mock-dianshang/1.mp4"、"/Agora.ai/mock-dianshang/1.mp4"、"/bg3.mp4"
  const absRe = new RegExp(
    `(['"])(${BASE_PATH})?(/[^'"\\s]*?\\.(?:${EXT_PATTERN}))\\1`,
    'g',
  );
  let next = raw.replace(absRe, (m, q, _bp, p) => {
    count++;
    return `${q}${TOS_BASE_URL}${p}${q}`;
  });

  // 2) 相对路径：匹配引号包裹的纯文件名（无斜杠），资源扩展名结尾
  //    形如 '1.mp4'、"img1.png"、'mock-01.png'
  const relRe = new RegExp(
    `(['"])([a-zA-Z0-9_\\-\\u4e00-\\u9fa5]+\\.(?:${EXT_PATTERN}))\\1`,
    'g',
  );
  next = next.replace(relRe, (m, q, name) => {
    count++;
    return `${q}${TOS_BASE_URL}/${basePrefix}${name}${q}`;
  });

  if (count > 0) {
    writeFileSync(filePath, next, 'utf8');
  }
  return count;
}

function main() {
  if (!TOS_BASE_URL) {
    console.log('[rewrite-tos-urls] NEXT_PUBLIC_TOS_BASE_URL 未配置，跳过 URL 重写。');
    return;
  }
  if (!existsSync(OUT_DIR)) {
    console.error(`[rewrite-tos-urls] 未找到 out/ 目录: ${OUT_DIR}`);
    console.error('请先运行 `pnpm next build` 生成构建产物。');
    process.exit(1);
  }

  const files = walk(OUT_DIR);
  console.log(`[rewrite-tos-urls] 扫描 ${files.length} 个 HTML/JSON，TOS 域名: ${TOS_BASE_URL}`);
  let total = 0;
  let touched = 0;
  for (const f of files) {
    const n = rewriteFile(f);
    if (n > 0) {
      touched++;
      total += n;
      console.log(`  ${relative(ROOT, f)}  (${n} 处)`);
    }
  }
  console.log(`[rewrite-tos-urls] 完成: 改写 ${touched} 个文件，共 ${total} 处 URL。`);
}

main();
