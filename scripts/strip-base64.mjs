/**
 * 从大型 HTML 文件中移除所有 base64 编码的数据，
 * 替换为同目录下的外部 PNG 文件引用或占位符。
 *
 * 处理所有形式的 base64 data URI:
 * - src="data:..."
 * - url(data:...)
 * - href="data:..."
 * - 任何包含 data:...;base64,... 的内容
 *
 * 用法: node scripts/strip-base64.mjs
 */
import { readFileSync, writeFileSync, readdirSync, existsSync, statSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();

const targets = [
  { html: 'public/mock-manju/html.html', imagesDir: 'public/mock-manju' },
  { html: 'public/mock-dianshang/html.html', imagesDir: 'public/mock-dianshang' },
  { html: 'public/mock-dianshang/绿发晶白水晶拼色树叶吊坠手链.html', imagesDir: 'public/mock-dianshang' },
  { html: 'public/mock-arch/流水为脉 · 坊巷成园.html', imagesDir: 'public/mock-arch' },
];

function listImages(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => /\.(png|jpe?g)$/i.test(f))
    .sort();
}

function stripBase64(filePath, imagesDir) {
  const abs = join(ROOT, filePath);
  if (!existsSync(abs)) {
    console.warn(`[SKIP] 文件不存在: ${filePath}`);
    return;
  }

  const beforeSize = statSync(abs).size;
  const raw = readFileSync(abs, 'utf8');
  const images = listImages(join(ROOT, imagesDir));
  let imgIdx = 0;
  let stripped = 0;

  // 匹配所有 data URI（不论在什么属性/CSS中）
  // 格式: data:<mime>;base64,<很长的base64字符串>
  const cleaned = raw.replace(
    /data:(image\/(?:png|jpe?g|webp|gif|svg\+xml)|video\/(?:mp4|webm|ogg)|application\/pdf);base64,[A-Za-z0-9+/=]+/g,
    () => {
      stripped++;
      // 优先用外部图片
      if (imgIdx < images.length) {
        const img = images[imgIdx++];
        return img;
      }
      return '';
    },
  );

  // 写回
  writeFileSync(abs, cleaned, 'utf8');
  const afterSize = statSync(abs).size;
  const beforeMB = (beforeSize / 1024 / 1024).toFixed(2);
  const afterMB = (afterSize / 1024 / 1024).toFixed(2);
  console.log(
    `[OK] ${filePath}\n  ${beforeMB} MB -> ${afterMB} MB (stripped ${stripped} base64 blobs, used ${imgIdx} external images)`,
  );
}

for (const t of targets) {
  stripBase64(t.html, t.imagesDir);
}

console.log('\n完成！所有大型 HTML 文件已清理。');
