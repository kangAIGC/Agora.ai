/**
 * 静态资源路径工具
 *
 * Next.js 静态导出 + GitHub Pages 子路径部署时，basePath 不会自动应用到
 * 原生 <img src="/...">、<video src="/...">、fetch("/...") 等场景。
 * 此工具统一为绝对路径添加 basePath 前缀，避免 404。
 *
 * 与 next.config.ts 中的 basePath 保持一致。
 */
export const BASE_PATH = "/Agora.ai";

/**
 * 为绝对路径添加 basePath 前缀。
 *
 * - "/" → "/Agora.ai/"
 * - "/mock-arch/Image-3.png" → "/Agora.ai/mock-arch/Image-3.png"
 * - "/Agora.ai/xxx" → "/Agora.ai/xxx"  (已带前缀，原样返回)
 * - "https://..." → 原样返回 (已是完整 URL)
 * - "data:..." → 原样返回 (data URI)
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
  return BASE_PATH + path;
}

export default asset;
