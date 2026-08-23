"use client";

// 静态 import mammoth 浏览器版，确保 Turbopack 把它打包进 chunk
// （dynamic import 在 output: 'export' 模式下可能没被正确处理）
import mammoth from "mammoth/mammoth.browser";

/**
 * 浏览器端 .doc/.docx/HTML 文档预览转换工具
 *
 * 设计原则：
 * 1. 不依赖服务端 Word COM 转换（静态托管模式 / GitHub Pages 无 Node API 可用）
 * 2. 用 mammoth.js 把 OOXML (.docx) 在浏览器端直接解析为 HTML
 * 3. 文件扩展名不可靠（许多 .doc 实际是 OOXML），通过嗅探文件头判定真实格式：
 *    - ZIP (50 4B 03 04) → OOXML (.docx)，mammoth 解析
 *    - OLE2 (D0 CF 11 E0) → 老式二进制 .doc，mammoth 不支持 → 降级提示
 *    - HTML (3C 21 44 4F / 3C 68 74 6D) → 直接作为 HTML 渲染
 *    - %PDF → PDF，调用方直接 iframe
 * 4. 对老式 .doc 给出明确引导：建议下载原文件用本地 Word/WPS 打开
 */

export type DocPreviewResult =
  | { kind: "html"; html: string; warnings?: string[]; sourceType: "ooxml" | "html" | "text" }
  | { kind: "pdf"; url: string }
  | { kind: "unsupported"; reason: string; suggestDownload: true; sourceType: "ooxml" | "ole2" | "unknown" };

const ZIP_MAGIC = [0x50, 0x4b, 0x03, 0x04]; // PK\x03\x04 (OOXML .docx / zip)
const OLE2_MAGIC = [0xd0, 0xcf, 0x11, 0xe0]; // D0 CF 11 E0 (老式 .doc 二进制)
const PDF_MAGIC = [0x25, 0x50, 0x44, 0x46]; // %PDF
const HTML_DOCTYPE = [0x3c, 0x21, 0x44, 0x4f]; // <!DO
const HTML_HTML = [0x3c, 0x68, 0x74, 0x6d]; // <htm
const HTML_BODY = [0x3c, 0x62, 0x6f, 0x64]; // <bod

function matches(buf: Uint8Array, magic: number[]): boolean {
  if (buf.length < magic.length) return false;
  for (let i = 0; i < magic.length; i++) {
    if (buf[i] !== magic[i]) return false;
  }
  return true;
}

function sniff(bytes: Uint8Array): "ooxml" | "ole2" | "pdf" | "html" | "text" | "unknown" {
  if (matches(bytes, ZIP_MAGIC)) return "ooxml";
  if (matches(bytes, OLE2_MAGIC)) return "ole2";
  if (matches(bytes, PDF_MAGIC)) return "pdf";
  if (matches(bytes, HTML_DOCTYPE) || matches(bytes, HTML_HTML) || matches(bytes, HTML_BODY)) return "html";
  // 兜底：尝试以文本方式解码，若开头大量可打印 ASCII/UTF-8 也按文本处理
  let printable = 0;
  const sample = bytes.slice(0, 256);
  for (let i = 0; i < sample.length; i++) {
    const c = sample[i];
    if ((c >= 0x20 && c < 0x7f) || c === 0x09 || c === 0x0a || c === 0x0d) printable++;
  }
  if (sample.length > 0 && printable / sample.length > 0.85) return "text";
  return "unknown";
}

/**
 * 把已下载的 Blob 转换为可在 iframe 中渲染的预览结果。
 * 调用方负责 fetch 拿到 blob 后传入。
 */
export async function convertDocBlobToPreview(
  blob: Blob,
  filename: string,
): Promise<DocPreviewResult> {
  const arrayBuffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  const kind = sniff(bytes);

  if (kind === "pdf") {
    // PDF 直接用 blob URL，调用方 iframe src=blob:...
    const blobWithType = new Blob([arrayBuffer], { type: "application/pdf" });
    return { kind: "pdf", url: URL.createObjectURL(blobWithType) };
  }

  if (kind === "html") {
    const text = new TextDecoder("utf-8").decode(bytes);
    return { kind: "html", html: text, sourceType: "html" };
  }

  if (kind === "text") {
    // 纯文本：包一层 <pre> 渲染，避免被当成 HTML 实体误读
    const text = new TextDecoder("utf-8").decode(bytes);
    const escaped = text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    return {
      kind: "html",
      html: `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;padding:24px;color:#1f2937;line-height:1.7}pre{white-space:pre-wrap;word-break:break-word;font-family:inherit}</style></head><body><pre>${escaped}</pre></body></html>`,
      sourceType: "text",
    };
  }

  if (kind === "ooxml") {
    // mammoth 仅支持 OOXML (.docx)
    try {
      const result = await mammoth.convertToHtml(
        { arrayBuffer: arrayBuffer.slice(0) },
        { styleMap: ["p[style-name='Title'] => h1.doc-title:fresh"] },
      );
      const html = wrapDocxHtml(result.value || "", filename);
      return {
        kind: "html",
        html,
        warnings: result.messages?.map((m: { message: string }) => m.message).slice(0, 5),
        sourceType: "ooxml",
      };
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      return {
        kind: "unsupported",
        reason: `OOXML 文档解析失败：${reason}`,
        suggestDownload: true,
        sourceType: "ooxml",
      };
    }
  }

  // 老式 .doc 二进制（OLE2/CFBF）—— mammoth 不支持
  if (kind === "ole2") {
    return {
      kind: "unsupported",
      reason:
        "该文件为老式 Word 97-2003 二进制格式（.doc），浏览器端无法直接解析。建议下载后用 Word/WPS 打开查看。",
      suggestDownload: true,
      sourceType: "ole2",
    };
  }

  return {
    kind: "unsupported",
    reason: "无法识别的文档格式，建议下载后用本地软件打开。",
    suggestDownload: true,
    sourceType: "unknown",
  };
}

/**
 * 包装 mammoth 输出的 HTML 片段，加上基本样式让预览效果接近 Word
 */
function wrapDocxHtml(fragmentHtml: string, filename: string): string {
  const safeTitle = (filename || "文档预览")
    .replace(/\.docx?$/i, "")
    .replace(/[<>&]/g, "");
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${safeTitle}</title>
<style>
  html,body{margin:0;padding:0;background:#fff;}
  body{
    font-family: "PingFang SC","Microsoft YaHei","Source Han Sans CN", -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
    color:#1f2937;
    line-height:1.75;
    padding:48px 56px;
    max-width:900px;
    margin:0 auto;
    font-size:16px;
  }
  h1,h2,h3,h4{font-weight:600;line-height:1.4;color:#111827;margin:1.4em 0 0.6em;}
  h1{font-size:26px;border-bottom:2px solid #e5e7eb;padding-bottom:8px;}
  h2{font-size:22px;}
  h3{font-size:18px;}
  p{margin:0.8em 0;}
  table{border-collapse:collapse;width:100%;margin:1em 0;font-size:14px;}
  td,th{border:1px solid #d1d5db;padding:6px 10px;text-align:left;vertical-align:top;}
  th{background:#f3f4f6;font-weight:600;}
  img{max-width:100%;height:auto;display:inline-block;}
  ul,ol{padding-left:1.6em;margin:0.6em 0;}
  a{color:#2563eb;text-decoration:underline;}
  /* mammoth 默认把标题样式打 doc-title class */
  .doc-title{font-size:30px;font-weight:700;text-align:center;margin:0 0 24px;color:#111827;}
  /* 段落首行缩进（中文文档常见） */
  body > p:first-of-type{ text-indent: 0; }
</style>
</head>
<body>
${fragmentHtml}
</body>
</html>`;
}
