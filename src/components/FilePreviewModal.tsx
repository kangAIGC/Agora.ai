"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Download, X, Maximize2, Loader2, FileText, ZoomIn, ZoomOut, RotateCcw, Maximize } from "lucide-react";

type FileType = "image" | "video" | "html" | "doc";

interface FilePreviewModalProps {
  url: string;
  name: string;
  type: FileType;
  onClose: () => void;
}

const titleMap: Record<FileType, string> = {
  image: "图片预览",
  video: "视频预览",
  html: "网页预览",
  doc: "文档预览",
};

/**
 * 统一的文件预览弹窗组件
 * 支持图片（含缩放）、视频、HTML、文档（doc/docx/pdf）的预览
 * 视觉风格与画布预览保持一致：浮动卡片 + 半透明蒙版（底层可见）
 */
export default function FilePreviewModal({ url, name, type, onClose }: FilePreviewModalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Esc 键关闭 / 退出全屏
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (document.fullscreenElement) {
          document.exitFullscreen().catch(() => {});
        } else {
          onClose();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // 监听全屏状态变化
  useEffect(() => {
    const handleFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handleFsChange);
    return () => document.removeEventListener("fullscreenchange", handleFsChange);
  }, []);

  // 切换全屏
  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      containerRef.current.requestFullscreen().catch(() => {});
    }
  }, []);

  // 容器尺寸根据类型调整（与画布预览一致）
  const containerMaxWidth = type === "html" ? "max-w-5xl" : "max-w-4xl";
  const containerHeight = type === "html" ? "h-[85vh]" : "h-[80vh]";

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4 sm:p-8"
      onClick={onClose}
    >
      <div
        ref={containerRef}
        className={`relative w-full ${containerMaxWidth} ${isFullscreen ? "h-screen" : containerHeight} bg-[#1a1a1a] rounded-xl shadow-2xl border border-white/15 flex flex-col overflow-hidden`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 顶部工具栏 */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/10 bg-white/5 flex-shrink-0">
          <p className="text-sm text-white/70 truncate flex-1 mr-3">{name || titleMap[type]}</p>
          <div className="flex items-center gap-1">
            {/* HTML 新标签页打开 */}
            {type === "html" && (
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg hover:bg-white/10 text-white/70 hover:text-white text-xs transition-colors"
                title="在新标签页打开"
              >
                <Maximize2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">新标签打开</span>
              </a>
            )}
            {/* 下载按钮 */}
            <a
              href={url}
              download={name || undefined}
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg hover:bg-white/10 text-white/70 hover:text-white text-xs transition-colors"
              title={`下载${titleMap[type].replace("预览", "")}`}
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">下载</span>
            </a>
            {/* 全屏按钮 */}
            <button
              onClick={toggleFullscreen}
              className="p-1.5 rounded-lg hover:bg-white/10 text-white/70 hover:text-white transition-colors"
              title={isFullscreen ? "退出全屏 (Esc)" : "全屏"}
            >
              <Maximize className="w-4 h-4" />
            </button>
            {/* 关闭按钮 */}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-white/10 text-white/70 hover:text-white transition-colors"
              title="关闭 (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 预览内容区 */}
        <div className="flex-1 min-h-0 relative">
          {type === "image" && <ImagePreviewContent url={url} name={name} />}
          {type === "video" && (
            <div className="absolute inset-0 bg-black flex items-center justify-center p-4">
              <VideoPreviewContent url={url} />
            </div>
          )}
          {type === "html" && (
            <div className="absolute inset-0 bg-white">
              <iframe
                src={url}
                title="网页预览"
                className="w-full h-full border-0 bg-white"
              />
            </div>
          )}
          {type === "doc" && <DocPreviewContent url={url} name={name} />}
        </div>
      </div>
    </div>
  );
}

/**
 * 图片预览内容：支持滚轮缩放、按钮缩放、拖动平移、双击重置
 */
function ImagePreviewContent({ url, name }: { url: string; name: string }) {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });

  const MIN_ZOOM = 0.5;
  const MAX_ZOOM = 5;

  const resetView = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  const zoomIn = useCallback(() => {
    setZoom((z) => Math.min(MAX_ZOOM, +(z + 0.25).toFixed(2)));
  }, []);

  const zoomOut = useCallback(() => {
    setZoom((z) => {
      const next = Math.max(MIN_ZOOM, +(z - 0.25).toFixed(2));
      if (next === 1) setPan({ x: 0, y: 0 });
      return next;
    });
  }, []);

  // 滚轮缩放
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.15 : 0.15;
    setZoom((z) => {
      const next = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, +(z + delta).toFixed(2)));
      if (next === 1) setPan({ x: 0, y: 0 });
      return next;
    });
  }, []);

  // 拖动平移（仅在放大时生效）
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (zoom <= 1) return;
    e.preventDefault();
    setIsDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
  }, [zoom, pan]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    setPan({ x: dragStart.current.panX + dx, y: dragStart.current.panY + dy });
  }, [isDragging]);

  const handleMouseUp = useCallback(() => setIsDragging(false), []);

  // 双击重置/放大
  const handleDoubleClick = useCallback(() => {
    setZoom((z) => {
      if (z !== 1) {
        setPan({ x: 0, y: 0 });
        return 1;
      }
      return 2;
    });
  }, []);

  return (
    <div
      className="absolute inset-0 bg-black/60 flex items-center justify-center overflow-hidden"
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onDoubleClick={handleDoubleClick}
      style={{ cursor: zoom > 1 ? (isDragging ? "grabbing" : "grab") : "default" }}
    >
      <img
        src={url}
        alt={name || "预览"}
        draggable={false}
        className="max-w-full max-h-full object-contain rounded-lg shadow-2xl select-none"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transition: isDragging ? "none" : "transform 0.15s ease-out",
        }}
      />

      {/* 缩放控制工具栏（右下角） */}
      <div className="absolute bottom-4 right-4 flex items-center gap-1 bg-black/60 backdrop-blur-sm rounded-lg p-1 border border-white/10">
        <button
          onClick={zoomOut}
          disabled={zoom <= MIN_ZOOM}
          className="p-1.5 rounded hover:bg-white/15 text-white/80 hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          title="缩小"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <span className="text-xs text-white/80 px-2 min-w-[3rem] text-center tabular-nums">
          {Math.round(zoom * 100)}%
        </span>
        <button
          onClick={zoomIn}
          disabled={zoom >= MAX_ZOOM}
          className="p-1.5 rounded hover:bg-white/15 text-white/80 hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          title="放大"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <div className="w-px h-5 bg-white/15 mx-0.5" />
        <button
          onClick={resetView}
          disabled={zoom === 1 && pan.x === 0 && pan.y === 0}
          className="p-1.5 rounded hover:bg-white/15 text-white/80 hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          title="重置"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>

      {/* 操作提示（左下角，仅初始显示） */}
      {zoom === 1 && (
        <div className="absolute bottom-4 left-4 text-[11px] text-white/40 pointer-events-none">
          滚轮缩放 · 双击放大 · 拖动平移
        </div>
      )}
    </div>
  );
}

/**
 * 视频预览内容
 * - preload="metadata" + playsInline 兼容移动端并加快首帧
 * - loadeddata 后跳到 0.1s 强制渲染首帧（部分浏览器需此才能显示画面）
 * - onError 给出明确反馈，避免用户误以为"上传失败"
 */
function VideoPreviewContent({ url }: { url: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState<string>("");

  const handleLoadedData = useCallback(() => {
    setStatus("ready");
    // 某些浏览器需要主动 seek 才能渲染首帧画面
    const v = videoRef.current;
    if (v && v.currentTime === 0) {
      try { v.currentTime = 0.1; } catch { /* ignore */ }
    }
  }, []);

  const handleError = useCallback(() => {
    setStatus("error");
    setErrorMsg("视频加载失败，可能为不支持的编码格式或文件损坏");
  }, []);

  return (
    <div className="absolute inset-0 flex items-center justify-center">
      {status === "loading" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-white/40" />
          <p className="text-sm text-white/60">视频加载中...</p>
        </div>
      )}
      {status === "error" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-8 text-center">
          <FileText className="w-12 h-12 text-white/20" />
          <p className="text-sm text-red-400">{errorMsg}</p>
          <p className="text-xs text-white/40">请尝试下载原文件使用本地播放器查看</p>
        </div>
      )}
      <video
        ref={videoRef}
        src={url}
        controls
        autoPlay
        playsInline
        preload="metadata"
        onLoadedData={handleLoadedData}
        onError={handleError}
        className={`max-w-full max-h-full object-contain rounded-lg shadow-2xl bg-black ${status === "ready" ? "" : "opacity-0 absolute"}`}
      />
    </div>
  );
}

/**
 * 文档预览内容（支持 doc/docx 转 PDF，pdf 直接显示）
 */
function DocPreviewContent({ url, name }: { url: string; name: string }) {
  const lowerName = name.toLowerCase();
  const isDocFile = lowerName.endsWith(".doc") || lowerName.endsWith(".docx");
  const isPdfFile = lowerName.endsWith(".pdf");

  const [convertedPdfUrl, setConvertedPdfUrl] = useState<string | null>(null);
  const [convertError, setConvertError] = useState<string | null>(null);

  useEffect(() => {
    if (!isDocFile) return;
    let revoked = false;

    (async () => {
      try {
        const resp = await fetch(url);
        if (!resp.ok) throw new Error(`文件获取失败 (${resp.status})`);
        const blob = await resp.blob();
        const file = new File([blob], name, { type: blob.type });

        // 静态模式：使用客户端 mock 替代服务端 doc2pdf
        const { mockDoc2Pdf } = await import("@/lib/client-mock");
        const result = await mockDoc2Pdf(file);
        if (!result.available) {
          throw new Error(result.reason);
        }
      } catch (err) {
        if (!revoked) {
          setConvertError(err instanceof Error ? err.message : "转换失败");
        }
      }
    })();

    return () => {
      revoked = true;
    };
  }, [isDocFile, url, name]);

  // 卸载时释放 blob URL
  useEffect(() => {
    return () => {
      if (convertedPdfUrl) URL.revokeObjectURL(convertedPdfUrl);
    };
  }, [convertedPdfUrl]);

  const finalPdfUrl = isPdfFile ? url : isDocFile ? convertedPdfUrl : url;
  const isLoading = isDocFile && !convertedPdfUrl && !convertError;

  return (
    <div className="absolute inset-0 bg-white">
      {isLoading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#1a1a1a]">
          <Loader2 className="w-8 h-8 animate-spin text-white/40" />
          <p className="text-sm text-white/60">正在转换为 PDF...</p>
        </div>
      )}
      {convertError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#1a1a1a] p-8">
          <FileText className="w-12 h-12 text-white/20" />
          <p className="text-sm text-red-400">转换失败：{convertError}</p>
          <p className="text-xs text-white/40">请尝试下载原文件查看</p>
        </div>
      )}
      {finalPdfUrl && !isLoading && !convertError && (
        <iframe
          src={finalPdfUrl}
          title="文档预览"
          className="w-full h-full border-0"
        />
      )}
    </div>
  );
}
