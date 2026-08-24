/**
 * 批量上传 public/ 下的图片、视频到 TOS 公开桶
 *
 * 用法:
 *   1. 在 .env.local 配置 TOS_ENDPOINT / TOS_REGION / TOS_BUCKET /
 *      TOS_ACCESS_KEY / TOS_SECRET_KEY / NEXT_PUBLIC_TOS_BASE_URL
 *   2. node scripts/upload-to-tos.mjs
 *
 * TOS key = 相对 public/ 的路径（保持目录结构），如:
 *   public/mock-dianshang/1.mp4  →  mock-dianshang/1.mp4
 *   public/bg3.mp4               →  bg3.mp4
 *
 * 上传后对象公开 URL = NEXT_PUBLIC_TOS_BASE_URL + '/' + key
 */
import { readdirSync, readFileSync, statSync, createReadStream } from 'node:fs';
import { join, relative, extname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { S3Client } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';

dotenv.config({ path: '.env.local' });

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ROOT = join(__dirname, '..');
const PUBLIC_DIR = join(ROOT, 'public');

const TOS_ENDPOINT = process.env.TOS_ENDPOINT || '';
const TOS_REGION = process.env.TOS_REGION || '';
const TOS_BUCKET = process.env.TOS_BUCKET || '';
const TOS_ACCESS_KEY = process.env.TOS_ACCESS_KEY || '';
const TOS_SECRET_KEY = process.env.TOS_SECRET_KEY || '';
const TOS_BASE_URL = (process.env.NEXT_PUBLIC_TOS_BASE_URL || '').replace(/\/$/, '');

// 允许上传的资源扩展名（小写，无点）
const ALLOWED_EXT = new Set([
  'png', 'jpg', 'jpeg', 'gif', 'webp',
  'mp4', 'webm', 'mov',
]);

// 扩展名 → ContentType
const CONTENT_TYPE = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  mp4: 'video/mp4',
  webm: 'video/webm',
  mov: 'video/quicktime',
};

function listAssetFiles(dir, base = dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      out.push(...listAssetFiles(full, base));
    } else {
      const ext = extname(entry).slice(1).toLowerCase();
      if (ALLOWED_EXT.has(ext)) {
        out.push({ abs: full, rel: relative(base, full).replace(/\\/g, '/'), size: st.size });
      }
    }
  }
  return out;
}

function fmtSize(n) {
  if (n >= 1024 * 1024) return (n / 1024 / 1024).toFixed(2) + ' MB';
  if (n >= 1024) return (n / 1024).toFixed(1) + ' KB';
  return n + ' B';
}

async function main() {
  // 校验配置
  const missing = [];
  if (!TOS_ENDPOINT) missing.push('TOS_ENDPOINT');
  if (!TOS_REGION) missing.push('TOS_REGION');
  if (!TOS_BUCKET) missing.push('TOS_BUCKET');
  if (!TOS_ACCESS_KEY) missing.push('TOS_ACCESS_KEY');
  if (!TOS_SECRET_KEY) missing.push('TOS_SECRET_KEY');
  if (missing.length) {
    console.error(`[ERROR] 缺少环境变量: ${missing.join(', ')}`);
    console.error('请在 .env.local 配置 TOS_* 凭证（参考 .env.example）');
    process.exit(1);
  }

  const files = listAssetFiles(PUBLIC_DIR);
  if (files.length === 0) {
    console.log('public/ 下未发现图片/视频资源，退出。');
    return;
  }

  console.log(`找到 ${files.length} 个资源，准备上传到 TOS 桶 ${TOS_BUCKET}...`);
  if (TOS_BASE_URL) console.log(`公开 URL 前缀: ${TOS_BASE_URL}/`);
  console.log('');

  const s3 = new S3Client({
    region: TOS_REGION,
    endpoint: TOS_ENDPOINT,
    credentials: { accessKeyId: TOS_ACCESS_KEY, secretAccessKey: TOS_SECRET_KEY },
    forcePathStyle: false,
  });

  let ok = 0;
  let fail = 0;
  const failed = [];
  for (let i = 0; i < files.length; i++) {
    const { abs, rel, size } = files[i];
    const ext = extname(rel).slice(1).toLowerCase();
    const key = rel; // 相对 public 的路径作为 key
    const contentType = CONTENT_TYPE[ext] || 'application/octet-stream';
    try {
      const upload = new Upload({
        client: s3,
        params: {
          Bucket: TOS_BUCKET,
          Key: key,
          Body: createReadStream(abs),
          ContentType: contentType,
          ACL: 'public-read',
        },
      });
      await upload.done();
      ok++;
      const pub = TOS_BASE_URL ? `${TOS_BASE_URL}/${key}` : `(未配 NEXT_PUBLIC_TOS_BASE_URL) ${key}`;
      console.log(`[${i + 1}/${files.length}] OK  ${fmtSize(size).padStart(10)}  ${key}`);
      console.log(`           ${pub}`);
    } catch (e) {
      fail++;
      failed.push({ key, err: e.message });
      console.error(`[${i + 1}/${files.length}] FAIL ${key}: ${e.message}`);
    }
  }

  console.log('');
  console.log(`完成: 成功 ${ok} / 失败 ${fail} / 总计 ${files.length}`);
  if (fail > 0) {
    console.log('失败清单:');
    for (const f of failed) console.log(`  - ${f.key}: ${f.err}`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error('上传异常:', e);
  process.exit(1);
});
