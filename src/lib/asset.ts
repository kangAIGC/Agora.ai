/**
 * 静态资源路径工具
 *
 * Next.js 静态导出 + GitHub Pages 子路径部署时，basePath 不会自动应用到
 * 原生 <img src="/...">、<video src="/...">、fetch("/...") 等场景。
 * 此工具统一为绝对路径添加 basePath 前缀，避免 404。
 *
 * 与 next.config.ts 中的 basePath 保持一致。
 *
 * TOS 加速：配置了 NEXT_PUBLIC_TOS_BASE_URL 时，本地绝对路径会转为
 * TOS 公开桶 URL（永久有效、无签名），未配置时回退到本地 + basePath。
 */

export const BASE_PATH = "/Agora.ai";

// TOS 公开桶基址（带协议，无尾斜杠）。配置后所有本地绝对路径自动转 TOS URL。
// 例: https://your-bucket.tos-s3-cn-beijing.volces.com
export const TOS_BASE_URL =
  (process.env.NEXT_PUBLIC_TOS_BASE_URL || "").replace(/\/$/, "");

// 只有这些媒体资源类型会上传到 TOS 并走 TOS 加速；
// HTML/doc/JSON 等非媒体文件留在本地 GitHub Pages（basePath），避免 iframe 跨域或未上传导致 404
const TOS_ASSET_RE = /\.(png|jpg|jpeg|gif|webp|mp4|webm|mov)$/i;

/**
 * 为绝对路径添加 basePath 前缀，或在配置 TOS 时转为 TOS 公开桶 URL。
 *
 * - "/" → "/Agora.ai/"
 * - "/mock-arch/Image-3.png" → "/Agora.ai/mock-arch/Image-3.png"  (未配 TOS)
 *                              → "https://TOS/mock-arch/Image-3.png" (配了 TOS)
 * - "https://..." → 原样返回 (已是完整 URL)
 * - "data:..." → 原样返回 (data URI)
 * - "blob:..." → 原样返回 (blob URL)
 * - "" / null / undefined → ""
 * - "relative/path.png" → 原样返回 (相对路径不处理)
 */
export function asset(path: string | null | undefined): string {
  if (!path) return "";
  // 完整 URL（http/https/协议相对）不处理
  if (/^(https?:)?\/\//i.test(path)) return path;
  // data URI 不处理
  if (path.startsWith("data:")) return path;
  // blob URL 不处理
  if (path.startsWith("blob:")) return path;
  // 相对路径不处理
  if (!path.startsWith("/")) return path;
  // 已带 basePath 前缀，避免重复
  if (path === BASE_PATH || path.startsWith(BASE_PATH + "/")) return path;
  // 配置了 TOS 时：图片/视频等已上传 TOS 的媒体资源走 TOS；HTML/doc/JSON 等留本地 basePath
  if (TOS_BASE_URL) {
    if (TOS_ASSET_RE.test(path)) return TOS_BASE_URL + path;
    return BASE_PATH + path;
  }
  return BASE_PATH + path;
}

export default asset;
