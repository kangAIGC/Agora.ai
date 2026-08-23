// @ts-nocheck
"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  FileText,
  Image as ImageIcon,
  MessageSquare,
  Download,
  Bell,
  Settings,
  User,
  Send,
  Upload,
  Code,
  Bot,
  Video,
  Plus,
  Loader2,
  X,
  AlertCircle,
  FileCode,
  Eye,
  Trash2,
  Maximize2,
  FolderOpen,
  PanelRightClose,
  PanelRight,
  Globe,
  RotateCcw,
  History,
  ChevronUp,
  RefreshCw,
  Cloud,
  CloudOff,
  HardDrive,
} from "lucide-react";
import WorkspaceSidebar from "@/components/WorkspaceSidebar";
import InfiniteCanvas, { type CanvasItem } from "@/components/InfiniteCanvas";
import SaveStatusIndicator from "@/components/SaveStatusIndicator";
import { useProject } from "@/lib/project-store";
import type { UploadedFile, GeneratedFile, Message, Mode } from "@/lib/types";
import { migrateFilesByProject, type MigratedFilesByProject } from "@/lib/seed-migration";
import {
  inferSeedKey,
  getSeedProject,
  type SeedProjectKey,
} from "@/lib/canvas-seed";
import { runGlobalAppSeed } from "@/lib/app-seed";
import {
  getMockStream,
  mockUploadFile,
  mockDifyUpload,
} from "@/lib/client-mock";
import { asset } from "@/lib/asset";
import {
  createDebouncedFn,
  safeLocalSet,
  writeVersioned,
  readVersioned,
  getOnlineStatus,
  pushOfflineQueue,
  mockRemoteSyncCall,
  type SaveStatusInfo,
} from "@/lib/sync-engine";

// ============ 类型定义（已移至 lib/types.ts，此处仅保留本地扩展）============

interface ModeConfig {
  label: string;
  placeholder: string;
  apiKey: string;
  command: string;
  icon: typeof FileText;
}

// ============ 常量配置 ============

const MODE_CONFIG: Record<Mode, ModeConfig> = {
  design: {
    label: "AI 设计",
    placeholder: '请输入"生成商品简介"...',
    apiKey: "app-kdwjSWnYogo7fBaTwzelzkb6",
    command: "生成文档",
    icon: FileText,
  },
  image: {
    label: "AI 图像",
    placeholder: '请输入"生成prompt"...',
    apiKey: "app-LLdjWHeYfty3PVOy6WI2HHgZ",
    command: "生成prompt",
    icon: ImageIcon,
  },
  video: {
    label: "AI 视频",
    placeholder: '请输入"生成prompt"...',
    apiKey: "app-69VftMglTvFIh1HxfU3Oxa5b",
    command: "生成prompt",
    icon: Video,
  },
  html: {
    label: "AI 网页",
    placeholder: '请输入"生成网页"...',
    apiKey: "",
    command: "生成网页",
    icon: Code,
  },
};

const MODE_LIST: Mode[] = ["design", "image", "video", "html"];

const WELCOME_MESSAGE =
  "您好，我是 Agora Agent，您的AIGC设计助手，请告诉我您的实际需求。";

// AI 图像模式：风格化 Prompt（中文翻译版）
const IMAGE_STYLE_PROMPT_ZH =
  "坐落于山谷间的景德镇陶瓷文创产业园，沿地形等高线层层跌落的台地式建筑群落，错落穿插的长条体块模拟自然岩层肌理，面向中央溪流方向敞开；暖灰色洞石质感混凝土挂板，深红色页岩毛石基座，深灰色铝合金窗框体系，钴蓝色釉面玻璃作为点缀；建筑整体融入山地沟壑之中，搭配叠水庭院与原生乡土植被，正午时分澄澈碧蓝的晴空；8K 超高清写实渲染，照片级真实材质纹理表现，精准的建筑尺度与比例关系，锐利清晰的建筑边界刻画，无噪点纯净图像输出，精确纹理贴图映射，分明的前景与背景层次，自然柔和的阴影过渡，明亮饱满而又不失真的色彩呈现。";

// AI 图像模式：风格化 Prompt（英文原版）
const IMAGE_STYLE_PROMPT_EN =
  "Jingdezhen ceramic cultural creative industry park nestled in valley, terraced architectural complex cascading along contours, shifted elongated volumes mimicking natural rock strata, open towards central stream, warm gray travertine-like concrete panels, dark red shale stone base, dark gray aluminum frames, cobalt blue glazed glass accents, integrated into a mountainous ravine with cascading water courtyards and native vegetation, clear blue sky at noon, 8K ultra-high resolution rendering, photorealistic material textures, accurate architectural scale and proportion, sharp edge definition, noise-free image output, precise texture mapping, clear foreground-background layering, natural shadow transitions, bright and vibrant yet not oversaturated color presentation";

// ============ Markdown 渲染 ============

function renderInlineMarkdown(text: string): React.ReactNode[] {
  if (!text) return [];

  // 先剥离常见 HTML 标签（<b>, <strong>, <p>, <em>, <span> 等）为纯文本
  // 保留 <br> / <br/> / <br /> 作为换行符标记
  const cleaned = text
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<\/?(?:b|strong|p|em|span|div|font|u|s|i|li|ul|ol|h[1-6])[^>]*>/gi, "");

  // 按 \n 切分为多行，每行独立处理 **加粗** 和 `行内代码`
  const lines = cleaned.split("\n");
  const result: React.ReactNode[] = [];

  for (let li = 0; li < lines.length; li++) {
    const line = lines[li];
    if (li > 0) {
      result.push(<br key={`br-${li}`} />);
    }
    if (!line) continue;

    const parts = line.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
    for (let pi = 0; pi < parts.length; pi++) {
      const part = parts[pi];
      if (!part) continue;
      if (part.startsWith("**") && part.endsWith("**")) {
        result.push(
          <strong key={`s-${li}-${pi}`} className="font-semibold text-white/80">
            {part.slice(2, -2)}
          </strong>
        );
      } else if (part.startsWith("`") && part.endsWith("`")) {
        result.push(
          <code
            key={`c-${li}-${pi}`}
            className="px-1.5 py-0.5 rounded bg-white/10 text-white/80 text-[0.9em] font-mono"
          >
            {part.slice(1, -1)}
          </code>
        );
      } else {
        result.push(<span key={`t-${li}-${pi}`}>{part}</span>);
      }
    }
  }

  return result;
}

// 解析表格行单元格：去除首尾 | 后按 | 分割
function parseTableRow(line: string): string[] {
  let s = line.trim();
  if (s.startsWith("|")) s = s.slice(1);
  if (s.endsWith("|")) s = s.slice(0, -1);
  return s.split("|").map((c) => c.trim());
}

// 判断是否为表格分隔行 | :--- | --- |
function isSeparatorRow(line: string): boolean {
  const s = line.trim();
  if (!s.includes("|")) return false;
  const cells = parseTableRow(s);
  return cells.length > 0 && cells.every((c) => /^:?-+:?$/.test(c));
}

// 判断是否为表格数据行（以 | 开头且以 | 结尾）
function isTableRow(line: string): boolean {
  const s = line.trim();
  return s.startsWith("|") && s.endsWith("|") && s.length > 1;
}

function MarkdownRenderer({ content }: { content: string }) {
  if (!content) return null;
  const lines = content.split("\n");
  const headingClasses: Record<number, string> = {
    1: "text-lg font-bold mt-3 mb-2 text-white/80",
    2: "text-base font-bold mt-3 mb-1 text-white/80",
    3: "text-sm font-bold mt-2 mb-1 text-white/80",
    4: "text-sm font-semibold mt-2 mb-1 text-white/80",
    5: "text-xs font-bold mt-2 mb-1 text-white/70",
    6: "text-xs font-semibold mt-2 mb-1 text-white/70",
  };

  const blocks: React.ReactNode[] = [];
  let i = 0;
  while (i < lines.length) {
    const trimmed = lines[i].trim();

    // 空行
    if (!trimmed) {
      blocks.push(<div key={`sp-${i}`} className="h-2" />);
      i++;
      continue;
    }

    // 纯 URL 行过滤：整行只是 URL（无其他文字）则跳过不渲染
    // 文件 URL 已由后端提取并下载到右侧「生成文件」区域
    if (/^https?:\/\/\S+$/i.test(trimmed)) {
      i++;
      continue;
    }

    // JSON 文件 URL 片段过滤：如 {"url": "..."} 或 {"file_url": "..."}
    const trimLower = trimmed.toLowerCase();
    if (trimLower.startsWith('{"url":') || trimLower.startsWith('{"file_url":') || trimLower.startsWith('"url":') || trimLower.startsWith('"file_url":')) {
      i++;
      continue;
    }

    // 表格：当前行为表格行，且下一行为分隔行
    if (
      isTableRow(trimmed) &&
      i + 1 < lines.length &&
      isSeparatorRow(lines[i + 1])
    ) {
      const headerCells = parseTableRow(trimmed);
      const bodyRows: string[][] = [];
      i += 2; // 跳过表头与分隔行
      while (i < lines.length && isTableRow(lines[i])) {
        bodyRows.push(parseTableRow(lines[i]));
        i++;
      }
      blocks.push(
        <div
          key={`tbl-${i}`}
          className="my-3 table-scroll overflow-x-auto rounded-lg border border-white/15 relative"
        >
          <table className="w-full border-collapse text-sm min-w-max">
            <thead>
              <tr className="bg-white/10 border-b border-white/20">
                {headerCells.map((cell, ci) => (
                  <th
                    key={ci}
                    className="px-3 py-2 text-left font-bold text-white/80 break-words max-w-[200px]"
                  >
                    {renderInlineMarkdown(cell)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bodyRows.map((row, ri) => (
                <tr
                  key={ri}
                  className="border-b border-white/10 last:border-b-0 hover:bg-white/5 transition-colors"
                >
                  {headerCells.map((_, ci) => (
                    <td
                      key={ci}
                      className="px-3 py-2 text-white/80 align-top break-words overflow-wrap-break-word max-w-[300px]"
                    >
                      {renderInlineMarkdown(row[ci] || "")}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {/* 右侧渐变遮罩，暗示可横向滚动 */}
          <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-6 bg-gradient-to-l from-black/30 to-transparent rounded-r-lg" />
        </div>
      );
      continue;
    }

    // 标题
    const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      blocks.push(
        <p key={`h-${i}`} className={headingClasses[level]}>
          {renderInlineMarkdown(headingMatch[2])}
        </p>
      );
      i++;
      continue;
    }

    // 无序列表
    if (/^[-*]\s+/.test(trimmed)) {
      blocks.push(
        <div key={`ul-${i}`} className="flex gap-2 ml-2">
          <span className="text-white/60">•</span>
          <span className="text-sm flex-1">
            {renderInlineMarkdown(trimmed.replace(/^[-*]\s+/, ""))}
          </span>
        </div>
      );
      i++;
      continue;
    }

    // 有序列表
    const numMatch = trimmed.match(/^(\d+)\.\s+(.+)$/);
    if (numMatch) {
      blocks.push(
        <div key={`ol-${i}`} className="flex gap-2 ml-2">
          <span className="text-white/60">{numMatch[1]}.</span>
          <span className="text-sm flex-1">
            {renderInlineMarkdown(numMatch[2])}
          </span>
        </div>
      );
      i++;
      continue;
    }

    // 普通段落
    blocks.push(
      <p key={`p-${i}`} className="text-sm leading-relaxed">
        {renderInlineMarkdown(trimmed)}
      </p>
    );
    i++;
  }

  return <div className="space-y-1">{blocks}</div>;
}

// ============ 图片预览模态框 ============

interface PreviewImageModalProps {
  previewImageUrl: string;
  name: string;
  onClose: () => void;
}

function PreviewImageModal({ previewImageUrl, name, onClose }: PreviewImageModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-8"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-4xl h-[80vh] bg-[#1a1a1a] rounded-xl shadow-2xl border border-white/15 flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 顶部工具栏 */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/10 bg-white/5 flex-shrink-0">
          <p className="text-sm text-white/70 truncate flex-1 mr-3">{name || "图片预览"}</p>
          <div className="flex items-center gap-1">
            <a
              href={previewImageUrl}
              download
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg hover:bg-white/10 text-white/70 hover:text-white text-xs transition-colors"
              title="下载图片"
            >
              <Download className="w-3.5 h-3.5" />
              <span>下载</span>
            </a>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-white/10 text-white/70 hover:text-white transition-colors"
              title="关闭"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
        {/* 图片预览区 */}
        <div className="flex-1 min-h-0 bg-black/60 flex items-center justify-center p-4 relative overflow-hidden">
          <img
            src={asset(previewImageUrl)}
            alt="预览"
            className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
          />
        </div>
      </div>
    </div>
  );
}

interface PreviewImageModalLayerProps {
  previewImageUrl: string | null;
  name: string;
  onClose: () => void;
}

function PreviewImageModalLayer({ previewImageUrl, name, onClose }: PreviewImageModalLayerProps) {
  if (!previewImageUrl) return null;
  return (
    <PreviewImageModal previewImageUrl={previewImageUrl} name={name} onClose={onClose} />
  );
}

// ============ 视频预览模态框（浮动卡片）============

interface PreviewVideoModalProps {
  url: string;
  name: string;
  onClose: () => void;
}

function PreviewVideoModal({ url, name, onClose }: PreviewVideoModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-8"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-4xl h-[80vh] bg-[#1a1a1a] rounded-xl shadow-2xl border border-white/15 flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 顶部工具栏 */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/10 bg-white/5 flex-shrink-0">
          <p className="text-sm text-white/70 truncate flex-1 mr-3">{name || "视频预览"}</p>
          <div className="flex items-center gap-1">
            <a
              href={url}
              download
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg hover:bg-white/10 text-white/70 hover:text-white text-xs transition-colors"
              title="下载视频"
            >
              <Download className="w-3.5 h-3.5" />
              <span>下载</span>
            </a>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-white/10 text-white/70 hover:text-white transition-colors"
              title="关闭"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
        {/* 视频预览区 */}
        <div className="flex-1 min-h-0 bg-black flex items-center justify-center p-4">
          <video
            src={asset(url)}
            controls
            autoPlay
            className="max-w-full max-h-full object-contain rounded-lg shadow-2xl bg-black"
          />
        </div>
      </div>
    </div>
  );
}

interface PreviewVideoModalLayerProps {
  url: string | null;
  name: string;
  onClose: () => void;
}

function PreviewVideoModalLayer({ url, name, onClose }: PreviewVideoModalLayerProps) {
  if (!url) return null;
  return <PreviewVideoModal url={url} name={name} onClose={onClose} />;
}

// ============ HTML 网页预览模态框 ============

interface PreviewHtmlModalProps {
  url: string;
  onClose: () => void;
}

function PreviewHtmlModal({ url, onClose }: PreviewHtmlModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-8"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-5xl h-[85vh] bg-[#1a1a1a] rounded-xl shadow-2xl border border-white/15 flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 顶部工具栏 */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/10 bg-white/5 flex-shrink-0">
          <p className="text-sm text-white/70 truncate flex-1 mr-3">网页预览</p>
          <div className="flex items-center gap-1">
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg hover:bg-white/10 text-white/70 hover:text-white text-xs transition-colors"
              title="在新标签页打开"
            >
              <Maximize2 className="w-3.5 h-3.5" />
              <span>新标签打开</span>
            </a>
            <a
              href={url}
              download
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg hover:bg-white/10 text-white/70 hover:text-white text-xs transition-colors"
              title="下载网页"
            >
              <Download className="w-3.5 h-3.5" />
              <span>下载</span>
            </a>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-white/10 text-white/70 hover:text-white transition-colors"
              title="关闭"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
        {/* 网页预览区 */}
        <div className="flex-1 min-h-0 bg-white">
          <iframe
            src={asset(url)}
            title="网页预览"
            className="w-full h-full border-0 bg-white"
          />
        </div>
      </div>
    </div>
  );
}

interface PreviewHtmlModalLayerProps {
  url: string | null;
  onClose: () => void;
}

function PreviewHtmlModalLayer({ url, onClose }: PreviewHtmlModalLayerProps) {
  if (!url) return null;
  return <PreviewHtmlModal url={url} onClose={onClose} />;
}

// ============ 文档预览模态框（doc/docx 等无法直接渲染的文件）============

interface PreviewDocModalProps {
  url: string;
  name: string;
  onClose: () => void;
  onDownload: () => void;
}

function PreviewDocModal({ url, name, onClose, onDownload }: PreviewDocModalProps) {
  // 判断文件类型
  const lowerName = name.toLowerCase();
  const isDocFile = lowerName.endsWith(".doc") || lowerName.endsWith(".docx");
  const isPdfFile = lowerName.endsWith(".pdf");

  // 状态：loading / ready / error
  const [renderHtml, setRenderHtml] = useState<string | null>(null);
  const [renderPdfUrl, setRenderPdfUrl] = useState<string | null>(null);
  const [convertError, setConvertError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // 对 doc/docx 文件统一在浏览器端用 mammoth 转 HTML（OOXML）或直接渲染（HTML/PDF）
  useEffect(() => {
    if (!isDocFile) return;
    let revoked = false;

    (async () => {
      setIsLoading(true);
      try {
        // 获取文件内容（blob URL 和静态 URL 都可以用 fetch）
        const resp = await fetch(asset(url));
        if (!resp.ok) throw new Error(`文件获取失败 (${resp.status})`);
        const blob = await resp.blob();

        const { convertDocBlobToPreview } = await import("@/lib/doc-preview");
        const result = await convertDocBlobToPreview(blob, name);
        if (revoked) return;

        if (result.kind === "html") {
          setRenderHtml(result.html);
        } else if (result.kind === "pdf") {
          setRenderPdfUrl(result.url);
        } else {
          setConvertError(result.reason);
        }
      } catch (err) {
        if (!revoked) {
          setConvertError(err instanceof Error ? err.message : "解析失败");
        }
      } finally {
        if (!revoked) setIsLoading(false);
      }
    })();

    return () => {
      revoked = true;
    };
  }, [isDocFile, url, name]);

  // 卸载时释放 blob URL
  useEffect(() => {
    return () => {
      if (renderPdfUrl) URL.revokeObjectURL(renderPdfUrl);
    };
  }, [renderPdfUrl]);

  // 最终用于 iframe 的 PDF URL（仅对 PDF 文件 / 嗅探出 PDF 的情况适用）
  const finalPdfUrl = isPdfFile ? url : renderPdfUrl;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-8"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-4xl h-[80vh] bg-[#1a1a1a] rounded-xl shadow-2xl border border-white/15 flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 顶部工具栏 */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/10 bg-white/5 flex-shrink-0">
          <p className="text-sm text-white/70 truncate flex-1 mr-3">{name}</p>
          <div className="flex items-center gap-1">
            <a
              href={url}
              download
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg hover:bg-white/10 text-white/70 hover:text-white text-xs transition-colors"
              title="下载原文件"
            >
              <Download className="w-3.5 h-3.5" />
              <span>下载</span>
            </a>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-white/10 text-white/70 hover:text-white transition-colors"
              title="关闭"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
        {/* 预览区 */}
        <div className="flex-1 min-h-0 bg-white relative">
          {isLoading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white/60">
              <Loader2 className="w-8 h-8 animate-spin text-white/40" />
              <p className="text-sm">正在解析文档...</p>
            </div>
          )}
          {convertError && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white/60 p-8 text-center">
              <FileText className="w-12 h-12 text-white/20" />
              <p className="text-sm text-red-400 max-w-md">预览失败：{convertError}</p>
              <p className="text-xs text-white/40">请使用上方"下载"按钮下载原文件，用本地 Word/WPS 打开查看</p>
            </div>
          )}
          {renderHtml && !isLoading && !convertError && (
            <iframe
              srcDoc={renderHtml}
              title="文档预览"
              className="w-full h-full border-0 bg-white"
              sandbox="allow-same-origin"
            />
          )}
          {finalPdfUrl && !isLoading && !convertError && (
            <iframe
              src={asset(finalPdfUrl)}
              title="文档预览"
              className="w-full h-full border-0"
            />
          )}
        </div>
      </div>
    </div>
  );
}

interface PreviewDocModalLayerProps {
  url: string | null;
  name: string;
  onClose: () => void;
  onDownload: () => void;
}

function PreviewDocModalLayer({ url, name, onClose, onDownload }: PreviewDocModalLayerProps) {
  if (!url) return null;
  return <PreviewDocModal url={url} name={name} onClose={onClose} onDownload={onDownload} />;
}

// ============ 文件图标辅助 ============

function getFileIconStyle(type: string) {
  switch (type) {
    case "doc":
      return {
        bg: "bg-blue-500/20",
        icon: <FileText className="w-5 h-5 text-blue-400" />,
        label: "文档文件",
      };
    case "image":
      return {
        bg: "bg-green-500/20",
        icon: <ImageIcon className="w-5 h-5 text-green-400" />,
        label: "图片文件",
      };
    case "video":
      return {
        bg: "bg-purple-500/20",
        icon: <Video className="w-5 h-5 text-purple-400" />,
        label: "视频文件",
      };
    case "html":
      return {
        bg: "bg-orange-500/20",
        icon: <FileCode className="w-5 h-5 text-orange-400" />,
        label: "网页文件",
      };
    default:
      return {
        bg: "bg-gray-500/20",
        icon: <FileText className="w-5 h-5 text-gray-400" />,
        label: "文件",
      };
  }
}

// ============ 主组件 ============

function ChatPageInner() {
  const projectCtx = useProject();
  const {
    projects,
    currentProject,
    currentProjectId,
    switchProject,
    createProject,
    renameProject,
    deleteProject,
    addConversation,
    switchConversation,
    deleteConversation,
    setMessages: setProjectMessages,
    exportData: exportProjectData,
    importData: importProjectData,
    listProjectSnapshots,
    restoreProjectSnapshot,
    syncToServer,
  } = projectCtx;

  // 组件挂载时触发全局 seed（幂等），保证任何浏览器首次打开都能获得一致的展示数据
  useEffect(() => {
    runGlobalAppSeed();
  }, []);

  // ============ URL 参数 ?project=xxx → 自动切换到指定项目 ============
  // 用于首页聊天框点击和导航栏"工作台"按钮统一跳转到"空白项目"（proj-pinned-blank）
  // ⚠️ 修复：URL 参数仅在首次加载时消费一次，成功后立即清除 URL 中的 project 参数
  //   避免后续用户手动切换项目时，因 currentProjectId 变化触发 useEffect 再次切回 URL 指定项目
  const searchParams = useSearchParams();
  const router = useRouter();
  const urlProjectId = searchParams.get("project");
  const urlParamConsumedRef = useRef(false);
  useEffect(() => {
    // 仅在 URL 存在 project 参数且尚未被消费时执行
    if (!urlProjectId || urlParamConsumedRef.current) return;
    // 等待 projects 加载完毕
    if (!projects || projects.length === 0) return;
    const exists = projects.some((p) => p.id === urlProjectId);
    if (!exists) {
      urlParamConsumedRef.current = true;
      return;
    }
    // 如果当前已是目标项目，也标记为已消费并清除参数（防止后续死循环）
    if (currentProjectId === urlProjectId) {
      urlParamConsumedRef.current = true;
      try {
        const newUrl = new URL(window.location.href);
        newUrl.searchParams.delete("project");
        router.replace(newUrl.pathname + newUrl.search, { scroll: false });
      } catch { /* ignore */ }
      return;
    }
    // 标记消费并切换
    urlParamConsumedRef.current = true;
    switchProject(urlProjectId);
    // 切换后清除 URL 中的 project 参数，使用 replace 不产生历史记录
    // 放在 setTimeout 以等待 currentProjectId 同步后再清参
    setTimeout(() => {
      try {
        const newUrl = new URL(window.location.href);
        newUrl.searchParams.delete("project");
        router.replace(newUrl.pathname + newUrl.search, { scroll: false });
      } catch { /* ignore */ }
    }, 0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlProjectId, projects]);

  const activeConv = currentProject?.conversations.find(
    (c) => c.id === currentProject?.activeConversationId,
  );
  const [messages, setMessagesState] = useState<Message[]>(() => {
    // ⚠️ 修复：懒初始化不做任何 project-store 读取，避免 SSR/HMR/StrictMode
    // 首次渲染时捕获到陈旧/undefined 的 currentProject 导致与后续 effect 同步冲突。
    // 所有消息的初始化/切换统一由下方"项目/对话切换同步" effect 负责，
    // 该 effect 保证首次挂载（lastSyncRef.current===null）时一定执行同步。
    return [];
  });
  const [input, setInput] = useState("");
  const [selectedMode, setSelectedMode] = useState<Mode | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const conversations = currentProject?.conversations || [];
  const activeConversation = currentProject?.activeConversationId || "";
  const effectiveProjectId = currentProjectId || currentProject?.id || null;

  // ——— 对话消息保存状态（仅用于 UI 提示，实际持久化通过 project-store 同步写入）———
  const [chatSaveStatus, setChatSaveStatus] = useState<SaveStatusInfo>({ status: "saved" });

  const setMessages = useCallback(
    (updater: Message[] | ((prev: Message[]) => Message[])) => {
      setMessagesState((prev) => {
        const next = typeof updater === "function" ? (updater as (p: Message[]) => Message[])(prev) : updater;
        return next;
      });
      // —— 手动保存模式：仅标记 dirty，不再自动调用 setProjectMessages / 写盘 ——
      //    用户点击"保存"按钮时才通过 handleManualSave 统一持久化
      if (effectiveProjectId && activeConv) {
        setChatSaveStatus({ status: "dirty" });
      }
    },
    [effectiveProjectId, activeConv],
  );
  // ============ 按项目隔离的文件/画布状态 ============
  // 每个项目独立维护自己的生成文件、上传文件、画布内容，切换项目时自动恢复
  const STORAGE_KEY = "aga-files-by-project";

  // ——— 功能增强：分页加载 / 自动保存 / 版本 / 同步 常量 ———
  const PAGE_SIZE = 50;                 // 对话分页：每次加载50条
  const SYNC_DEBOUNCE_MS = 300;         // 画布防抖保存：≤300ms满足响应要求
  const FILES_VERSION_KEY = "aga-files-version";  // 画布版本号存储前缀

  // ——— 画布保存状态指示器（已保存/变更中/同步中/离线/冲突/错误）———
  const [canvasSaveStatus, setCanvasSaveStatus] = useState<SaveStatusInfo>({ status: "saved" });
  const canvasVersionByProject = useRef<Record<string, number>>({});
  const canvasLastUpdatedByProject = useRef<Record<string, string | undefined>>({});

  // ——— 对话分页：当前可见消息条数，加载更多时递增 PAGE_SIZE
  const [visibleMessageCount, setVisibleMessageCount] = useState<number>(PAGE_SIZE);
  const hasMoreOlderMessagesRef = useRef(false);

  // 序列化 filesByProject → 存储结构
  const serializeFiles = (
    val: { generated: GeneratedFile[]; text: UploadedFile[]; image: UploadedFile[]; canvas: CanvasItem[] },
  ) => ({
    generated: val.generated,
    text: val.text.map(toStored),
    image: val.image.map(toStored),
    canvas: val.canvas,
  });

  /**
   * 同步保存当前 filesByProject 到 localStorage，并推进版本号
   * （LWW 冲突解决：若 localStorage 中已有更新版本，则合并保留）
   * 同时异步推送远程同步占位，失败则入离线队列
   */
  const persistFilesSync = useCallback(
    (next: Record<string, { generated: GeneratedFile[]; text: UploadedFile[]; image: UploadedFile[]; canvas: CanvasItem[] }>) => {
      if (typeof window === "undefined") return;
      setCanvasSaveStatus((s) => ({ ...s, status: "saving" }));
      try {
        // 1) 构造存储负载
        const toStore: Record<string, { generated: GeneratedFile[]; text: StoredUploadedFile[]; image: StoredUploadedFile[]; canvas: CanvasItem[] }> = {};
        for (const [pid, val] of Object.entries(next)) {
          toStore[pid] = serializeFiles(val);
          // 2) 按项目独立版本号 + LWW 写
          const curVersion = canvasVersionByProject.current[pid] || 0;
          const prevUpdated = canvasLastUpdatedByProject.current[pid];
          const perProjectKey = `${FILES_VERSION_KEY}-${pid}`;
          const { envelope, mergedFromRemote } = writeVersioned(perProjectKey, toStore[pid], curVersion, prevUpdated);
          canvasVersionByProject.current[pid] = envelope.version;
          canvasLastUpdatedByProject.current[pid] = envelope.updatedAt;
          if (mergedFromRemote) {
            toStore[pid] = envelope.data as (typeof toStore)[string];
          }
        }
        const main = safeLocalSet(STORAGE_KEY, JSON.stringify(toStore));
        if (!main.ok) {
          setCanvasSaveStatus({ status: "error", message: main.error || "本地存储失败" });
          toast.error("画布保存失败：" + (main.error || "存储空间不足"));
          return;
        }

        // 3) 本地 OK → 更新指示器；异步推送远程占位（失败入离线队列）
        const savedAt = new Date();
        setCanvasSaveStatus({ status: "saved", lastSavedAt: savedAt });
        if (getOnlineStatus() === "online") {
          // 并发：fire-and-forget，不阻塞 UI
          Promise.resolve().then(async () => {
            try {
              const projectIds = Object.keys(next);
              for (const pid of projectIds.slice(0, 1)) {
                const ok = await mockRemoteSyncCall("/api/sync/canvas", {
                  projectId: pid,
                  version: canvasVersionByProject.current[pid],
                  updatedAt: canvasLastUpdatedByProject.current[pid],
                });
                if (!ok) {
                  pushOfflineQueue({ endpoint: "/api/sync/canvas", payload: { projectId: pid, version: canvasVersionByProject.current[pid] } });
                }
              }
            } catch {
              // 远程失败：已经在 sync-engine 内部进入离线队列或稍后重试
            }
          });
        } else {
          // 离线 → 标记队列
          for (const pid of Object.keys(next).slice(0, 1)) {
            pushOfflineQueue({ endpoint: "/api/sync/canvas", payload: { projectId: pid } });
          }
        }
      } catch (e) {
        setCanvasSaveStatus({ status: "error", message: e instanceof Error ? e.message : "未知错误" });
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // 防抖的 persistFilesSync —— 满足拖拽节点 300ms 内不重复写盘的要求
  const debouncedPersist = useRef(
    createDebouncedFn(
      (next: Parameters<typeof persistFilesSync>[0]) => persistFilesSync(next),
      SYNC_DEBOUNCE_MS,
    ),
  );

  // 在刷新/关闭前强制 flush 防抖，防止最后一次（<300ms）的修改丢失
  useEffect(() => {
    const handler = () => { try { debouncedPersist.current.flush(); } catch { /* ignore */ } };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  // ——— 脏标记：当前是否有未保存的更改（用于项目切换/关闭页面前提示）———
  // ⚠️ 定义位置：必须在 canvasSaveStatus / chatSaveStatus / debouncedPersist 之后
  const hasUnsavedChanges =
    canvasSaveStatus.status === "dirty" || canvasSaveStatus.status === "saving" ||
    chatSaveStatus.status === "dirty" || chatSaveStatus.status === "saving";

  // ============ 刷新/关闭页面安全提示（beforeunload） ============
  // - AI 正在流式响应（isLoading）
  // - 或存在未保存的更改（hasUnsavedChanges）
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = (e: BeforeUnloadEvent) => {
      // 先 flush 防抖队列，避免最后 300ms 的改动因关闭页面丢失
      try { debouncedPersist.current.flush(); } catch { /* ignore */ }
      let needBlock = false;
      let reason = "";
      if (isLoading) {
        needBlock = true;
        reason = "当前有 AI 响应正在生成中，离开/刷新后会中断当前轮对话。";
      } else if (hasUnsavedChanges) {
        needBlock = true;
        reason = "当前有未保存的画布节点或对话更改，请先点击「保存」按钮再离开。";
      }
      if (needBlock) {
        e.preventDefault();
        e.returnValue = reason + " 确定要离开吗？";
        return e.returnValue;
      }
      return undefined;
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isLoading, hasUnsavedChanges]);

  // 可序列化的上传文件（不含 File 对象）
  type StoredUploadedFile = {
    id: string;
    name: string;
    dify_file_id?: string;
    uploadedAt: string; // ISO string instead of Date
    status: "uploading" | "success" | "error";
    previewUrl?: string;
  };

  // UploadedFile → StoredUploadedFile（去掉 File 对象）
  const toStored = (f: UploadedFile): StoredUploadedFile => ({
    id: f.id,
    name: f.name,
    dify_file_id: f.dify_file_id,
    uploadedAt: f.uploadedAt instanceof Date ? f.uploadedAt.toISOString() : String(f.uploadedAt),
    status: f.status,
    previewUrl: f.previewUrl,
  });

  // StoredUploadedFile → UploadedFile（重建，无真实 File 对象）
  const fromStored = (f: StoredUploadedFile): UploadedFile => {
    const stubBlob = new Blob();
    const stubFile = new File([stubBlob], f.name);
    return {
      id: f.id,
      file: stubFile,
      name: f.name,
      dify_file_id: f.dify_file_id,
      uploadedAt: new Date(f.uploadedAt),
      status: f.status,
      previewUrl: f.previewUrl,
    };
  };

  // ⚠️ SSR/CSR 初始值统一返回 {} 避免 hydration 不匹配
  //    localStorage 数据在下方 useEffect 中恢复
  const [filesByProject, setFilesByProject] = useState<
    Record<string, { generated: GeneratedFile[]; text: UploadedFile[]; image: UploadedFile[]; canvas: CanvasItem[] }>
  >({});

  // 画布 / files 持久化（增强版）
  // — 初始化阶段：根据 versioned envelope 恢复版本号到内存（用于后续写操作的 LWW）
  // — 兜底阶段：任何 filesByProject 改变都触发 dirty + 防抖保存（兼容直接 setFilesByProject 的路径）
  useEffect(() => {
    if (typeof window === "undefined") return;
    // 首次挂载：回填每个项目的版本号
    if (Object.keys(canvasVersionByProject.current).length === 0) {
      for (const pid of Object.keys(filesByProject)) {
        const perProjectKey = `${FILES_VERSION_KEY}-${pid}`;
        const info = readVersioned<unknown>(perProjectKey, 0);
        if (info.envelope) {
          canvasVersionByProject.current[pid] = info.envelope.version;
          canvasLastUpdatedByProject.current[pid] = info.envelope.updatedAt;
        }
      }
    }
    // —— 手动保存模式：取消 filesByProject 变化时的自动写盘，仅用于首次挂载的版本号回填 ——
    //    任何画布/文件改动均通过 updateProjectFiles 标记 dirty，用户点击保存后才写盘
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filesByProject]);

  // ============ 从 localStorage 恢复 filesByProject（CSR only） ============
  // SSR/CSR 初始值均为 {} 避免 hydration 不匹配；客户端挂载后从 localStorage 恢复
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return;
      const parsedRaw = JSON.parse(stored, (key, value) => {
        if (key === "timestamp" && typeof value === "string") {
          const d = new Date(value);
          if (!isNaN(d.getTime())) return d;
        }
        return value;
      }) as MigratedFilesByProject;
      // 迁移：把旧示例项目残留的 /uploads/<uuid>.ext 修复为静态 mock 路径
      const parsed = (migrateFilesByProject(parsedRaw) ?? parsedRaw) as Record<
        string,
        { generated: GeneratedFile[]; text?: StoredUploadedFile[]; image?: StoredUploadedFile[]; canvas: CanvasItem[] }
      >;
      const result: Record<string, { generated: GeneratedFile[]; text: UploadedFile[]; image: UploadedFile[]; canvas: CanvasItem[] }> = {};
      for (const [pid, val] of Object.entries(parsed)) {
        result[pid] = {
          generated: val.generated || [],
          text: (val.text || []).map(fromStored),
          image: (val.image || []).map(fromStored),
          canvas: (val.canvas || []).map((item) => {
            if (item.type === "file" && item.width < 250) {
              return { ...item, width: 260, height: 200 };
            }
            return item;
          }),
        };
        // Fix manju project image layout: 3x3 grid
        if (result[pid].canvas.length > 0) {
          const images = result[pid].canvas.filter(
            (i) => i.type === "image" && ["苏挽", "萧珩", "玄青上人", "诛仙台", "青云大殿", "灭门旧夜", "墨玉牌", "墨断剑红绳", "半块碎玉"].some((n) => i.meta?.name?.includes(n))
          );
          if (images.length === 9) {
            const docs = result[pid].canvas.filter(
              (i) => i.type === "file" && ["人物", "场景", "道具"].some((n) => i.meta?.name?.includes(n))
            );
            if (docs.length === 3) {
              const renDoc = docs.find((d) => d.meta?.name?.includes("人物"));
              const changDoc = docs.find((d) => d.meta?.name?.includes("场景"));
              const daoDoc = docs.find((d) => d.meta?.name?.includes("道具"));
              const IMG_W = 300, IMG_H = 225, H_GAP = 40, V_GAP = 60;
              const maxDocRight = Math.max(...docs.map((d) => d.x + d.width));
              const gridStartX = maxDocRight + 120;
              const gridTopY = Math.min(...docs.map((d) => d.y));
              const nameMap: Record<string, { row: number; col: number; docId: string }> = {
                "苏挽": { row: 0, col: 0, docId: renDoc!.id },
                "萧珩": { row: 0, col: 1, docId: renDoc!.id },
                "玄青上人": { row: 0, col: 2, docId: renDoc!.id },
                "诛仙台": { row: 1, col: 0, docId: changDoc!.id },
                "青云大殿": { row: 1, col: 1, docId: changDoc!.id },
                "灭门旧夜": { row: 1, col: 2, docId: changDoc!.id },
                "墨玉牌": { row: 2, col: 0, docId: daoDoc!.id },
                "墨断剑红绳": { row: 2, col: 1, docId: daoDoc!.id },
                "半块碎玉": { row: 2, col: 2, docId: daoDoc!.id },
              };
              for (const img of images) {
                const info = Object.entries(nameMap).find(([n]) => img.meta?.name?.includes(n));
                if (info) {
                  const [, pos] = info;
                  img.x = gridStartX + pos.col * (IMG_W + H_GAP);
                  img.y = gridTopY + pos.row * (IMG_H + V_GAP);
                  img.width = IMG_W;
                  img.height = IMG_H;
                  img.connectionFrom = pos.docId;
                  img.connectionColors = ["#a78bfa"];
                }
              }
            }
          }
        }
      }
      setFilesByProject(result);
    } catch {
      /* ignore */
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 备份当前画布工作流状态（节点配置、连接关系、属性设置、布局信息）
  // 在组件挂载后立即执行，将当前项目的画布数据快照保存到独立备份键
  const BACKUP_KEY = "aga-canvas-workflow-backup";
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const allData = JSON.parse(raw) as Record<string, { canvas?: CanvasItem[] }>;
      const backup: Record<string, { canvas: CanvasItem[]; savedAt: string; projectName?: string }> = {};
      // 从项目列表中获取项目名称
      const projectsRaw = localStorage.getItem("aga-projects-data");
      const projectNames: Record<string, string> = {};
      if (projectsRaw) {
        const parsed = JSON.parse(projectsRaw);
        if (Array.isArray(parsed)) {
          for (const p of parsed) {
            if (p.id) projectNames[p.id] = p.name;
          }
        }
      }
      for (const [pid, val] of Object.entries(allData)) {
        if (val.canvas && val.canvas.length > 0) {
          backup[pid] = {
            canvas: val.canvas,
            savedAt: new Date().toISOString(),
            projectName: projectNames[pid],
          };
        }
      }
      localStorage.setItem(BACKUP_KEY, JSON.stringify(backup));
    } catch {
      /* 备份失败不阻塞主流程 */
    }
  }, [filesByProject]);

  // 确保 filesByProject 中所有项目都有对应条目（新项目创建时自动初始化）
  // 对能匹配到预设种子的默认项目，首次创建条目时用种子工作流填充（确保任何浏览器打开都有完整内容）
  useEffect(() => {
    if (projects.length === 0) return;
    let needsUpdate = false;
    setFilesByProject((prev) => {
      const next = { ...prev };
      for (const project of projects) {
        if (!next[project.id]) {
          const seedKey = inferSeedKey(project.name, project.id);
          if (seedKey) {
            const seed = getSeedProject(seedKey);
            // 从种子重建 UploadedFile 结构（复用 fromStored 工具）
            next[project.id] = {
              generated: seed.generated,
              text: seed.text.map((t) =>
                fromStored({
                  id: t.id,
                  name: t.name,
                  uploadedAt: new Date().toISOString(),
                  status: "success",
                }),
              ),
              image: seed.image.map((t) =>
                fromStored({
                  id: t.id,
                  name: t.name,
                  uploadedAt: new Date().toISOString(),
                  status: "success",
                  previewUrl: t.previewUrl,
                }),
              ),
              canvas: seed.canvas,
            };
          } else {
            next[project.id] = { generated: [], text: [], image: [], canvas: [] };
          }
          needsUpdate = true;
        }
      }
      // 清理已删除项目的数据
      const validIds = new Set(projects.map((p) => p.id));
      for (const key of Object.keys(next)) {
        if (!validIds.has(key)) {
          delete next[key];
          needsUpdate = true;
        }
      }
      return needsUpdate ? next : prev;
    });
  }, [projects]);

  // 确保当前项目在 filesByProject 中有初始化条目
  useEffect(() => {
    if (!effectiveProjectId) return;
    setFilesByProject((prev) => {
      if (prev[effectiveProjectId]) return prev;
      return {
        ...prev,
        [effectiveProjectId]: { generated: [], text: [], image: [], canvas: [] },
      };
    });
  }, [effectiveProjectId]);

  /**
   * 监听 ProjectProvider 派发的"服务端状态还原"事件
   * 当跨浏览器/设备首次加载并从服务端拉取到完整工作台状态后，
   * ProjectProvider 会将 filesByProject 写入 localStorage 并派发此事件
   * 这里需要重新从 localStorage 读取以更新本地 state，确保画布内容与服务端一致
   */
  useEffect(() => {
    const handler = () => {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (!stored) return;
        const parsedRaw = JSON.parse(stored, (k: string, value: unknown) => {
          if (k === "timestamp" && typeof value === "string") {
            const d = new Date(value);
            if (!isNaN(d.getTime())) return d;
          }
          return value;
        }) as MigratedFilesByProject;
        const migrated = (migrateFilesByProject(parsedRaw) ?? parsedRaw) as Record<string, { generated: GeneratedFile[]; text?: StoredUploadedFile[]; image?: StoredUploadedFile[]; canvas: CanvasItem[] }>;
        const result: Record<string, { generated: GeneratedFile[]; text: UploadedFile[]; image: UploadedFile[]; canvas: CanvasItem[] }> = {};
        for (const [pid, val] of Object.entries(migrated)) {
          result[pid] = {
            generated: val.generated || [],
            text: (val.text || []).map(fromStored),
            image: (val.image || []).map(fromStored),
            canvas: Array.isArray(val.canvas) ? val.canvas : [],
          };
        }
        setFilesByProject(result);
      } catch { /* ignore */ }
    };
    window.addEventListener("aga-workspace-restored", handler);
    return () => window.removeEventListener("aga-workspace-restored", handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const currentProjectFiles = effectiveProjectId ? filesByProject[effectiveProjectId] : undefined;

  // 派生当前项目的文件列表（无数据时返回空数组）
  const generatedFiles = currentProjectFiles?.generated ?? [];
  const textFiles = currentProjectFiles?.text ?? [];
  const imageFiles = currentProjectFiles?.image ?? [];
  const canvasItems = currentProjectFiles?.canvas ?? [];

  // 更新当前项目的某个文件分片
  // 手动保存模式：变更时只标记 dirty（指示器立即变化）
  // 真正的写盘完全由用户点击「保存项目」按钮触发 → handleManualSave
  const updateProjectFiles = useCallback(
    (
      key: "generated" | "text" | "image" | "canvas",
      updater: (prev: GeneratedFile[] | UploadedFile[] | CanvasItem[]) => GeneratedFile[] | UploadedFile[] | CanvasItem[],
    ) => {
      if (!effectiveProjectId) return;
      setFilesByProject((prev) => {
        const cur = prev[effectiveProjectId] || { generated: [], text: [], image: [], canvas: [] };
        return {
          ...prev,
          [effectiveProjectId]: {
            ...cur,
            [key]: updater(cur[key] as GeneratedFile[] | UploadedFile[] | CanvasItem[]),
          },
        };
      });
      // —— 手动保存模式：只标记 dirty，不再自动触发防抖写盘 ——
      //    用户点击「保存」按钮时才通过 handleManualSave → persistFilesSync → flush 统一写盘
      setCanvasSaveStatus((s) => ({ ...s, status: "dirty" }));
    },
    [effectiveProjectId],
  );

  // ——— 手动保存：统一保存当前项目的画布 + 对话到 localStorage（取消自动保存，改为用户触发）———
  // ⚠️ 定义位置：必须在 filesByProject / canvasItems / messages / persistFilesSync / debouncedPersist / setProjectMessages 之后
  const handleManualSave = useCallback(async () => {
    if (!effectiveProjectId) return;
    try {
      setCanvasSaveStatus((s) => ({ ...s, status: "saving" }));
      setChatSaveStatus((s) => ({ ...s, status: "saving" }));

      // 1. 保存画布（同步 flush 防抖写盘 + persistFilesSync 同步 localStorage）
      try { debouncedPersist.current.flush(); } catch { /* ignore */ }
      persistFilesSync(filesByProject);

      // 2. 保存对话（同步写入 project-store → persistProjectsSync → localStorage + 快照）
      if (activeConv) {
        setProjectMessages(effectiveProjectId, activeConv.id, messages);
      }

      // 3. 同步到服务端（跨浏览器/设备持久化）
      //    POST /api/workspace/state 携带完整工作台快照：projects + currentProjectId + filesByProject + 版本号
      //    失败不影响本地保存，仅 toast 提示
      try {
        const payload = {
          projects: JSON.parse(localStorage.getItem("aga-projects-data") || "[]"),
          currentProjectId: effectiveProjectId,
          filesByProject: filesByProject,
          fileVersions: (() => {
            const versions: Record<string, unknown> = {};
            for (let i = 0; i < localStorage.length; i++) {
              const k = localStorage.key(i);
              if (k && k.startsWith("aga-files-version-")) {
                try { versions[k] = JSON.parse(localStorage.getItem(k) || "{}"); }
                catch { versions[k] = localStorage.getItem(k); }
              }
            }
            return versions;
          })(),
        };
        // 静态模式：使用客户端 mock 替代服务端状态保存
        const { mockSaveWorkspaceState } = await import("@/lib/client-mock");
        await mockSaveWorkspaceState(payload);
      } catch (e) {
        // 静态模式同步失败不影响本地保存的成功
        console.warn("[handleManualSave] localStorage sync failed:", e);
      }

      // 4. 状态 → 已保存（延迟 200ms 让用户看到 saving 过渡效果）
      await new Promise((r) => setTimeout(r, 200));
      const now = new Date();
      setCanvasSaveStatus({ status: "saved", lastSavedAt: now });
      setChatSaveStatus({ status: "saved", lastSavedAt: now });
      toast.success(`已保存项目（${canvasItems.length} 个画布节点 / ${messages.length} 条对话）`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "保存失败";
      toast.error("保存失败：" + msg);
      setCanvasSaveStatus({ status: "error", message: msg });
      setChatSaveStatus({ status: "error", message: msg });
    }
  }, [effectiveProjectId, activeConv, messages, filesByProject, canvasItems, setProjectMessages]);

  // 兼容原接口的 setter
  const setGeneratedFiles = useCallback(
    (updater: GeneratedFile[] | ((prev: GeneratedFile[]) => GeneratedFile[])) => {
      updateProjectFiles("generated", (prev) =>
        typeof updater === "function" ? (updater as (p: GeneratedFile[]) => GeneratedFile[])(prev as GeneratedFile[]) : updater,
      );
    },
    [updateProjectFiles],
  );
  const setTextFiles = useCallback(
    (updater: UploadedFile[] | ((prev: UploadedFile[]) => UploadedFile[])) => {
      updateProjectFiles("text", (prev) =>
        typeof updater === "function" ? (updater as (p: UploadedFile[]) => UploadedFile[])(prev as UploadedFile[]) : updater,
      );
    },
    [updateProjectFiles],
  );
  const setImageFiles = useCallback(
    (updater: UploadedFile[] | ((prev: UploadedFile[]) => UploadedFile[])) => {
      updateProjectFiles("image", (prev) =>
        typeof updater === "function" ? (updater as (p: UploadedFile[]) => UploadedFile[])(prev as UploadedFile[]) : updater,
      );
    },
    [updateProjectFiles],
  );
  const setCanvasItems = useCallback(
    (updater: CanvasItem[] | ((prev: CanvasItem[]) => CanvasItem[])) => {
      updateProjectFiles("canvas", (prev) =>
        typeof updater === "function" ? (updater as (p: CanvasItem[]) => CanvasItem[])(prev as CanvasItem[]) : updater,
      );
    },
    [updateProjectFiles],
  );

  // 图片大图预览 / 视频全屏预览
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [previewImageName, setPreviewImageName] = useState<string>("");
  const [previewVideoUrl, setPreviewVideoUrl] = useState<string | null>(null);
  const [previewVideoName, setPreviewVideoName] = useState<string>("");
  const [previewHtmlUrl, setPreviewHtmlUrl] = useState<string | null>(null);
  // doc 文件预览
  const [previewDocUrl, setPreviewDocUrl] = useState<string | null>(null);
  const [previewDocName, setPreviewDocName] = useState<string>("");
  // AI 图像模式：等待用户点击"确认"后才生成效果图
  const [imageAwaitingConfirm, setImageAwaitingConfirm] = useState(false);
  // AI 视频模式：等待用户点击"生成视频"后才生成视频
  const [videoAwaitingConfirm, setVideoAwaitingConfirm] = useState(false);
  // 侧边栏收起状态（从 localStorage 恢复）
  // ⚠️ 修复 hydration 不匹配：SSR/CSR 初始值统一为 false，在 useEffect 中读取 localStorage
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const toggleSidebar = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      try { localStorage.setItem("aga-sidebar-collapsed", String(next)); } catch { /* ignore */ }
      return next;
    });
  };
  // 对话面板收起状态（从 localStorage 恢复）
  const [chatCollapsed, setChatCollapsed] = useState(false);
  const toggleChat = () => {
    setChatCollapsed((prev) => {
      const next = !prev;
      try { localStorage.setItem("aga-chat-collapsed", String(next)); } catch { /* ignore */ }
      return next;
    });
  };
  // 左右栏宽度（像素），从 localStorage 恢复
  // ⚠️ 修复 hydration 不匹配：SSR/CSR 初始值统一，在 useEffect 中读取 localStorage
  const [sidebarWidth, setSidebarWidth] = useState(260);
  const [chatWidth, setChatWidth] = useState(400);
  // 拖拽状态
  const dragRef = useRef<{ type: "left" | "right" | null; startX: number; startWidth: number }>({
    type: null,
    startX: 0,
    startWidth: 0,
  });
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    if (!isDragging) return;
    const handleMouseMove = (e: MouseEvent) => {
      const drag = dragRef.current;
      if (!drag.type) return;
      const dx = e.clientX - drag.startX;
      if (drag.type === "left") {
        // 左侧：向右拖增大宽度
        const newWidth = Math.max(200, Math.min(500, drag.startWidth + dx));
        setSidebarWidth(newWidth);
      } else {
        // 右侧：向左拖增大宽度
        const newWidth = Math.max(280, Math.min(700, drag.startWidth - dx));
        setChatWidth(newWidth);
      }
    };
    const handleMouseUp = () => {
      const drag = dragRef.current;
      if (drag.type === "left") {
        try { localStorage.setItem("aga-sidebar-width", String(sidebarWidth)); } catch { /* ignore */ }
      } else if (drag.type === "right") {
        try { localStorage.setItem("aga-chat-width", String(chatWidth)); } catch { /* ignore */ }
      }
      dragRef.current = { type: null, startX: 0, startWidth: 0 };
      setIsDragging(false);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isDragging, sidebarWidth, chatWidth]);

  // ⚠️ 修复 hydration 不匹配：客户端挂载后从 localStorage 恢复面板状态
  // 初始值统一为 false/默认宽度，确保 SSR 与 CSR 首次渲染结果一致
  useEffect(() => {
    try {
      const sc = localStorage.getItem("aga-sidebar-collapsed");
      if (sc === "true") setSidebarCollapsed(true);
      const cc = localStorage.getItem("aga-chat-collapsed");
      if (cc === "true") setChatCollapsed(true);
      const sw = localStorage.getItem("aga-sidebar-width");
      if (sw) { const n = parseInt(sw, 10); if (!isNaN(n)) setSidebarWidth(n); }
      const cw = localStorage.getItem("aga-chat-width");
      if (cw) { const n = parseInt(cw, 10); if (!isNaN(n)) setChatWidth(n); }
    } catch { /* ignore */ }
  }, []);

  const startDragLeft = (e: React.MouseEvent) => {
    if (sidebarCollapsed) return;
    e.preventDefault();
    dragRef.current = { type: "left", startX: e.clientX, startWidth: sidebarWidth };
    setIsDragging(true);
  };
  const startDragRight = (e: React.MouseEvent) => {
    if (chatCollapsed) return;
    e.preventDefault();
    dragRef.current = { type: "right", startX: e.clientX, startWidth: chatWidth };
    setIsDragging(true);
  };

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  // 项目/对话切换时同步消息
  // ⚠️ 核心修复：只在"真实切换项目/切换对话"场景下同步 messages 桶，
  // 禁止在普通 setMessages→setProjectMessages→Provider 重渲染时，
  // 用旧闭包捕获到的 currentProject 旧值回滚刚写入内存的新消息（场景2根因）。
  // 同时移除 else 分支对欢迎消息的无条件覆盖（场景1切回时丢消息的根因）。
  const lastSyncRef = useRef<{ projectId: string | null; convId: string } | null>(null);
  useEffect(() => {
    if (!currentProject || !activeConv) return;

    const pid = currentProject.id;
    const cid = activeConv.id;
    const last = lastSyncRef.current;

    // 仅当项目ID或对话ID发生切换时才从 store 同步一次；
    // 若 ID 未变则说明是普通渲染（setMessages 写回触发），不做同步，防止回滚内存新消息
    if (last && last.projectId === pid && last.convId === cid) {
      return;
    }
    lastSyncRef.current = { projectId: pid, convId: cid };

    // ——— 手动保存模式：切换项目/对话后，立即重置保存状态为 saved ———
    //     刚切换时加载的是 localStorage/store 中已持久化的干净快照，
    //     所以两个指示器都应该回到 saved（无未保存更改），避免携带上一个项目的脏标记
    setChatSaveStatus({ status: "saved" });
    setCanvasSaveStatus({ status: "saved" });

    const stored = currentProject.messagesByConversation[cid];
    if (stored && stored.length > 0) {
      setMessagesState(stored);
      // ——— 分页：切换对话时重置可见窗口，按总量判断是否还有更多旧消息 ———
      setVisibleMessageCount(PAGE_SIZE);
      hasMoreOlderMessagesRef.current = stored.length > PAGE_SIZE;
    } else if (!stored || stored.length === 0) {
      // 桶为空时：构造一条欢迎消息写回 store（下次切换时能读到此欢迎消息），
      // 而不是只写本地 state 造成 store 与 UI 不一致
      const welcome: Message = {
        id: `welcome-${cid}`,
        role: "assistant",
        content: WELCOME_MESSAGE,
        timestamp: new Date(),
      };
      setMessagesState([welcome]);
      setProjectMessages(pid, cid, [welcome]);
      setVisibleMessageCount(PAGE_SIZE);
      hasMoreOlderMessagesRef.current = false;
    }
    // 依赖：显式列出 effect 实际读取的所有响应式值（currentProject/activeConv）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentProject, activeConv, currentProjectId, activeConversation, setProjectMessages]);

  // ——— 对话分页：计算可见消息（最新 N 条）+ 加载更多 ———
  const totalMessages = messages.length;
  const hasMoreOlder = totalMessages > visibleMessageCount;
  const visibleMessages = hasMoreOlder
    ? messages.slice(totalMessages - visibleMessageCount)
    : messages;

  // 加载更多旧消息（递增可见窗口，保留滚动位置不跳回底部）
  const loadMoreMessages = useCallback(() => {
    if (!hasMoreOlderMessagesRef.current) return;
    const scrollEl = chatScrollRef.current;
    const prevScrollHeight = scrollEl?.scrollHeight || 0;
    const prevScrollTop = scrollEl?.scrollTop || 0;
    setVisibleMessageCount((prev) => {
      const next = prev + PAGE_SIZE;
      hasMoreOlderMessagesRef.current = totalMessages > next;
      return next;
    });
    // 渲染后恢复滚动位置：避免"加载更多"导致的界面跳变
    requestAnimationFrame(() => {
      const el = chatScrollRef.current;
      if (el) {
        const newHeight = el.scrollHeight;
        el.scrollTop = prevScrollTop + (newHeight - prevScrollHeight);
      }
    });
  }, [totalMessages]);

  // 对话滚动到顶部时自动加载更多
  const handleChatScroll = useCallback(() => {
    const el = chatScrollRef.current;
    if (!el) return;
    if (el.scrollTop <= 8 && hasMoreOlderMessagesRef.current) {
      loadMoreMessages();
    }
  }, [loadMoreMessages]);

  // 项目切换时重置生成状态标志，避免跨项目状态残留
  useEffect(() => {
    setImageAwaitingConfirm(false);
    setVideoAwaitingConfirm(false);
  }, [currentProjectId]);

  // 消息自动滚动到底部（操作父级滚动容器的 scrollTop，避免误滚动整个页面）
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const scrollToBottom = useCallback(() => {
    const scrollEl = chatScrollRef.current;
    if (scrollEl) {
      // 使用 requestAnimationFrame 确保 DOM 已完成最新消息渲染后再滚动
      requestAnimationFrame(() => {
        scrollEl.scrollTo({
          top: scrollEl.scrollHeight,
          behavior: "smooth",
        });
      });
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // 组件卸载时清理图片预览 URL
  useEffect(() => {
    return () => {
      imageFiles.forEach((f) => {
        if (f.previewUrl) URL.revokeObjectURL(f.previewUrl);
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // AI 图像模式：切换模式后自动填充"生成prompt"（仅第一阶段）
  useEffect(() => {
    if (selectedMode !== "image") {
      setImageAwaitingConfirm(false);
      return;
    }
    if (!imageAwaitingConfirm && input.trim() === "") {
      setInput("生成prompt");
    }
  }, [selectedMode, input]);

  // AI 视频模式：切换模式后自动填充"生成prompt"（仅第一阶段）
  useEffect(() => {
    if (selectedMode !== "video") {
      setVideoAwaitingConfirm(false);
      return;
    }
    // 景德镇项目：跳过第一阶段（生成prompt），直接进入第二阶段（生成视频）
    const projectName = currentProject?.name || "";
    const uploadedDocName = textFiles[0]?.name || "";
    const isJingdezhenProject =
      projectName.includes("景德镇") || uploadedDocName.includes("景德镇") || uploadedDocName.includes("陶瓷");
    if (isJingdezhenProject) {
      if (!videoAwaitingConfirm) setVideoAwaitingConfirm(true);
      if (input.trim() === "" || input.trim() === "生成prompt") {
        setInput("生成视频");
      }
      return;
    }
    if (!videoAwaitingConfirm && input.trim() === "") {
      setInput("生成prompt");
    }
  }, [selectedMode, input, currentProject, textFiles, videoAwaitingConfirm]);

  // AI 设计模式：图片或文档上传完成后自动填充"生成文档"（不自动发送，等待用户确认）
  useEffect(() => {
    if (selectedMode !== "design") return;
    if ((imageFiles.length >= 1 || textFiles.length >= 1) && input.trim() === "") {
      setInput("生成文档");
    }
  }, [imageFiles, textFiles, selectedMode, input]);

  // AI 网页模式：切换模式后自动填充"生成网页"（不自动发送，等待用户确认）
  useEffect(() => {
    if (selectedMode !== "html") return;
    if (input.trim() === "") {
      setInput("生成网页");
    }
  }, [selectedMode, input]);

  // ============ 文件上传逻辑 ============

  const uploadToDify = async (file: File, _apiKey: string): Promise<string> => {
    // 静态模式：使用客户端 mock 替代服务端上传
    const data = await mockDifyUpload(file);
    return data.upload_file_id;
  };

  const handleFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    type: "doc" | "image",
  ) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (!selectedMode) {
      toast.warning("请先选择模式（AI 设计/AI 图像/AI 视频）后再上传文件");
      e.target.value = "";
      return;
    }

    const upMode: Mode = selectedMode;
    const apiKey = MODE_CONFIG[upMode].apiKey;
    if (!apiKey) {
      toast.warning("AI 网页模式无需上传文件，请从生成文件区选择已有素材");
      e.target.value = "";
      return;
    }

    const fileArray = Array.from(files);

    // 文档最多 1 个
    if (type === "doc") {
      if (textFiles.length >= 1) {
        toast.warning("最多只能上传 1 个 DOC 文件，请先删除已有文档");
        e.target.value = "";
        return;
      }
    }

    // 图片最多 4 张
    if (type === "image") {
      const remaining = 4 - imageFiles.length;
      if (remaining <= 0) {
        toast.warning("最多只能上传 4 张图片，请先删除已有图片");
        e.target.value = "";
        return;
      }
      if (fileArray.length > remaining) {
        toast.warning(`当前最多还可上传 ${remaining} 张图片`);
      }
    }

    for (const file of fileArray) {
      // 文档限制数量
      if (type === "doc" && textFiles.length >= 1) break;
      // 图片限制数量
      if (type === "image" && imageFiles.length >= 4) break;

      const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const previewUrl =
        type === "image" ? URL.createObjectURL(file) : undefined;
      const uploadedFile: UploadedFile = {
        id,
        file,
        name: file.name,
        uploadedAt: new Date(),
        status: "uploading",
        previewUrl,
      };

      if (type === "doc") {
        setTextFiles((prev) => [...prev, uploadedFile]);
      } else {
        setImageFiles((prev) => [...prev, uploadedFile]);
      }

      // AI 设计/视频/图像模式：mock 流程，不走 Dify，直接标记上传成功
      if (upMode === "design" || upMode === "video" || upMode === "image") {
        // 静态模式：使用客户端 mock 上传，返回 Blob URL 用于本地预览
        let fileUrl = URL.createObjectURL(file);
        try {
          const uploadData = await mockUploadFile(file);
          if (uploadData.url) fileUrl = uploadData.url;
        } catch {
          /* 上传失败则用 blob URL 兜底 */
        }

        // 用持久 URL 回写 previewUrl，确保左侧预览和刷新后都正常显示
        if (type === "doc") {
          const mockUpdateFn = (prev: UploadedFile[]) =>
            prev.map((f) =>
              f.id === id ? { ...f, status: "success" as const } : f,
            );
          setTextFiles(mockUpdateFn);
        } else {
          const mockUpdateFn = (prev: UploadedFile[]) =>
            prev.map((f) =>
              f.id === id ? { ...f, status: "success" as const, previewUrl: fileUrl } : f,
            );
          setImageFiles(mockUpdateFn);
        }

        // AI 图像模式下上传草图：仅在左栏输入区显示，不同步到画布和对话区
        // 草图会在用户点击发送后才显示在画布和对话区
        if (upMode === "image" && type === "image") {
          toast.success(`${file.name} 上传成功`);
          continue;
        }

        // 在对话区域显示用户上传的文件
        const uploadedGenFile: GeneratedFile = {
          id: `upload-${id}`,
          name: file.name,
          url: fileUrl,
          type: type === "image" ? "image" : "doc",
          timestamp: new Date(),
        };
        const uploadMessage: Message = {
          id: `u-upload-${id}`,
          role: "user",
          content: `上传了文件：${file.name}`,
          files: [uploadedGenFile],
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, uploadMessage]);
        // 同步添加到画布（用静态 URL，刷新后仍可访问）
        // 视频模式下模特图为独立节点，不连接其他节点
        addGeneratedToCanvas([uploadedGenFile]);
        toast.success(`${file.name} 上传成功`);
        continue;
      }

      try {
        const difyFileId = await uploadToDify(file, apiKey);
        const updateFn = (prev: UploadedFile[]) =>
          prev.map((f) =>
            f.id === id
              ? { ...f, dify_file_id: difyFileId, status: "success" as const }
              : f,
          );
        if (type === "doc") {
          setTextFiles(updateFn);
        } else {
          setImageFiles(updateFn);
        }
        // 静态模式：使用客户端 mock 上传，获得 Blob URL 用于画布预览
        let canvasUrl = previewUrl as string;
        try {
          const uploadData = await mockUploadFile(file);
          if (uploadData.url) canvasUrl = uploadData.url;
        } catch {
          /* 上传失败则用 previewUrl 兜底 */
        }
        const uploadedGenFile: GeneratedFile = {
          id: `upload-${id}`,
          name: file.name,
          url: canvasUrl,
          type: type === "image" ? "image" : "doc",
          timestamp: new Date(),
        };
        // 在对话区域显示用户上传的文件
        const uploadMessage: Message = {
          id: `u-upload-${id}`,
          role: "user",
          content: `上传了文件：${file.name}`,
          files: [uploadedGenFile],
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, uploadMessage]);
        addGeneratedToCanvas([uploadedGenFile]);
        toast.success(`${file.name} 上传成功`);
      } catch (err) {
        const updateFn = (prev: UploadedFile[]) =>
          prev.map((f) =>
            f.id === id ? { ...f, status: "error" as const } : f,
          );
        if (type === "doc") {
          setTextFiles(updateFn);
        } else {
          setImageFiles(updateFn);
        }
        toast.error(`${file.name} 上传失败：${err instanceof Error ? err.message : "未知错误"}`);
      }
    }
    e.target.value = "";
  };

  const handleRemoveFile = (id: string, type: "doc" | "image") => {
    const removeFn = (prev: UploadedFile[]) => {
      const target = prev.find((f) => f.id === id);
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((f) => f.id !== id);
    };
    if (type === "doc") {
      setTextFiles(removeFn);
    } else {
      setImageFiles(removeFn);
    }
  };

  const handleRemoveGenerated = (id: string) => {
    setGeneratedFiles((prev) => prev.filter((f) => f.id !== id));
  };

  // ============ HTML 模式专用上传（本地存储，不走 Dify）============

  const handleHtmlFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    type: "video" | "image" | "doc",
  ) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    e.target.value = "";

    const fileArray = Array.from(files);
    const maxCount = type === "doc" ? 1 : 4;
    console.log("[HTML Upload] type:", type, "files:", fileArray.map((f) => f.name), "max:", maxCount);

    if (fileArray.length > maxCount) {
      const label = type === "doc" ? "文档" : type === "image" ? "图片" : "视频";
      toast.warning(`最多 ${maxCount} 个${label}，您选择了 ${fileArray.length} 个`);
      return;
    }

    // 上传所有文件
    const newFiles: GeneratedFile[] = [];
    for (const file of fileArray) {
      try {
        console.log("[HTML Upload] Uploading:", file.name, "size:", file.size);
        // 静态模式：使用客户端 mock 上传
        const data = await mockUploadFile(file);
        console.log("[HTML Upload] Response:", data);

        newFiles.push({
          id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          name: file.name,
          url: data.url,
          type,
          timestamp: new Date(),
        });
        toast.success(`${file.name} 上传成功`);
      } catch (err) {
        console.error("[HTML Upload] Error:", err);
        toast.error(`${file.name} 上传失败：${err instanceof Error ? err.message : "未知错误"}`);
      }
    }

    // 替换同类型的旧文件（避免与之前阶段生成的文件冲突）
    if (newFiles.length > 0) {
      setGeneratedFiles((prev) => {
        const others = prev.filter((f) => f.type !== type);
        const updated = [...others, ...newFiles];
        console.log("[HTML Upload] Replaced type:", type, "old count:", prev.length, "new count:", updated.length);
        return updated;
      });
    }
  };

  // ============ 下载逻辑 ============

  const downloadGenerated = (file: GeneratedFile) => {
    // 静态导出模式下统一通过 asset() 处理 URL（自动加 basePath 前缀）
    // 完整 URL（https://...）原样返回，相对路径直接打开
    const url = asset(file.url);
    const a = document.createElement("a");
    a.href = url;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const openImagePreview = useCallback((url: string, name?: string) => {
    setPreviewImageUrl(url);
    setPreviewImageName(name || "");
  }, []);

  const downloadUploaded = (file: UploadedFile) => {
    const a = document.createElement("a");
    const url = URL.createObjectURL(file.file);
    a.href = url;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadAll = () => {
    if (generatedFiles.length === 0) {
      toast.warning("暂无可下载的生成文件");
      return;
    }
    generatedFiles.forEach((file, idx) => {
      setTimeout(() => downloadGenerated(file), idx * 200);
    });
  };

  // ============ 发送消息逻辑 ============

  const handleSend = useCallback(async () => {
    if (!input.trim() || isLoading) return;
    if (!selectedMode) {
      toast.warning("请先选择一个模式");
      return;
    }

    // 显式类型断言，避免 TS 控制流收窄导致后续分支误报为不可达
    const mode: Mode = selectedMode;
    const config = MODE_CONFIG[mode];
    const message = input.trim();

    // ============ AI 图像模式：两阶段 mock 流程 ============
    if (mode === "image") {
      const projectName = currentProject?.name || "";
      const isManjuProject = projectName.includes("漫剧") || projectName.includes("神骨");
      const uploadedDocName = textFiles[0]?.name || "";
      const isJingdezhenProject = projectName.includes("景德镇") || uploadedDocName.includes("景德镇") || uploadedDocName.includes("陶瓷");

      // ---- 第二阶段：生成图像 ----
      if (imageAwaitingConfirm) {
        if (message !== "生成图像") {
          toast.warning('请输入"生成图像"以开始生成图片');
          return;
        }
        setImageAwaitingConfirm(false);

        const userMessage: Message = {
          id: `u-${Date.now()}`,
          role: "user",
          content: message,
          timestamp: new Date(),
        };
        const loadingId = `a-${Date.now()}-loading`;
        const loadingMessage: Message = {
          id: loadingId,
          role: "assistant",
          content: "",
          timestamp: new Date(),
          isLoading: true,
        };
        setMessages((prev) => [...prev, userMessage, loadingMessage]);
        setInput("");
        setIsLoading(true);

        try {
          // 景德镇项目：先添加草图到画布，再等待生成效果图
          if (isJingdezhenProject && imageFiles.length > 0) {
            const sketchImages = imageFiles.slice(0, 4);
            const promptItem = canvasItems.find(
              (i) => i.type === "file" && i.meta?.name?.includes("参考图prompt"),
            );
            const baseX = promptItem
              ? promptItem.x + promptItem.width + 120
              : 400;
            const baseY = promptItem ? promptItem.y : 40;
            const IMG_W = 200;
            const IMG_H = 150;
            // 效果图高度 300px，为避免垂直排列时效果图重叠，草图垂直间距需 ≥ 300
            const SKETCH_GAP = 200;

            setCanvasItems((prev) => {
              // 草图以一列形式垂直排布（相同 x，递增 y）
              const sketchItems: CanvasItem[] = sketchImages.map((file, idx) => ({
                id: `canvas-sketch-${file.id}`,
                type: "image" as const,
                content: file.previewUrl || "",
                x: baseX,
                y: baseY + idx * (IMG_H + SKETCH_GAP),
                width: IMG_W,
                height: IMG_H,
                zIndex: 20 + prev.length + idx,
                connectionFrom: promptItem?.id,
                connectionColors: ["#6b7280"],
                meta: { name: `草图${idx + 1}`, fileType: "image" },
              }));
              return [...prev, ...sketchItems];
            });

            toast.success("草图已添加到画布");
          }

          await new Promise((resolve) => setTimeout(resolve, 5000));

          if (isManjuProject) {
            // 漫剧项目：人物、场景、道具各3张图，共9张
            const docImagesMap: Record<string, GeneratedFile[]> = {
              "人物.doc": [
                { id: `gen-${Date.now()}-r1`, name: "苏挽.png", url: "/mock-manju/苏挽.png", type: "image" as const, timestamp: new Date() },
                { id: `gen-${Date.now()}-r2`, name: "萧珩.png", url: "/mock-manju/萧珩.png", type: "image" as const, timestamp: new Date() },
                { id: `gen-${Date.now()}-r3`, name: "玄青上人.png", url: "/mock-manju/玄青上人.png", type: "image" as const, timestamp: new Date() },
              ],
              "场景.doc": [
                { id: `gen-${Date.now()}-s1`, name: "诛仙台.png", url: "/mock-manju/诛仙台.png", type: "image" as const, timestamp: new Date() },
                { id: `gen-${Date.now()}-s2`, name: "青云大殿.png", url: "/mock-manju/青云大殿.png", type: "image" as const, timestamp: new Date() },
                { id: `gen-${Date.now()}-s3`, name: "灭门旧夜.png", url: "/mock-manju/灭门旧夜.png", type: "image" as const, timestamp: new Date() },
              ],
              "道具.doc": [
                { id: `gen-${Date.now()}-p1`, name: "墨玉牌.png", url: "/mock-manju/墨玉牌.png", type: "image" as const, timestamp: new Date() },
                { id: `gen-${Date.now()}-p2`, name: "墨断剑红绳.png", url: "/mock-manju/墨断剑红绳.png", type: "image" as const, timestamp: new Date() },
                { id: `gen-${Date.now()}-p3`, name: "半块碎玉.png", url: "/mock-manju/半块碎玉.png", type: "image" as const, timestamp: new Date() },
              ],
            };

            const allImages: GeneratedFile[] = [
              ...docImagesMap["人物.doc"],
              ...docImagesMap["场景.doc"],
              ...docImagesMap["道具.doc"],
            ];

            // 找到画布中对应的 doc 节点
            const findDocItem = (name: string) => canvasItems.find(
              (i) => i.type === "file" && (i.meta?.name === name || i.meta?.name?.includes(name.replace(".doc", ""))),
            );
            const renItem = findDocItem("人物.doc");
            const changItem = findDocItem("场景.doc");
            const daoItem = findDocItem("道具.doc");

            setCanvasItems((prev) => {
              const newItems: CanvasItem[] = [];

              const IMG_W = 300;
              const IMG_H = 225;
              const H_GAP = 40;
              const V_GAP = 60;

              // 3x3 grid layout: find the leftmost doc item as reference
              const docItems = [renItem, changItem, daoItem].filter(Boolean) as CanvasItem[];
              const minDocX = Math.min(...docItems.map((d) => d.x));
              const maxDocRight = Math.max(...docItems.map((d) => d.x + d.width));
              const gridStartX = maxDocRight + 120;
              const gridTopY = Math.min(...docItems.map((d) => d.y));

              // Build rows: row 1 = 人物, row 2 = 场景, row 3 = 道具
              const rowConfigs = [
                { docId: renItem?.id, images: docImagesMap["人物.doc"] },
                { docId: changItem?.id, images: docImagesMap["场景.doc"] },
                { docId: daoItem?.id, images: docImagesMap["道具.doc"] },
              ];

              rowConfigs.forEach(({ docId, images }, rowIdx) => {
                const rowY = gridTopY + rowIdx * (IMG_H + V_GAP);
                images.forEach((file, colIdx) => {
                  newItems.push({
                    id: `canvas-${file.id}`,
                    type: "image" as const,
                    content: file.url,
                    x: gridStartX + colIdx * (IMG_W + H_GAP),
                    y: rowY,
                    width: IMG_W,
                    height: IMG_H,
                    zIndex: 20 + prev.length + newItems.length,
                    connectionFrom: docId,
                    connectionColors: ["#a78bfa"],
                    meta: { name: file.name, fileType: "image" },
                  });
                });
              });

              return [...prev, ...newItems];
            });

            setMessages((prev) =>
              prev.map((m) =>
                m.id === loadingId
                  ? {
                      ...m,
                      isLoading: false,
                      content: "已为您生成9张图片（人物3张、场景3张、道具3张），请查看下方附件。",
                      files: allImages,
                    }
                  : m,
              ),
            );
            setGeneratedFiles((prev) => [...prev, ...allImages]);
            toast.success("9 张图片已生成");
          } else if (isJingdezhenProject) {
            // 景德镇陶瓷文创园：根据用户上传的草图生成对应的效果图
            const sketchImages = imageFiles.slice(0, 4);
            const sketchCount = sketchImages.length || 4;

            // 5秒后生成效果图（一一对应草图）
            const mockImages: GeneratedFile[] = Array.from({ length: sketchCount }, (_, i) => ({
              id: `gen-${Date.now()}-${i}`,
              name: `效果图${i + 1}.png`,
              url: `/mock-arch/mock-0${i + 1}.png`,
              type: "image" as const,
              timestamp: new Date(),
            }));

            // 找到画布中的参考图prompt节点
            const promptItem = canvasItems.find(
              (i) => i.type === "file" && i.meta?.name?.includes("参考图prompt"),
            );

            setCanvasItems((prev) => {
              const newImages: CanvasItem[] = [];
              const IMG_W = 400;
              const IMG_H = 300;
              const IMG_GAP = 80;

              mockImages.forEach((file, idx) => {
                // 找到对应的草图节点
                const sketchItem = sketchImages[idx]
                  ? prev.find((i) => i.id === `canvas-sketch-${sketchImages[idx].id}`)
                  : null;

                if (sketchItem) {
                  // 效果图放在草图右边
                  newImages.push({
                    id: `canvas-${file.id}`,
                    type: "image" as const,
                    content: file.url,
                    x: sketchItem.x + sketchItem.width + IMG_GAP,
                    y: sketchItem.y - 75,
                    width: IMG_W,
                    height: IMG_H,
                    zIndex: 20 + prev.length + newImages.length,
                    connectionFrom: sketchItem.id,
                    connectionColors: ["#3b82f6"],
                    meta: { name: file.name, fileType: "image" },
                  });
                } else if (promptItem) {
                  // 如果没有草图，直接放在prompt右边
                  newImages.push({
                    id: `canvas-${file.id}`,
                    type: "image" as const,
                    content: file.url,
                    x: promptItem.x + promptItem.width + 120,
                    y: promptItem.y + idx * (IMG_H + IMG_GAP),
                    width: IMG_W,
                    height: IMG_H,
                    zIndex: 20 + prev.length + newImages.length,
                    connectionFrom: promptItem.id,
                    connectionColors: ["#3b82f6"],
                    meta: { name: file.name, fileType: "image" },
                  });
                } else {
                  // 默认位置
                  newImages.push({
                    id: `canvas-${file.id}`,
                    type: "image" as const,
                    content: file.url,
                    x: 400,
                    y: 40 + idx * (IMG_H + IMG_GAP),
                    width: IMG_W,
                    height: IMG_H,
                    zIndex: 20 + prev.length + newImages.length,
                    meta: { name: file.name, fileType: "image" },
                  });
                }
              });

              return [...prev, ...newImages];
            });

            setMessages((prev) =>
              prev.map((m) =>
                m.id === loadingId
                  ? {
                      ...m,
                      isLoading: false,
                      content: sketchImages.length > 0
                        ? `已为您生成 ${sketchCount} 张建筑效果图，与草图一一对应，请查看下方附件。`
                        : `已为您生成 ${sketchCount} 张建筑效果图，请查看下方附件。`,
                      files: mockImages,
                    }
                  : m,
              ),
            );
            setGeneratedFiles((prev) => [...prev, ...mockImages]);
            toast.success(`${sketchCount} 张效果图已生成`);
          } else {
            // 默认：生成 4 张商品图
            const mockImages: GeneratedFile[] = [1, 2, 3, 4].map((i) => ({
              id: `gen-${Date.now()}-${i}`,
              name: `img${i}.png`,
              url: `/mock-dianshang/img${i}.png`,
              type: "image" as const,
              timestamp: new Date(),
            }));

            // 找到画布中图片prompt作为连接源
            const promptItem = canvasItems.find(
              (i) => i.type === "file" && i.meta?.name?.includes("图片prompt"),
            );

            // 图片放在图片prompt右边垂直排列
            const baseX = promptItem
              ? promptItem.x + promptItem.width + 120
              : 400;
            const baseY = promptItem ? promptItem.y : 40;

            setCanvasItems((prev) => {
              const newImages: CanvasItem[] = mockImages.map((file, idx) => ({
                id: `canvas-${file.id}`,
                type: "image" as const,
                content: file.url,
                x: baseX,
                y: baseY + idx * 340,
                width: 400,
                height: 300,
                zIndex: 20 + prev.length + idx,
                connectionFrom: promptItem?.id,
                connectionColors: ["#a78bfa"],
                meta: { name: file.name, fileType: "image" },
              }));
              return [...prev, ...newImages];
            });

            setMessages((prev) =>
              prev.map((m) =>
                m.id === loadingId
                  ? {
                      ...m,
                      isLoading: false,
                      content: "已为您生成 4 张图片，请查看下方附件。每张图都与图片 Prompt 有连线。",
                      files: mockImages,
                    }
                  : m,
              ),
            );
            setGeneratedFiles((prev) => [...prev, ...mockImages]);
            toast.success("4 张图片已生成");
          }
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : "未知错误";
          const errorMessage: Message = {
            id: `a-${Date.now()}`,
            role: "assistant",
            content: `**生成失败**\n\n${errorMsg}`,
            timestamp: new Date(),
            isError: true,
          };
          setMessages((prev) =>
            prev.map((m) => (m.id === loadingId ? errorMessage : m)),
          );
          toast.error(`生成失败：${errorMsg}`);
        } finally {
          setIsLoading(false);
        }
        return;
      }

      // ---- 第一阶段：生成prompt ----
      if (!message.includes(config.command)) {
        toast.warning(`请输入指令"${config.command}"以触发生成`);
        return;
      }

      const userMessage: Message = {
        id: `u-${Date.now()}`,
        role: "user",
        content: message,
        timestamp: new Date(),
      };
      const loadingId = `a-${Date.now()}-loading`;
      const loadingMessage: Message = {
        id: loadingId,
        role: "assistant",
        content: "",
        timestamp: new Date(),
        isLoading: true,
      };
      setMessages((prev) => [...prev, userMessage, loadingMessage]);
      setInput("");
      setIsLoading(true);

      try {
        await new Promise((resolve) => setTimeout(resolve, 5000));

        if (isManjuProject) {
          // 漫剧项目：生成三个文档（人物、场景、道具）
          const docFiles: GeneratedFile[] = [
            { id: `gen-${Date.now()}-1`, name: "人物.doc", url: "/mock-manju/人物.doc", type: "doc", timestamp: new Date() },
            { id: `gen-${Date.now()}-2`, name: "场景.doc", url: "/mock-manju/场景.doc", type: "doc", timestamp: new Date() },
            { id: `gen-${Date.now()}-3`, name: "道具.doc", url: "/mock-manju/道具.doc", type: "doc", timestamp: new Date() },
          ];

          setMessages((prev) =>
            prev.map((m) =>
              m.id === loadingId
                ? {
                    ...m,
                    isLoading: false,
                    content: "已为您生成人物、场景、道具文档，请查看下方附件。",
                    files: docFiles,
                  }
                : m,
            ),
          );
          setGeneratedFiles((prev) => [...prev, ...docFiles]);

          // 找到画布中剧本作为连接线起点
          const sourceItem = canvasItems.find(
            (i) => i.type === "file" && i.meta?.name?.includes("剧本"),
          );

          if (sourceItem) {
            setCanvasItems((prev) => {
              const newDocs: CanvasItem[] = docFiles.map((file, idx) => ({
                id: `canvas-${file.id}`,
                type: "file" as const,
                content: file.url,
                x: sourceItem.x + sourceItem.width + 80,
                y: sourceItem.y + idx * 260,
                width: 260,
                height: 200,
                zIndex: 15 + prev.length + idx,
                connectionFrom: sourceItem.id,
                connectionColors: ["#a78bfa"],
                meta: { name: file.name, fileType: "doc" },
              }));
              return [...prev, ...newDocs];
            });
          }

          toast.success("文档已生成");
        } else if (isJingdezhenProject) {
          // 景德镇项目：生成参考图prompt.doc
          const promptFile: GeneratedFile = {
            id: `gen-${Date.now()}`,
            name: "参考图prompt.doc",
            url: "/mock-arch/参考图prompt.doc",
            type: "doc",
            timestamp: new Date(),
          };

          setMessages((prev) =>
            prev.map((m) =>
              m.id === loadingId
                ? {
                    ...m,
                    isLoading: false,
                    content: "已为您生成参考图 Prompt，请查看下方附件。",
                    files: [promptFile],
                  }
                : m,
            ),
          );
          setGeneratedFiles((prev) => [...prev, promptFile]);

          // 找到画布中策划报告作为连接线起点
          const sourceCanvasItem = canvasItems.find(
            (i) => i.type === "file" && i.meta?.name?.includes("策划报告"),
          );
          addGeneratedToCanvas([promptFile], sourceCanvasItem?.id);
          toast.success("参考图 Prompt 已生成");
        } else {
          // 默认（绿发晶等）：输出图片prompt.doc
          const promptFile: GeneratedFile = {
            id: `gen-${Date.now()}`,
            name: "图片prompt.doc",
            url: "/mock-dianshang/图片prompt.doc",
            type: "doc",
            timestamp: new Date(),
          };

          setMessages((prev) =>
            prev.map((m) =>
              m.id === loadingId
                ? {
                    ...m,
                    isLoading: false,
                    content: "已为您生成图片 Prompt，请查看下方附件。",
                    files: [promptFile],
                  }
                : m,
            ),
          );
          setGeneratedFiles((prev) => [...prev, promptFile]);

          // 找到画布中商品简介作为连接线起点
          const sourceCanvasItem = canvasItems.find(
            (i) => i.type === "file" && i.meta?.name?.includes("商品简介"),
          );
          addGeneratedToCanvas([promptFile], sourceCanvasItem?.id);
          toast.success("图片 Prompt 已生成");
        }

        // 进入第二阶段，等待用户发送"生成图像"
        setImageAwaitingConfirm(true);
        setInput("生成图像");
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "未知错误";
        const errorMessage: Message = {
          id: `a-${Date.now()}`,
          role: "assistant",
          content: `**生成失败**\n\n${errorMsg}`,
          timestamp: new Date(),
          isError: true,
        };
        setMessages((prev) =>
          prev.map((m) => (m.id === loadingId ? errorMessage : m)),
        );
        toast.error(`生成失败：${errorMsg}`);
      } finally {
        setIsLoading(false);
      }
      return;
    }

    // ============ AI 设计模式：mock 流程（5s 思考 + 生成文档）============
    if (mode === "design") {
      // 校验指令
      if (!message.includes(config.command)) {
        toast.warning(`请输入指令"${config.command}"以触发生成`);
        return;
      }
      // 校验：需要上传至少 1 张图片或 1 个文档
      if (imageFiles.length < 1 && textFiles.length < 1) {
        toast.warning("请上传 1 张图片或 1 个文档");
        return;
      }

      // 根据项目名称决定返回的文件
      const projectName = currentProject?.name || "";
      const isManjuProject = projectName.includes("漫剧") || projectName.includes("神骨");

      // 添加用户消息 + loading 占位
      const userMessage: Message = {
        id: `u-${Date.now()}`,
        role: "user",
        content: message,
        timestamp: new Date(),
      };
      const loadingId = `a-${Date.now()}-loading`;
      const loadingMessage: Message = {
        id: loadingId,
        role: "assistant",
        content: "",
        timestamp: new Date(),
        isLoading: true,
      };
      setMessages((prev) => [...prev, userMessage, loadingMessage]);
      setInput("");
      setIsLoading(true);

      try {
        // 5s 思考
        await new Promise((resolve) => setTimeout(resolve, 5000));

        let generatedFile: GeneratedFile;
        let successMessage: string;
        let toastMessage: string;

        // 获取上传的文档文件名，用于判断生成什么
        const uploadedDocName = textFiles[0]?.name || "";
        const isJingdezhenProject = uploadedDocName.includes("景德镇") || uploadedDocName.includes("陶瓷");

        if (isManjuProject) {
          // 《神骨》漫剧项目：生成剧本.doc
          generatedFile = {
            id: `gen-${Date.now()}`,
            name: "剧本.doc",
            url: "/mock-manju/剧本.doc",
            type: "doc",
            timestamp: new Date(),
          };
          successMessage = "已为您生成剧本，请查看下方附件。";
          toastMessage = "剧本已生成";
        } else if (isJingdezhenProject) {
          // 景德镇陶瓷文创园：生成策划报告.doc
          generatedFile = {
            id: `gen-${Date.now()}`,
            name: "策划报告.doc",
            url: "/mock-arch/策划报告.doc",
            type: "doc",
            timestamp: new Date(),
          };
          successMessage = "已为您生成策划报告，请查看下方附件。";
          toastMessage = "策划报告已生成";
        } else {
          // 默认：生成商品简介.doc
          generatedFile = {
            id: `gen-${Date.now()}`,
            name: "商品简介.doc",
            url: "/mock-dianshang/商品简介.doc",
            type: "doc",
            timestamp: new Date(),
          };
          successMessage = "已为您生成商品简介，请查看下方附件。";
          toastMessage = "商品简介已生成";
        }

        setMessages((prev) =>
          prev.map((m) =>
            m.id === loadingId
              ? {
                  ...m,
                  isLoading: false,
                  content: successMessage,
                  files: [generatedFile],
                }
              : m,
          ),
        );
        setGeneratedFiles((prev) => [...prev, generatedFile]);
        // 找到画布中上传的文件作为连接线起点（优先文档，其次图片）
        const sourceCanvasItem = canvasItems.find(
          (i) => i.type === "file" && i.meta?.fileType === "doc",
        ) || canvasItems.find(
          (i) => i.type === "image",
        );
        addGeneratedToCanvas([generatedFile], sourceCanvasItem?.id);
        toast.success(toastMessage);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "未知错误";
        const errorMessage: Message = {
          id: `a-${Date.now()}`,
          role: "assistant",
          content: `**生成失败**\n\n${errorMsg}`,
          timestamp: new Date(),
          isError: true,
        };
        setMessages((prev) =>
          prev.map((m) => (m.id === loadingId ? errorMessage : m)),
        );
        toast.error(`生成失败：${errorMsg}`);
      } finally {
        setIsLoading(false);
      }
      return;
    }

    // ============ AI 视频模式：两阶段 mock 流程 ============
    if (mode === "video") {
      const projectName = currentProject?.name || "";
      const isManjuProject = projectName.includes("漫剧") || projectName.includes("神骨");
      const uploadedDocName = textFiles[0]?.name || "";
      const isJingdezhenProject =
        projectName.includes("景德镇") || uploadedDocName.includes("景德镇") || uploadedDocName.includes("陶瓷");

      // ---- 第二阶段：生成视频 ----
      if (videoAwaitingConfirm) {
        if (message !== "生成视频") {
          toast.warning('请输入"生成视频"以开始生成视频');
          return;
        }
        setVideoAwaitingConfirm(false);

        const userMessage: Message = {
          id: `u-${Date.now()}`,
          role: "user",
          content: message,
          timestamp: new Date(),
        };
        const loadingId = `a-${Date.now()}-loading`;
        const loadingMessage: Message = {
          id: loadingId,
          role: "assistant",
          content: "",
          timestamp: new Date(),
          isLoading: true,
        };
        setMessages((prev) => [...prev, userMessage, loadingMessage]);
        setInput("");
        setIsLoading(true);

        try {
          await new Promise((resolve) => setTimeout(resolve, 5000));

          // 景德镇项目：生成 4 个视频（mock-v1 ~ mock-v4），分别连接对应效果图
          if (isJingdezhenProject) {
            const videoFiles: GeneratedFile[] = [1, 2, 3, 4].map((i) => ({
              id: `gen-video-${Date.now()}-${i}`,
              name: `mock-v${i}.mp4`,
              url: `/mock-arch/mock-v${i}.mp4`,
              type: "video" as const,
              timestamp: new Date(),
            }));

            // 找到画布中 4 张效果图（按编号排序）
            const renderItems = canvasItems
              .filter((i) => i.type === "image" && i.meta?.name?.includes("效果图"))
              .sort((a, b) => {
                const na = parseInt(a.meta?.name?.replace("效果图", "") || "0", 10);
                const nb = parseInt(b.meta?.name?.replace("效果图", "") || "0", 10);
                return na - nb;
              });

            const VIDEO_W = 480;
            const VIDEO_H = 360;
            const VIDEO_GAP = 40;

            setCanvasItems((prev) => {
              const newVideos: CanvasItem[] = videoFiles.map((file, idx) => {
                const renderItem = renderItems[idx];
                // 视频放在对应效果图右边，垂直排列
                const x = renderItem
                  ? renderItem.x + renderItem.width + 80
                  : 400;
                const y = renderItem
                  ? renderItem.y - 30
                  : 40 + idx * (VIDEO_H + VIDEO_GAP);
                return {
                  id: `canvas-${file.id}`,
                  type: "video" as const,
                  content: file.url,
                  x,
                  y,
                  width: VIDEO_W,
                  height: VIDEO_H,
                  zIndex: 30 + prev.length + idx,
                  connectionFrom: renderItem?.id,
                  connectionColors: ["#3b82f6"],
                  meta: { name: file.name, fileType: "video" },
                };
              });
              return [...prev, ...newVideos];
            });

            setMessages((prev) =>
              prev.map((m) =>
                m.id === loadingId
                  ? {
                      ...m,
                      isLoading: false,
                      content: "已为您生成 4 个视频，与效果图一一对应，请查看下方附件。",
                      files: videoFiles,
                    }
                  : m,
              ),
            );
            setGeneratedFiles((prev) => [...prev, ...videoFiles]);
            toast.success("4 个视频已生成");
          } else {
            let videoFile: GeneratedFile;
            let videoContent: string;
            let videoName: string;

            if (isManjuProject) {
              videoFile = {
                id: `gen-video-${Date.now()}`,
                name: "视频0-30s.mp4",
                url: "/mock-manju/视频0-30s.mp4",
                type: "video" as const,
                timestamp: new Date(),
              };
              videoContent = "已为您生成视频，请查看下方附件。";
              videoName = "视频0-30s.mp4";
            } else {
              videoFile = {
                id: `gen-video-${Date.now()}`,
                name: "1.mp4",
                url: "/mock-dianshang/1.mp4",
                type: "video" as const,
                timestamp: new Date(),
              };
              videoContent = "已为您生成视频，请查看下方附件。";
              videoName = "1.mp4";
            }

            // 找到画布中prompt作为连接源
            const promptItem = isManjuProject
              ? canvasItems.find((i) => i.meta?.name?.includes("分镜稿"))
              : canvasItems.find((i) => i.meta?.name?.includes("视频prompt"));

            // 视频放在prompt右边
            const baseX = promptItem
              ? promptItem.x + promptItem.width + 80
              : 400;
            const baseY = promptItem ? promptItem.y : 40;

            setCanvasItems((prev) => {
              const newVideo: CanvasItem = {
                id: `canvas-${videoFile.id}`,
                type: "video" as const,
                content: videoFile.url,
                x: baseX,
                y: baseY,
                width: 480,
                height: 360,
                zIndex: 30 + prev.length,
                connectionFrom: promptItem?.id,
                connectionColors: ["#a78bfa"],
                meta: { name: videoFile.name, fileType: "video" },
              };
              return [...prev, newVideo];
            });

            setMessages((prev) =>
              prev.map((m) =>
                m.id === loadingId
                  ? {
                      ...m,
                      isLoading: false,
                      content: videoContent,
                      files: [videoFile],
                    }
                  : m,
              ),
            );
            setGeneratedFiles((prev) => [...prev, videoFile]);
            toast.success("视频已生成");
          }
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : "未知错误";
          const errorMessage: Message = {
            id: `a-${Date.now()}`,
            role: "assistant",
            content: `**生成失败**\n\n${errorMsg}`,
            timestamp: new Date(),
            isError: true,
          };
          setMessages((prev) =>
            prev.map((m) => (m.id === loadingId ? errorMessage : m)),
          );
          toast.error(`生成失败：${errorMsg}`);
        } finally {
          setIsLoading(false);
        }
        return;
      }

      // ---- 第一阶段：生成prompt ----
      // 景德镇项目跳过第一阶段，直接进入第二阶段生成视频
      if (isJingdezhenProject) {
        setVideoAwaitingConfirm(true);
        toast.info('请输入"生成视频"以开始生成视频');
        return;
      }
      if (!message.includes(config.command)) {
        toast.warning(`请输入指令"${config.command}"以触发生成`);
        return;
      }

      const userMessage: Message = {
        id: `u-${Date.now()}`,
        role: "user",
        content: message,
        timestamp: new Date(),
      };
      const loadingId = `a-${Date.now()}-loading`;
      const loadingMessage: Message = {
        id: loadingId,
        role: "assistant",
        content: "",
        timestamp: new Date(),
        isLoading: true,
      };
      setMessages((prev) => [...prev, userMessage, loadingMessage]);
      setInput("");
      setIsLoading(true);

      try {
        await new Promise((resolve) => setTimeout(resolve, 5000));

        let promptFile: GeneratedFile;
        let successContent: string;

        if (isManjuProject) {
          // 漫剧项目：生成分镜稿.doc
          promptFile = {
            id: `gen-${Date.now()}`,
            name: "分镜稿.doc",
            url: "/mock-manju/分镜稿.doc",
            type: "doc",
            timestamp: new Date(),
          };
          successContent = "已为您生成分镜稿，请查看下方附件。";
        } else {
          // 默认（绿发晶等）：输出视频prompt.doc
          promptFile = {
            id: `gen-${Date.now()}`,
            name: "视频prompt.doc",
            url: "/mock-dianshang/视频prompt.doc",
            type: "doc",
            timestamp: new Date(),
          };
          successContent = "已为您生成视频 Prompt，请查看下方附件。";
        }

        setMessages((prev) =>
          prev.map((m) =>
            m.id === loadingId
              ? {
                  ...m,
                  isLoading: false,
                  content: successContent,
                  files: [promptFile],
                }
              : m,
          ),
        );
        setGeneratedFiles((prev) => [...prev, promptFile]);

        // 找到所有图片作为连接源
        const imgItems = canvasItems.filter((i) => i.type === "image");

        // 放在最后一张图片右边
        const baseX =
          imgItems.length > 0
            ? Math.max(...imgItems.map((r) => r.x + r.width + 80))
            : 400;
        const baseY = imgItems.length > 0 ? imgItems[0].y : 40;

        setCanvasItems((prev) => {
          const newPrompt: CanvasItem = {
            id: `canvas-${promptFile.id}`,
            type: "file" as const,
            content: promptFile.url,
            x: baseX,
            y: baseY,
            width: 260,
            height: 200,
            zIndex: 15 + prev.length,
            connectionFrom: imgItems.map((i) => i.id),
            connectionColors: ["#a78bfa"],
            meta: { name: promptFile.name, fileType: "doc" },
          };
          return [...prev, newPrompt];
        });

        toast.success(isManjuProject ? "分镜稿已生成" : "视频 Prompt 已生成");

        // 进入第二阶段
        setVideoAwaitingConfirm(true);
        setInput("生成视频");
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "未知错误";
        const errorMessage: Message = {
          id: `a-${Date.now()}`,
          role: "assistant",
          content: `**生成失败**\n\n${errorMsg}`,
          timestamp: new Date(),
          isError: true,
        };
        setMessages((prev) =>
          prev.map((m) => (m.id === loadingId ? errorMessage : m)),
        );
        toast.error(`生成失败：${errorMsg}`);
      } finally {
        setIsLoading(false);
      }
      return;
    }

    // ============ AI 网页模式：mock 流程（5s 思考 + 生成 html.html）============
    if (mode === "html") {
      const projectName = currentProject?.name || "";
      const isManjuProject = projectName.includes("漫剧") || projectName.includes("神骨");
      const uploadedDocName = textFiles[0]?.name || "";
      const isJingdezhenProject =
        projectName.includes("景德镇") || uploadedDocName.includes("景德镇") || uploadedDocName.includes("陶瓷");
      const isCrystalProject =
        projectName.includes("绿发晶") || projectName.includes("白水晶") || projectName.includes("拼色") || projectName.includes("吊坠");

      // 校验指令
      if (!message.includes(config.command)) {
        toast.warning(`请输入指令"${config.command}"以触发生成`);
        return;
      }

      // 添加用户消息 + loading 占位
      const userMessage: Message = {
        id: `u-${Date.now()}`,
        role: "user",
        content: message,
        timestamp: new Date(),
      };
      const loadingId = `a-${Date.now()}-loading`;
      const loadingMessage: Message = {
        id: loadingId,
        role: "assistant",
        content: "",
        timestamp: new Date(),
        isLoading: true,
      };
      setMessages((prev) => [...prev, userMessage, loadingMessage]);
      setInput("");
      setIsLoading(true);

      try {
        // 5s 思考
        await new Promise((resolve) => setTimeout(resolve, 5000));

        // 景德镇项目：生成 流水为脉 · 坊巷成园.html，关联 4 个视频
        if (isJingdezhenProject) {
          const mockHtml: GeneratedFile = {
            id: `gen-html-${Date.now()}`,
            name: "流水为脉 · 坊巷成园.html",
            url: "/mock-arch/流水为脉 · 坊巷成园.html",
            type: "html" as const,
            timestamp: new Date(),
          };

          // 找到画布中 4 个视频（mock-v1 ~ mock-v4），按编号排序
          const videoItems = canvasItems
            .filter((i) => i.type === "video" && i.meta?.name?.startsWith("mock-v"))
            .sort((a, b) => {
              const na = parseInt(a.meta?.name?.replace("mock-v", "").replace(".mp4", "") || "0", 10);
              const nb = parseInt(b.meta?.name?.replace("mock-v", "").replace(".mp4", "") || "0", 10);
              return na - nb;
            });

          // 网页放在视频右边，垂直居中于视频列（长屏 900×1500）
          const htmlBaseX =
            videoItems.length > 0
              ? Math.max(...videoItems.map((v) => v.x + v.width + 120))
              : 800;
          const htmlBaseY = (() => {
            if (videoItems.length === 0) return 40;
            if (videoItems.length === 1) {
              const v = videoItems[0];
              return Math.max(40, Math.floor(v.y + v.height / 2 - 1500 / 2));
            }
            const minY = Math.min(...videoItems.map((v) => v.y));
            const last = videoItems.reduce((a, b) => (a.y > b.y ? a : b));
            const maxBottom = last.y + last.height;
            const centerY = (minY + maxBottom) / 2;
            return Math.max(40, Math.floor(centerY - 1500 / 2));
          })();

          setCanvasItems((prev) => {
            const newHtmlItem: CanvasItem = {
              id: `canvas-${mockHtml.id}`,
              type: "html" as const,
              content: mockHtml.url,
              x: htmlBaseX,
              y: htmlBaseY,
              width: 900,
              height: 1500,
              zIndex: 40 + prev.length,
              // HTML 关联全部 4 个视频（多连线）
              connectionFrom: videoItems.map((v) => v.id),
              connectionColors: ["#fbbf24"],
              meta: { name: mockHtml.name, fileType: "html" },
            };
            return [...prev, newHtmlItem];
          });

          setMessages((prev) =>
            prev.map((m) =>
              m.id === loadingId
                ? {
                    ...m,
                    isLoading: false,
                    content: "已为您生成网页，与 4 个视频建立关联，请查看下方附件。",
                    files: [mockHtml],
                  }
                : m,
            ),
          );
          setGeneratedFiles((prev) => [...prev, mockHtml]);
          toast.success("网页已生成");
        } else if (isCrystalProject) {
          // 绿发晶白水晶拼色树叶吊坠手链项目：生成专属 HTML
          const mockHtml: GeneratedFile = {
            id: `gen-html-${Date.now()}`,
            name: "绿发晶白水晶拼色树叶吊坠手链.html",
            url: "/mock-dianshang/绿发晶白水晶拼色树叶吊坠手链.html",
            type: "html" as const,
            timestamp: new Date(),
          };

          // 找到画布中的视频文件（1.mp4 或 mock-v 视频）
          const videoItems = canvasItems.filter(
            (i) => i.type === "video"
          );

          // 网页放在视频右边（长屏 900×1500），垂直居中于视频
          const htmlBaseX =
            videoItems.length > 0
              ? Math.max(...videoItems.map((v) => v.x + v.width + 120))
              : 800;
          const htmlBaseY = (() => {
            if (videoItems.length === 0) return 40;
            const v = videoItems[0];
            return Math.max(40, Math.floor(v.y + v.height / 2 - 1500 / 2));
          })();

          setCanvasItems((prev) => {
            const newHtmlItem: CanvasItem = {
              id: `canvas-${mockHtml.id}`,
              type: "html" as const,
              content: mockHtml.url,
              x: htmlBaseX,
              y: htmlBaseY,
              width: 900,
              height: 1500,
              zIndex: 40 + prev.length,
              connectionFrom: videoItems.length > 0 ? videoItems[0].id : undefined,
              connectionColors: ["#fbbf24"],
              meta: { name: mockHtml.name, fileType: "html" },
            };
            return [...prev, newHtmlItem];
          });

          setMessages((prev) =>
            prev.map((m) =>
              m.id === loadingId
                ? {
                    ...m,
                    isLoading: false,
                    content: "已为您生成网页，请查看下方附件。",
                    files: [mockHtml],
                  }
                : m,
            ),
          );
          setGeneratedFiles((prev) => [...prev, mockHtml]);
          toast.success("网页已生成");
        } else {
          // 生成 html.html 文件
          const mockHtml: GeneratedFile = {
            id: `gen-html-${Date.now()}`,
            name: "html.html",
            url: isManjuProject ? "/mock-manju/html.html" : "/mock-dianshang/html.html",
            type: "html" as const,
            timestamp: new Date(),
          };

          // 找到画布中的视频文件
          const videoItems = isManjuProject
            ? canvasItems.filter((i) => i.type === "video" && i.meta?.name?.includes("视频"))
            : canvasItems.filter((i) => i.type === "video" && i.meta?.name === "1.mp4");

          // 网页放在视频右边（长屏 900×1500），垂直居中于视频
          const htmlBaseX =
            videoItems.length > 0
              ? Math.max(...videoItems.map((v) => v.x + v.width + 120))
              : 800;
          const htmlBaseY = (() => {
            if (videoItems.length === 0) return 40;
            const v = videoItems[0];
            return Math.max(40, Math.floor(v.y + v.height / 2 - 1500 / 2));
          })();

          setCanvasItems((prev) => {
            const newHtmlItem: CanvasItem = {
              id: `canvas-${mockHtml.id}`,
              type: "html" as const,
              content: mockHtml.url,
              x: htmlBaseX,
              y: htmlBaseY,
              width: 900,
              height: 1500,
              zIndex: 40 + prev.length,
              connectionFrom: videoItems.length > 0 ? videoItems[0].id : undefined,
              connectionColors: ["#fbbf24"],
              meta: { name: mockHtml.name, fileType: "html" },
            };
            return [...prev, newHtmlItem];
          });

          setMessages((prev) =>
            prev.map((m) =>
              m.id === loadingId
                ? {
                    ...m,
                    isLoading: false,
                    content: "已为您生成网页，请查看下方附件。",
                    files: [mockHtml],
                  }
                : m,
            ),
          );
          setGeneratedFiles((prev) => [...prev, mockHtml]);
          toast.success("网页已生成");
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "未知错误";
        const errorMessage: Message = {
          id: `a-${Date.now()}`,
          role: "assistant",
          content: `**生成失败**\n\n${errorMsg}`,
          timestamp: new Date(),
          isError: true,
        };
        setMessages((prev) =>
          prev.map((m) => (m.id === loadingId ? errorMessage : m)),
        );
        toast.error(`生成失败：${errorMsg}`);
      } finally {
        setIsLoading(false);
      }
      return;
    }

    // ============ 其他模式正常流程（或 image 模式不满足上述条件时兜底）============

    // 校验指令
    if (!message.includes(config.command)) {
      toast.warning(`请输入指令"${config.command}"以触发生成`);
      return;
    }

    const successDocs = textFiles.filter(
      (f) => f.status === "success" && f.dify_file_id,
    );
    const successImages = imageFiles.filter(
      (f) => f.status === "success" && f.dify_file_id,
    );

    // 按模式校验文件（兜底，正常不会执行到）
    if (mode === "design") {
      if (imageFiles.length < 1 && textFiles.length < 1) {
        toast.warning("请上传 1 张商品图片或 1 个文档");
        return;
      }
    }

    // 添加用户消息
    const userMessage: Message = {
      id: `u-${Date.now()}`,
      role: "user",
      content: message,
      timestamp: new Date(),
    };

    // 添加 loading 占位消息（仅显示旋转图标，无文字）
    const loadingId = `a-${Date.now()}-loading`;
    const loadingMessage: Message = {
      id: loadingId,
      role: "assistant",
      content: "",
      timestamp: new Date(),
      isLoading: true,
    };

    setMessages((prev) => [...prev, userMessage, loadingMessage]);
    setInput("");
    setIsLoading(true);

    try {
      // 静态导出模式：使用客户端 mock 流替代 fetch + SSE
      const mockMode = mode as "design" | "image" | "video" | "html";
      const streamParams: { message: string; fileId?: string } = { message };
      if (mode === "design" && successDocs[0]?.dify_file_id) {
        streamParams.fileId = successDocs[0].dify_file_id;
      }

      // 开始接收内容，移除 loading 状态
      setMessages((prev) =>
        prev.map((m) =>
          m.id === loadingId ? { ...m, isLoading: false, content: "" } : m,
        ),
      );

      let fullAnswer = "";
      const collectedFiles: GeneratedFile[] = [];

      for await (const parsed of getMockStream(mockMode, streamParams)) {
        if (parsed.type === "chunk" && parsed.content) {
          fullAnswer += parsed.content;
          setMessages((prev) =>
            prev.map((m) =>
              m.id === loadingId ? { ...m, content: fullAnswer } : m,
            ),
          );
        } else if (parsed.type === "content_replace" && parsed.content !== undefined) {
          // 清理后的文本（已移除 URL），替换整个聊天内容
          fullAnswer = parsed.content;
          setMessages((prev) =>
            prev.map((m) =>
              m.id === loadingId ? { ...m, content: fullAnswer } : m,
            ),
          );
        } else if (parsed.type === "files" && parsed.files) {
          console.log("[mock] files event received:", parsed.files);
          const newFiles: GeneratedFile[] = parsed.files.map((f, i) => ({
            id: `gen-${Date.now()}-${i}`,
            name: f.name,
            url: f.url,
            type: f.type,
            timestamp: new Date(),
          }));
          collectedFiles.push(...newFiles);
          // 立即更新 generatedFiles 状态，使文件立即可见于右侧栏
          setGeneratedFiles((prev) => [...prev, ...newFiles]);
          addGeneratedToCanvas(newFiles);
          toast.success(`${newFiles.length} 个文件已生成`);
        } else if (parsed.type === "done") {
          console.log("[mock] done event, collectedFiles:", collectedFiles.length);
          // 从流式累积内容中移除文件 URL，避免在对话框中显示
          const finalContent = fullAnswer
            // 1. markdown 图片 ![alt](url) -> 移除整体
            .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
            // 2. markdown 链接 [text](url) -> 仅保留 text
            .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
            // 3. JSON url/file_url 字段 -> 移除
            .replace(/"\s*(?:file_)?url\s*"\s*:\s*"[^"]*"\s*,?\s*/g, "")
            // 4. 裸 URL -> 移除
            .replace(/https?:\/\/[^\s"'<>\]\)`]+/g, "")
            // 5. 折叠多余空行
            .replace(/\n{3,}/g, "\n\n")
            .replace(/[ \t]+\n/g, "\n")
            .trim();
          setMessages((prev) =>
            prev.map((m) =>
              m.id === loadingId
                ? {
                    ...m,
                    content: finalContent,
                    files:
                      collectedFiles.length > 0
                        ? collectedFiles
                        : undefined,
                  }
                : m,
            ),
          );
          if (collectedFiles.length > 0) {
            setGeneratedFiles((prev) => {
              // 防止重复添加
              const existingUrls = new Set(prev.map((f) => f.url));
              const deduped = collectedFiles.filter((f) => !existingUrls.has(f.url));
              if (deduped.length === 0) return prev;
              return [...prev, ...deduped];
            });
          }
        } else if (parsed.type === "error") {
          throw new Error(parsed.message || "未知错误");
        }
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "未知错误";
      const errorMessage: Message = {
        id: `a-${Date.now()}`,
        role: "assistant",
        content: `**生成失败**\n\n${errorMsg}`,
        timestamp: new Date(),
        isError: true,
      };
      setMessages((prev) =>
        prev.map((m) => (m.id === loadingId ? errorMessage : m)),
      );
      toast.error(`生成失败：${errorMsg}`);
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, selectedMode, textFiles, imageFiles, generatedFiles, imageAwaitingConfirm, videoAwaitingConfirm, canvasItems]);

  // ============ 新建对话 ============

  const handleNewConversation = () => {
    if (effectiveProjectId) {
      addConversation(effectiveProjectId);
      setImageAwaitingConfirm(false);
    }
  };

  // 将生成的文件添加到画布
  // perFileConnections: 每个文件独立的连接配置（可选），格式 { from: string[]; colors: string[] }
  // 返回创建的 canvas item IDs（通过回调返回）
  const addGeneratedToCanvas = useCallback((
    files: GeneratedFile[],
    connectionFromId?: string,
    perFileConnections?: { from: string[]; colors: string[] }[],
    onCreated?: (ids: string[]) => void,
  ) => {
    setCanvasItems((prev) => {
      // 如果有 connectionFromId，找到源项位置，把新项放在源项右边
      const sourceItem = connectionFromId
        ? prev.find((i) => i.id === connectionFromId || i.id.startsWith(`canvas-${connectionFromId}`))
        : null;

      const newItems: CanvasItem[] = files.map((file, idx) => {
        let baseX: number;
        let baseY: number;
        if (sourceItem) {
          // 放在源项右边
          baseX = sourceItem.x + sourceItem.width + 80;
          baseY = sourceItem.y + idx * 280;
        } else {
          const col = prev.length % 3;
          const row = Math.floor(prev.length / 3);
          baseX = col * 340 + 40;
          baseY = row * 260 + 40;
        }
        const size = file.type === "image" || file.type === "video" ? 320 : 260;
        const height = file.type === "image" || file.type === "video" ? 240 : 200;
        const itemId = `canvas-${file.id}-${Date.now()}-${idx}`;
        const perFile = perFileConnections?.[idx];
        return {
          id: itemId,
          type: file.type === "doc" ? "file" : (file.type as "image" | "video" | "file"),
          content: file.url,
          x: baseX,
          y: baseY,
          width: size,
          height,
          zIndex: 10 + prev.length + idx,
          connectionFrom: perFile ? perFile.from : sourceItem?.id,
          connectionColors: perFile ? perFile.colors : undefined,
          meta: { name: file.name, fileType: file.type },
        };
      });
      // 回调返回创建的 IDs
      if (onCreated) onCreated(newItems.map((i) => i.id));
      return [...prev, ...newItems];
    });
  }, [setCanvasItems]);

  // ============ 数据导出/导入功能 ============

  // 导出所有数据（项目 + 画布数据）
  const handleExportAllData = useCallback(() => {
    try {
      // 获取项目数据
      const projectData = exportProjectData();
      // 获取画布/文件数据
      const canvasDataToStore: Record<string, { generated: GeneratedFile[]; text: StoredUploadedFile[]; image: StoredUploadedFile[]; canvas: CanvasItem[] }> = {};
      for (const [pid, val] of Object.entries(filesByProject)) {
        canvasDataToStore[pid] = {
          generated: val.generated,
          text: val.text.map(toStored),
          image: val.image.map(toStored),
          canvas: val.canvas,
        };
      }
      // 合并导出
      const fullExport = {
        ...JSON.parse(projectData),
        canvasData: canvasDataToStore,
        exportedAt: new Date().toISOString(),
      };
      const json = JSON.stringify(fullExport, null, 2);
      // 下载到文件
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `aga-backup-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("数据导出成功");
    } catch (err) {
      toast.error(`导出失败：${err instanceof Error ? err.message : "未知错误"}`);
    }
  }, [exportProjectData, filesByProject]);

  // 从导入的文件恢复数据
  const handleImportAllData = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const json = e.target?.result as string;
        const data = JSON.parse(json);
        
        // 检查是否为有效的备份文件
        if (!data.version && !data.canvasData) {
          toast.error("无效的备份文件格式");
          return;
        }

        // 恢复项目数据
        if (data.projects) {
          const success = importProjectData(JSON.stringify({
            version: data.version || 1,
            projects: data.projects,
            currentProjectId: data.currentProjectId,
            designSchemes: data.designSchemes,
            renderImages: data.renderImages,
            videos: data.videos,
            pptSlides: data.pptSlides,
            uploadedDoc: data.uploadedDoc,
            uploadedSketch: data.uploadedSketch,
          }));
          
          if (!success) {
            toast.error("项目数据恢复失败");
            return;
          }
        }

        // 恢复画布数据
        if (data.canvasData) {
          const restored: Record<string, { generated: GeneratedFile[]; text: UploadedFile[]; image: UploadedFile[]; canvas: CanvasItem[] }> = {};
          for (const [pid, val] of Object.entries(data.canvasData)) {
            const v = val as { generated: GeneratedFile[]; text?: StoredUploadedFile[]; image?: StoredUploadedFile[]; canvas: CanvasItem[] };
            restored[pid] = {
              generated: v.generated || [],
              text: (v.text || []).map(fromStored),
              image: (v.image || []).map(fromStored),
              canvas: v.canvas || [],
            };
          }
          setFilesByProject(restored);
          // 持久化到 localStorage
          try {
            const toStore: Record<string, { generated: GeneratedFile[]; text: StoredUploadedFile[]; image: StoredUploadedFile[]; canvas: CanvasItem[] }> = {};
            for (const [pid, val] of Object.entries(restored)) {
              toStore[pid] = {
                generated: val.generated,
                text: val.text.map(toStored),
                image: val.image.map(toStored),
                canvas: val.canvas,
              };
            }
            localStorage.setItem(STORAGE_KEY, JSON.stringify(toStore));
          } catch {
            /* ignore */
          }
        }

        toast.success("数据恢复成功，正在刷新页面...");
        // 延迟刷新以确保状态更新
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      } catch (err) {
        toast.error(`导入失败：${err instanceof Error ? err.message : "未知错误"}`);
      }
    };
    reader.readAsText(file);
  }, [importProjectData]);

  // ============ 保存当前项目工作流 ============
  const handleSaveWorkflow = useCallback((targetProjectId?: string) => {
    try {
      const projectId = targetProjectId || currentProjectId || "unknown";
      const isCurrentProject = projectId === currentProjectId;
      const projectName = isCurrentProject
        ? (currentProject?.name || "未命名项目")
        : (projects.find((p) => p.id === projectId)?.name || "未命名项目");
      const projectData = filesByProject[projectId];

      if (!projectData || projectData.canvas.length === 0) {
        toast.warning("画布为空，无需保存");
        return;
      }

      // 构建工作流数据
      const workflowData = {
        project: {
          id: projectId,
          name: projectName,
          savedAt: new Date().toISOString(),
        },
        canvas: projectData.canvas.map((item) => ({
          id: item.id,
          type: item.type,
          x: item.x,
          y: item.y,
          width: item.width,
          height: item.height,
          connectionFrom: item.connectionFrom,
          connectionColors: item.connectionColors,
          meta: item.meta,
        })),
        files: {
          generated: projectData.generated.map((f) => ({
            id: f.id,
            name: f.name,
            url: f.url,
            type: f.type,
          })),
          uploadedTexts: projectData.text.map((f) => ({
            id: f.id,
            name: f.name,
          })),
          uploadedImages: projectData.image.map((f) => ({
            id: f.id,
            name: f.name,
          })),
        },
      };

      // 生成 JSON 并下载
      const json = JSON.stringify(workflowData, null, 2);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `workflow-${projectName}-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);

      toast.success(
        `工作流已保存（${projectData.canvas.length} 个节点）\n· 浏览器自动持久化 ✓\n· 已下载 JSON 备份文件`,
      );
    } catch (err) {
      toast.error(`保存失败：${err instanceof Error ? err.message : "未知错误"}`);
    }
  }, [currentProject, currentProjectId, filesByProject, projects]);

  // ============ 渲染辅助 ============

  const placeholder = selectedMode
    ? MODE_CONFIG[selectedMode].placeholder
    : "Ask Agora anything...";

  // 生成的图片文件（用于右侧栏缩略图展示）
  const generatedImages = generatedFiles.filter((f) => f.type === "image");
  const generatedVideos = generatedFiles.filter((f) => f.type === "video");
  const generatedNonImageNonVideos = generatedFiles.filter(
    (f) => f.type !== "image" && f.type !== "video",
  );
  // URL 是否可直接预览（/api 路径或 http/https 绝对路径）
  const isPreviewableUrl = (u: string) =>
    u.startsWith("/") || u.startsWith("http");

  return (
    <div className="relative h-screen overflow-hidden bg-black text-white flex flex-col">
      <PreviewImageModalLayer
        previewImageUrl={previewImageUrl}
        name={previewImageName}
        onClose={() => {
          setPreviewImageUrl(null);
          setPreviewImageName("");
        }}
      />
      <PreviewVideoModalLayer
        url={previewVideoUrl}
        name={previewVideoName}
        onClose={() => {
          setPreviewVideoUrl(null);
          setPreviewVideoName("");
        }}
      />
      <PreviewHtmlModalLayer
        url={previewHtmlUrl}
        onClose={() => {
          setPreviewHtmlUrl(null);
        }}
      />
      <PreviewDocModalLayer
        url={previewDocUrl}
        name={previewDocName}
        onClose={() => {
          setPreviewDocUrl(null);
          setPreviewDocName("");
        }}
        onDownload={() => {
          if (previewDocUrl) {
            const a = document.createElement("a");
            a.href = previewDocUrl;
            a.download = previewDocName || "文件";
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
          }
        }}
      />
      {/* 顶部导航栏 */}
      <header className="h-14 flex-shrink-0 border-b border-gray-300/20 flex items-center justify-between px-4 bg-transparent backdrop-blur-md relative z-10">
        <div className="flex items-center gap-3">
          <img src={asset("/archda-icon.svg")} alt="ArchDA" className="w-8 h-8" />
          <span className="text-xl font-bold text-white">Agora</span>
          <div className="h-6 w-px bg-white/20 mx-2" />
          <div className="flex items-center gap-2 text-base text-white/60">
            <div className="w-2 h-2 rounded-full bg-green-500" />
            <span>ECADI</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className="p-2 hover:bg-white/5 rounded-lg transition-colors">
            <Bell className="w-5 h-5 text-white/60" />
          </button>
          <button className="p-2 hover:bg-white/5 rounded-lg transition-colors">
            <Settings className="w-5 h-5 text-white/60" />
          </button>
          <button className="p-2 hover:bg-white/5 rounded-lg transition-colors">
            <User className="w-5 h-5 text-white/60" />
          </button>
          <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center ml-2">
            <span className="text-sm font-medium">ZM</span>
          </div>
        </div>
      </header>

      {/* 主体内容 - 三栏布局 */}
      <div className="flex-1 flex overflow-hidden relative z-10 min-h-0">
        {/* 左侧面板 - 项目 / 输入 / 输出 */}
        <div 
          style={{ 
            width: sidebarCollapsed ? 56 : sidebarWidth,
            flexShrink: 0,
            transition: isDragging ? "none" : "width 0.3s ease",
          }} 
          className="h-full overflow-hidden"
        >
          <WorkspaceSidebar
            textFiles={textFiles}
            imageFiles={imageFiles}
            generatedFiles={generatedFiles}
            onUploadText={(e) => handleFileUpload(e, "doc")}
            onUploadImage={(e) => handleFileUpload(e, "image")}
            onRemoveText={(id) => setTextFiles((p) => p.filter((f) => f.id !== id))}
            onRemoveImage={(id) => setImageFiles((p) => p.filter((f) => f.id !== id))}
            onPreviewImage={(url) => openImagePreview(url)}
            onDownloadGenerated={downloadGenerated}
            onRemoveGenerated={(id) => setGeneratedFiles((p) => p.filter((f) => f.id !== id))}
            onDownloadAll={handleDownloadAll}
            collapsed={sidebarCollapsed}
            onToggleCollapse={toggleSidebar}
            onExportData={handleExportAllData}
            onImportData={handleImportAllData}
            onSaveWorkflow={handleSaveWorkflow}
            currentProjectName={currentProject?.name}
            onBeforeSwitchProject={(targetId) => {
              // —— 手动保存模式：项目切换前检查是否存在未保存更改 ——
              //    有脏数据时：toast 警告并阻止切换；用户保存后再次点击即可正常切换
              //    无脏数据或切到当前项目：直接允许
              if (targetId === effectiveProjectId) return true;
              if (hasUnsavedChanges) {
                toast.warning(
                  `当前项目有未保存的更改，请先点击「保存」按钮再切换项目。\n（${canvasItems.length} 个画布节点 / ${messages.length} 条对话）`,
                  { duration: 4000, closeButton: true },
                );
                return false;
              }
              return true;
            }}
          />
        </div>

        {/* 左侧拖拽分隔条 */}
        {!sidebarCollapsed && (
          <div
            onMouseDown={startDragLeft}
            className="w-1 h-full cursor-col-resize bg-transparent hover:bg-white/20 transition-colors flex-shrink-0 group relative"
            title="拖拽调整宽度"
          >
            <div className="absolute inset-y-0 -left-1 -right-1 z-20" />
          </div>
        )}

        {/* 中央画布工作台 */}
        <main 
          className="flex flex-col bg-[#0d0d0d] min-h-0 min-w-0 overflow-hidden flex-1 relative"
        >
          {/* 画布保存状态 + 手动保存按钮 - 浮动在右上角 */}
          <div className="absolute top-3 right-3 z-30 pointer-events-auto flex items-center gap-2">
            {/* —— 统一手动保存：点击触发画布+对话一起写盘 —— */}
            <button
              onClick={handleManualSave}
              disabled={canvasSaveStatus.status === "saving" || chatSaveStatus.status === "saving"}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shadow-lg ${
                hasUnsavedChanges
                  ? "bg-blue-500 hover:bg-blue-600 text-white animate-pulse"
                  : "bg-white/10 hover:bg-white/20 text-white/80"
              } disabled:opacity-60 disabled:cursor-not-allowed`}
              title={hasUnsavedChanges ? "当前有未保存更改，点击保存画布节点与对话历史" : "再次保存当前项目"}
            >
              {(canvasSaveStatus.status === "saving" || chatSaveStatus.status === "saving") ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <HardDrive className="w-3.5 h-3.5" />
              )}
              <span>保存项目</span>
            </button>
            {/* 画布保存状态指示器（仅显示状态，点击也触发同一保存流程） */}
            <SaveStatusIndicator info={canvasSaveStatus} onManualSync={handleManualSave} />
          </div>

          <InfiniteCanvas
            items={canvasItems}
            onItemsChange={setCanvasItems}
            projectId={effectiveProjectId || undefined}
            onPreviewImage={(url, name) => openImagePreview(url, name)}
            onPreviewVideo={(url, name) => {
              setPreviewVideoUrl(url);
              setPreviewVideoName(name);
            }}
            onDownloadFile={(item) => {
              const file: GeneratedFile = {
                id: item.id,
                name: item.meta?.name || "文件",
                url: item.content,
                type: (item.meta?.fileType as "doc" | "image" | "video" | "html") || "image",
                timestamp: new Date(),
              };
              downloadGenerated(file);
            }}
            onPreviewFile={(item) => {
              const url = item.content;
              const name = item.meta?.name || "文件";
              const ext = url.split(".").pop()?.toLowerCase() || "";
              // 根据扩展名路由到对应预览模态框
              if (["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(ext)) {
                openImagePreview(url, name);
              } else if (["mp4", "webm", "mov", "avi"].includes(ext)) {
                setPreviewVideoUrl(url);
                setPreviewVideoName(name);
              } else if (["html", "htm"].includes(ext)) {
                setPreviewHtmlUrl(url);
              } else {
                // doc/docx/pdf 等无法直接渲染的文件
                setPreviewDocUrl(url);
                setPreviewDocName(name);
              }
            }}
          />
        </main>

        {/* 右侧拖拽分隔条 */}
        {!chatCollapsed && (
          <div
            onMouseDown={startDragRight}
            className="w-1 h-full cursor-col-resize bg-transparent hover:bg-white/20 transition-colors flex-shrink-0 group relative"
            title="拖拽调整宽度"
          >
            <div className="absolute inset-y-0 -left-1 -right-1 z-20" />
          </div>
        )}

        {/* 右侧面板 - 智能体对话 */}
        <div 
          style={{ 
            width: chatCollapsed ? 56 : chatWidth,
            flexShrink: 0,
            transition: isDragging ? "none" : "width 0.3s ease",
          }} 
          className="h-full overflow-hidden flex"
        >
          <aside 
            className={`flex flex-col h-full border-l border-white/10 bg-[#1a1a1a]/95 overflow-hidden transition-all duration-300 ${chatCollapsed ? 'w-14' : 'flex-1 min-w-0'}`}
          >
            {chatCollapsed ? (
              /* 收起状态 - 仅显示展开按钮和模式图标 */
              <div className="flex flex-col items-center py-3 gap-2 h-full">
                <button
                  onClick={toggleChat}
                  className="w-10 h-10 flex items-center justify-center rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors"
                  title="展开对话面板"
                >
                  <PanelRight className="w-5 h-5" />
                </button>
                <div className="w-8 h-px bg-white/10 my-1" />
                {selectedMode && (
                  <div
                    className="w-10 h-10 flex items-center justify-center rounded-lg transition-colors"
                    style={{ color: MODE_CONFIG[selectedMode].icon === FileText ? '#60a5fa' : MODE_CONFIG[selectedMode].icon === ImageIcon ? '#4ade80' : MODE_CONFIG[selectedMode].icon === Video ? '#c084fc' : MODE_CONFIG[selectedMode].icon === Code ? '#fbbf24' : '#60a5fa' }}
                    title={MODE_CONFIG[selectedMode].label}
                  >
                    {(() => {
                      const Icon = MODE_CONFIG[selectedMode].icon;
                      return <Icon className="w-5 h-5" />;
                    })()}
                  </div>
                )}
                <div className="flex-1" />
                {messages.length > 0 && (
                  <span className="w-5 h-5 rounded-full bg-white/10 text-[10px] text-white/60 flex items-center justify-center">
                    {messages.filter(m => m.role === 'user').length}
                  </span>
                )}
              </div>
            ) : (
              /* 展开状态 - 完整对话界面 */
              <>
                {/* 项目名称头部 */}
                <div className="flex-shrink-0 px-4 py-3 border-b border-white/10 bg-white/5 relative">
                  {/* 收起按钮 */}
                  <button
                    onClick={toggleChat}
                    className="absolute left-2 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center rounded-md text-white/40 hover:text-white hover:bg-white/10 transition-colors"
                    title="收起对话面板"
                  >
                    <PanelRightClose className="w-4 h-4" />
                  </button>
                  <div className="flex items-center justify-between pl-8">
                    <div className="flex items-center gap-2 min-w-0">
                      <FolderOpen className="w-4 h-4 text-blue-400 flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-white truncate">
                          {currentProject?.name || "未命名项目"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {/* 对话区也放保存按钮（与画布右上角保持一致） */}
                      <button
                        onClick={handleManualSave}
                        disabled={canvasSaveStatus.status === "saving" || chatSaveStatus.status === "saving"}
                        className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-semibold transition-colors ${
                          hasUnsavedChanges
                            ? "bg-blue-500 hover:bg-blue-600 text-white animate-pulse"
                            : "bg-white/10 hover:bg-white/20 text-white/80"
                        } disabled:opacity-60 disabled:cursor-not-allowed`}
                        title="保存当前项目（画布节点 + 对话历史）"
                      >
                        {(canvasSaveStatus.status === "saving" || chatSaveStatus.status === "saving") ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <HardDrive className="w-3.5 h-3.5" />
                        )}
                      </button>
                      {/* 对话保存状态指示器（点击也触发统一保存流程） */}
                      <SaveStatusIndicator info={chatSaveStatus} onManualSync={handleManualSave} />
                      <button
                        onClick={() => {
                          const snaps = listProjectSnapshots();
                          if (snaps.length === 0) {
                            toast.info("暂无可用的历史对话快照");
                            return;
                          }
                          const options = snaps
                            .map((k, i) => {
                              // 从 key 中提取时间串 (aga-projects-snapshots-YYYY-MM-DDTHH-mm-ss-SSSZ)
                              const tsPart = k.replace("aga-projects-snapshots-", "").replace(/-(\d{3})Z$/, ".$1Z");
                              const date = new Date(tsPart);
                              const label = isNaN(date.getTime())
                                ? tsPart
                                : date.toLocaleString("zh-CN", { hour12: false });
                              return `${i + 1}. ${label}  (${k.slice(-8)})`;
                            })
                            .join("\n");
                          const input = window.prompt(
                            `选择要恢复的历史快照（输入序号 1-${snaps.length}，或点击取消放弃）\n\n${options}`,
                            "1",
                          );
                          if (input === null) return;
                          const idx = parseInt(input, 10) - 1;
                          if (isNaN(idx) || idx < 0 || idx >= snaps.length) {
                            toast.error("无效的序号");
                            return;
                          }
                          const target = snaps[idx];
                          const ok = restoreProjectSnapshot(target);
                          if (ok) {
                            toast.success("已恢复到所选快照，页面即将刷新...");
                            setTimeout(() => window.location.reload(), 600);
                          } else {
                            toast.error("恢复失败，请确认快照数据是否完整");
                          }
                        }}
                        className="p-1.5 text-white/50 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                        title="恢复历史对话（从最近 8 份快照回滚）"
                      >
                        <History className="w-4 h-4" />
                      </button>
                      <button
                        onClick={handleNewConversation}
                        className="p-1.5 text-white/50 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                        title="新建对话"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  {/* 对话切换标签 */}
                  {conversations.length > 1 && (
                    <div className="flex gap-1 mt-2 overflow-x-auto chat-scroll">
                      {conversations.map((conv) => (
                        <div
                          key={conv.id}
                          className={`group flex-shrink-0 flex items-center gap-0.5 px-2 py-1 rounded text-xs transition-colors ${
                            activeConversation === conv.id
                              ? "bg-white/20 text-white"
                              : "bg-white/5 text-white/50 hover:bg-white/10"
                          }`}
                        >
                          <button
                            onClick={() => {
                              if (effectiveProjectId) {
                                switchConversation(effectiveProjectId, conv.id);
                              }
                            }}
                            className="flex-1"
                          >
                            {conv.title}
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (effectiveProjectId && conversations.length > 1) {
                                deleteConversation(effectiveProjectId, conv.id);
                                toast.success("对话已删除");
                              }
                            }}
                            className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-white/20 rounded transition-all flex-shrink-0"
                            title="删除对话"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

          {/* 对话消息区域 - 占满除输入框外的所有空间 */}
          <div
            ref={chatScrollRef}
            onScroll={handleChatScroll}
            className="flex-1 overflow-y-auto chat-scroll px-3 py-4 min-h-0"
          >
            <div className="space-y-4">
              {/* 加载更多历史消息按钮（仅当有更多旧消息时显示） */}
              {hasMoreOlder && (
                <div className="flex justify-center py-2">
                  <button
                    onClick={loadMoreMessages}
                    className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-white/60 hover:text-white text-xs transition-all"
                  >
                    <ChevronUp className="w-3.5 h-3.5" />
                    加载更多历史消息（{totalMessages - visibleMessageCount} 条未显示）
                  </button>
                </div>
              )}
              {visibleMessages.map((message) => (
                message.role === "user" ? (
                  <div key={message.id} className="flex justify-end">
                    <div className="max-w-[85%] p-3 border border-white/10 rounded-2xl bg-white/5 backdrop-blur-sm text-white">
                      {message.isLoading ? (
                        <div className="flex items-center justify-center py-1">
                          <Loader2 className="w-5 h-5 animate-spin text-white/60" />
                        </div>
                      ) : (
                        <>
                          <MarkdownRenderer content={message.content} />
                          {message.files && message.files.length > 0 ? (
                            <div className="mt-3 grid grid-cols-2 gap-2">
                              {message.files.map((file) => {
                                const fileType = file.type as string;
                                if (fileType === "video") {
                                  return (
                                    <video
                                      key={file.id}
                                      src={asset(file.url)}
                                      controls
                                      muted
                                      className="w-full rounded-lg"
                                    />
                                  );
                                }
                                if (fileType === "image") {
                                  return (
                                    <div key={file.id} className="relative group rounded-lg overflow-hidden">
                                      <img
                                        src={asset(file.url)}
                                        alt={file.name}
                                        className="w-full h-32 object-cover cursor-pointer hover:opacity-90 transition-opacity"
                                        onClick={() => openImagePreview(file.url, file.name)}
                                      />
                                      <div className="absolute bottom-0 left-0 right-0 flex justify-center gap-1 p-1 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                          onClick={() => openImagePreview(file.url, file.name)}
                                          className="px-2 py-0.5 bg-white/20 hover:bg-white/30 rounded text-[10px] text-white"
                                        >
                                          预览
                                        </button>
                                        <button
                                          onClick={() => downloadGenerated(file)}
                                          className="px-2 py-0.5 bg-white/20 hover:bg-white/30 rounded text-[10px] text-white"
                                        >
                                          下载
                                        </button>
                                      </div>
                                    </div>
                                  );
                                }
                                return (
                                  <div
                                    key={file.id}
                                    className="flex flex-col items-center gap-2 p-3 bg-white/5 hover:bg-white/10 rounded-xl transition-colors"
                                  >
                                    <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${file.type === "html" ? "bg-amber-500/20" : "bg-slate-200"}`}>
                                      {file.type === "html" ? (
                                        <Globe className="w-7 h-7 text-amber-500" />
                                      ) : (
                                        <FileText className="w-7 h-7 text-blue-700" />
                                      )}
                                    </div>
                                    <p className="text-xs font-medium text-white/90 truncate w-full text-center">{file.name}</p>
                                    <div className="flex items-center gap-2 w-full justify-center">
                                      {(file.type === "doc" || file.type === "html") && (
                                        <button
                                          onClick={() => {
                                            if (file.type === "html") {
                                              setPreviewHtmlUrl(file.url);
                                            } else {
                                              setPreviewDocUrl(file.url);
                                              setPreviewDocName(file.name);
                                            }
                                          }}
                                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white/80 hover:text-white text-xs transition-colors"
                                          title="预览"
                                        >
                                          <Eye className="w-3.5 h-3.5" />
                                          预览
                                        </button>
                                      )}
                                      <button
                                        onClick={() => downloadGenerated(file)}
                                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white/80 hover:text-white text-xs transition-colors"
                                        title="下载"
                                      >
                                        <Download className="w-3.5 h-3.5" />
                                        下载
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          ) : null}
                        </>
                      )}
                    </div>
                  </div>
                ) : (
                  <div key={message.id} className="flex gap-3">
                    <div className="w-8 h-8 rounded-lg bg-gray-800 flex items-center justify-center flex-shrink-0">
                      <Bot className="w-4 h-4 text-white/70" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="w-full p-3 border border-white/10 rounded-2xl bg-white/5 backdrop-blur-sm">
                        {message.isLoading ? (
                          <div className="flex items-center justify-center py-4">
                            <Loader2 className="w-5 h-5 animate-spin text-white/60" />
                          </div>
                        ) : (
                          <>
                            <MarkdownRenderer content={message.content} />
                            {message.files && message.files.length > 0 ? (
                              <div className="mt-3 grid grid-cols-2 gap-2">
                              {message.files.map((file) => {
                                const fileType = file.type as string;
                                if (fileType === "video") {
                                  return (
                                    <video
                                      key={file.id}
                                      src={asset(file.url)}
                                      controls
                                      autoPlay
                                      muted
                                      loop
                                      className="w-full rounded-lg"
                                    />
                                  );
                                }
                                if (fileType === "image") {
                                    return (
                                      <div key={file.id} className="relative group rounded-lg overflow-hidden">
                                        <img
                                          src={asset(file.url)}
                                          alt={file.name}
                                          className="w-full h-32 object-cover cursor-pointer hover:opacity-90 transition-opacity"
                                          onClick={() => openImagePreview(file.url, file.name)}
                                        />
                                        <div className="absolute bottom-0 left-0 right-0 flex justify-center gap-1 p-1 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                                          <button
                                            onClick={() => openImagePreview(file.url, file.name)}
                                            className="px-2 py-0.5 bg-white/20 hover:bg-white/30 rounded text-[10px] text-white"
                                          >
                                            预览
                                          </button>
                                          <button
                                            onClick={() => downloadGenerated(file)}
                                            className="px-2 py-0.5 bg-white/20 hover:bg-white/30 rounded text-[10px] text-white"
                                          >
                                            下载
                                          </button>
                                        </div>
                                      </div>
                                    );
                                  }
                                  return (
                                    <div
                                      key={file.id}
                                      className="flex flex-col items-center gap-2 p-3 bg-white/5 hover:bg-white/10 rounded-xl transition-colors"
                                    >
                                      <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${fileType === "html" ? "bg-amber-500/20" : "bg-slate-200"}`}>
                                        {fileType === "html" ? (
                                          <Globe className="w-7 h-7 text-amber-500" />
                                        ) : (
                                          <FileText className="w-7 h-7 text-blue-700" />
                                        )}
                                      </div>
                                      <p className="text-xs font-medium text-white/90 truncate w-full text-center">{file.name}</p>
                                      <div className="flex items-center gap-2 w-full justify-center">
                                        {/* 预览按钮 */}
                                        {["doc", "html", "image", "video"].includes(fileType) && (
                                          <button
                                            onClick={() => {
                                              if (fileType === "image") {
                                                openImagePreview(file.url, file.name);
                                              } else if (fileType === "video") {
                                                setPreviewVideoUrl(file.url);
                                                setPreviewVideoName(file.name);
                                              } else if (fileType === "html") {
                                                setPreviewHtmlUrl(file.url);
                                              } else {
                                                setPreviewDocUrl(file.url);
                                                setPreviewDocName(file.name);
                                              }
                                            }}
                                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white/80 hover:text-white text-xs transition-colors"
                                            title="预览"
                                          >
                                            <Eye className="w-3.5 h-3.5" />
                                            预览
                                          </button>
                                        )}
                                        {/* 下载按钮 */}
                                        <button
                                          onClick={() => downloadGenerated(file)}
                                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white/80 hover:text-white text-xs transition-colors"
                                          title="下载"
                                        >
                                          <Download className="w-3.5 h-3.5" />
                                          下载
                                        </button>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            ) : null}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                )
              ))}
            </div>
          </div>

          {/* 底部输入区域 - 固定在底部 */}
          <div className="flex-shrink-0 border-t border-white/10 p-3 bg-[#1a1a1a]">
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3 border border-white/20">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder={placeholder}
                rows={2}
                disabled={isLoading}
                className="w-full bg-transparent text-sm text-white placeholder-white/50 outline-none resize-none min-h-[40px] disabled:opacity-50"
              />
              <div className="flex items-center justify-between mt-2">
                <div className="flex items-center gap-2">
                  {selectedMode ? (
                    <span className="px-2 py-1 bg-white/10 rounded text-xs text-white/70">
                      {MODE_CONFIG[selectedMode].label}
                    </span>
                  ) : (
                    <span className="px-2 py-1 bg-white/5 rounded text-xs text-white/40">
                      请选择模式
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  {selectedMode === "design" || selectedMode === "image" || selectedMode === "video" ? (
                    <>
                      {selectedMode === "design" && (
                        <label className="p-1.5 text-white/50 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer" title="上传文档">
                          <Upload className="w-4 h-4" />
                          <input type="file" accept=".doc,.docx" className="hidden" onChange={(e) => handleFileUpload(e, "doc")} />
                        </label>
                      )}
                      <label className="p-1.5 text-white/50 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer" title="上传图片">
                        <ImageIcon className="w-4 h-4" />
                        <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => handleFileUpload(e, "image")} />
                      </label>
                    </>
                  ) : null}
                  <button
                    onClick={handleSend}
                    disabled={isLoading || !input.trim()}
                    className="p-2 bg-white text-black rounded-full hover:bg-white/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>

            {/* 模式选择按钮 */}
            <div className="flex gap-1.5 mt-2">
              {MODE_LIST.map((mode) => {
                const config = MODE_CONFIG[mode];
                const Icon = config.icon;
                return (
                  <button
                    key={mode}
                    onClick={() => {
                      const isSame = selectedMode === mode;
                      const newMode = isSame ? null : mode;
                      setSelectedMode(newMode);
                      setImageAwaitingConfirm(false);
                      if (newMode) {
                        if (mode === "image") {
                          setInput("生成prompt");
                          toast.success("已切换到 AI 图像模式");
                        } else {
                          setInput(config.command);
                          toast.success(`已切换到 ${config.label} 模式`);
                        }
                      }
                    }}
                    className={`flex-1 px-2 py-2 rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-1 ${
                      selectedMode === mode
                        ? "bg-white/20 text-white border border-white/30"
                        : "bg-white/5 text-white/60 border border-white/10 hover:bg-white/10"
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {config.label}
                  </button>
                );
              })}
            </div>
          </div>
              </>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}

// ============ 默认导出：包裹 Suspense 边界 ============
// Next.js 16 生产构建要求 useSearchParams() 必须在 Suspense 边界内，
// 否则会触发 CSR bailout 导致静态导出失败。

export default function ChatPage() {
  return (
    <React.Suspense fallback={<div className="min-h-screen bg-black" />}>
      <ChatPageInner />
    </React.Suspense>
  );
}
