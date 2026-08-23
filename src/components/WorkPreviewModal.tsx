"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { X, Heart, Bookmark, MessageCircle, Clock, User, Download, Share2, Flag, ZoomIn, ZoomOut, RotateCcw, Loader2, FileText, Shield } from "lucide-react";
import type { WorkItem } from "@/components/WorkCard";

interface Comment {
  id: string;
  workId: string;
  user: string;
  text: string;
  createdAt: number;
}

interface WorkPreviewModalProps {
  item: WorkItem;
  onClose: () => void;
  onLike?: (id: string) => void;
  onFavorite?: (id: string) => void;
}

const COMMENT_STORAGE_KEY = "aga-work-preview-comments";

const LICENSE_INFO: Record<string, { name: string; description: string; type: string }> = {
  architecture: {
    name: "CC BY-NC 4.0",
    description: "可在注明出处、非商业用途下自由使用",
    type: "开放授权",
  },
  ecommerce: {
    name: "商用授权",
    description: "仅限购买者本人用于商业用途，不可二次转售",
    type: "商业许可",
  },
  comic: {
    name: "CC BY 4.0",
    description: "可在注明出处条件下自由使用，包括商业用途",
    type: "开放授权",
  },
};

function formatWorkDate(timestamp: number): string {
  const d = new Date(timestamp);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}.${m}.${day}`;
}

function formatCommentTime(ts: number): string {
  const now = Date.now();
  const diff = now - ts;
  if (diff < 60000) return "刚刚";
  if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)} 天前`;
  return formatWorkDate(ts);
}

function getLicense(item: WorkItem) {
  return LICENSE_INFO[item.domain] || { name: "CC BY-NC 4.0", description: "可在注明出处、非商业用途下自由使用", type: "开放授权" };
}

export default function WorkPreviewModal({ item, onClose, onLike, onFavorite }: WorkPreviewModalProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState("");
  const [showFullLicense, setShowFullLicense] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(COMMENT_STORAGE_KEY);
      const all: Comment[] = raw ? JSON.parse(raw) : [];
      setComments(all.filter((c) => c.workId === item.id));
    } catch {
      setComments([]);
    }
  }, [item.id]);

  const persistComments = useCallback((next: Comment[]) => {
    try {
      const raw = localStorage.getItem(COMMENT_STORAGE_KEY);
      const all: Comment[] = raw ? JSON.parse(raw) : [];
      const others = all.filter((c) => c.workId !== item.id);
      const merged = [...next, ...others];
      localStorage.setItem(COMMENT_STORAGE_KEY, JSON.stringify(merged));
    } catch { /* ignore */ }
  }, [item.id]);

  const submitComment = () => {
    if (!commentText.trim()) return;
    const newComment: Comment = {
      id: `c-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      workId: item.id,
      user: "我",
      text: commentText.trim(),
      createdAt: Date.now(),
    };
    const next = [newComment, ...comments];
    setComments(next);
    persistComments(next);
    setCommentText("");
  };

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const license = getLicense(item);
  const commentCount = item.commentCount ?? comments.length;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 sm:p-8"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-6xl h-[90vh] bg-[#121212] rounded-2xl shadow-2xl border border-white/10 overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-10 p-2 rounded-lg hover:bg-white/10 text-white/60 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex flex-1 min-h-0 flex-col md:flex-row">
          {/* Left: Media Preview */}
          <div className="flex-1 min-h-0 bg-black/40 flex items-center justify-center p-4">
            {item.contentType === "video" ? (
              <VideoContent url={item.preview} />
            ) : (
              <ImageContent url={item.preview} name={item.title} />
            )}
          </div>

          {/* Right: Info Panel */}
          <div className="w-full md:w-[380px] flex-shrink-0 bg-[#161616] border-t md:border-t-0 md:border-l border-white/10 flex flex-col min-h-0">
            <div className="flex-1 overflow-y-auto">
              {/* Author & Title */}
              <div className="p-5 border-b border-white/10">
                <h2 className="text-lg font-semibold text-white mb-4">{item.title}</h2>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white text-sm font-medium overflow-hidden">
                    {item.author.avatar ? (
                      <img src={item.author.avatar} alt={item.author.name} className="w-full h-full object-cover" />
                    ) : (
                      <User className="w-5 h-5" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{item.author.name}</p>
                    <p className="text-xs text-white/40 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {item.createdAt ? formatWorkDate(item.createdAt) : ""}
                    </p>
                  </div>
                  <button className="px-3 py-1.5 rounded-full bg-white text-black text-xs font-medium hover:bg-white/90 transition-colors">
                    关注
                  </button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="px-5 py-4 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onLike?.(item.id)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                      item.liked
                        ? "bg-red-500/20 text-red-400 border border-red-500/30"
                        : "bg-white/5 text-white/70 border border-white/10 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    <Heart className={`w-4 h-4 ${item.liked ? "fill-red-400" : ""}`} />
                    <span>{item.likes}</span>
                  </button>
                  <button
                    onClick={() => onFavorite?.(item.id)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                      item.favorited
                        ? "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30"
                        : "bg-white/5 text-white/70 border border-white/10 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    <Bookmark className={`w-4 h-4 ${item.favorited ? "fill-yellow-400" : ""}`} />
                    <span>{item.favoriteCount ?? 0}</span>
                  </button>
                  <button className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/5 text-white/70 border border-white/10 hover:bg-white/10 hover:text-white text-sm font-medium transition-all">
                    <Share2 className="w-4 h-4" />
                    <span>分享</span>
                  </button>
                  <button className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/5 text-white/70 border border-white/10 hover:bg-white/10 hover:text-white text-sm font-medium transition-all">
                    <Download className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Authorization / License */}
              <div className="px-5 py-4 border-b border-white/10">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/15 flex items-center justify-center flex-shrink-0">
                    <Shield className="w-4 h-4 text-blue-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-white">{license.name}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 font-medium">
                        {license.type}
                      </span>
                    </div>
                    <p className="text-xs text-white/50 leading-relaxed">
                      {showFullLicense ? license.description : license.description.slice(0, 30) + (license.description.length > 30 ? "..." : "")}
                    </p>
                    {license.description.length > 30 && (
                      <button
                        onClick={() => setShowFullLicense(!showFullLicense)}
                        className="text-xs text-blue-400 hover:text-blue-300 mt-1"
                      >
                        {showFullLicense ? "收起" : "展开详情"}
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Comments Section */}
              <div className="px-5 py-4">
                <div className="flex items-center gap-2 mb-4">
                  <MessageCircle className="w-4 h-4 text-white/50" />
                  <h3 className="text-sm font-medium text-white">评论</h3>
                  <span className="text-xs text-white/40">({commentCount})</span>
                </div>

                {/* Comment Input */}
                <div className="mb-4">
                  <textarea
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    placeholder="写下你的评论..."
                    className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-white/30 resize-none focus:outline-none focus:border-white/20 focus:bg-white/10 transition-colors"
                    rows={2}
                  />
                  <div className="flex justify-end mt-2">
                    <button
                      onClick={submitComment}
                      disabled={!commentText.trim()}
                      className="px-4 py-1.5 rounded-lg bg-white text-black text-xs font-medium hover:bg-white/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      发布评论
                    </button>
                  </div>
                </div>

                {/* Comment List */}
                <div className="space-y-3 max-h-[200px] overflow-y-auto">
                  {comments.length === 0 ? (
                    <p className="text-xs text-white/30 text-center py-4">暂无评论，快来发表第一条评论</p>
                  ) : (
                    comments.map((c) => (
                      <div key={c.id} className="flex items-start gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-gray-500 to-gray-600 flex items-center justify-center text-white text-[10px] font-medium flex-shrink-0">
                          {c.user.slice(0, 1)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <span className="text-xs font-medium text-white">{c.user}</span>
                            <span className="text-[10px] text-white/30">{formatCommentTime(c.createdAt)}</span>
                          </div>
                          <p className="text-xs text-white/70 leading-relaxed break-words">{c.text}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ImageContent({ url, name }: { url: string; name: string }) {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const MIN_ZOOM = 0.5;
  const MAX_ZOOM = 5;

  const resetView = useCallback(() => { setZoom(1); setPan({ x: 0, y: 0 }); }, []);
  const zoomIn = useCallback(() => setZoom((z) => Math.min(MAX_ZOOM, +(z + 0.25).toFixed(2))), []);
  const zoomOut = useCallback(() => setZoom((z) => { const next = Math.max(MIN_ZOOM, +(z - 0.25).toFixed(2)); if (next === 1) setPan({ x: 0, y: 0 }); return next; }), []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.15 : 0.15;
    setZoom((z) => { const next = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, +(z + delta).toFixed(2))); if (next === 1) setPan({ x: 0, y: 0 }); return next; });
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (zoom <= 1) return;
    e.preventDefault();
    setIsDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
  }, [zoom, pan]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging) return;
    setPan({ x: dragStart.current.panX + e.clientX - dragStart.current.x, y: dragStart.current.panY + e.clientY - dragStart.current.y });
  }, [isDragging]);

  return (
    <div
      className="relative w-full h-full flex items-center justify-center overflow-hidden"
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={() => setIsDragging(false)}
      onMouseLeave={() => setIsDragging(false)}
      style={{ cursor: zoom > 1 ? (isDragging ? "grabbing" : "grab") : "default" }}
    >
      <img
        src={url}
        alt={name}
        draggable={false}
        className="max-w-full max-h-full object-contain rounded-lg shadow-2xl select-none"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transition: isDragging ? "none" : "transform 0.15s ease-out",
        }}
      />
      <div className="absolute bottom-4 right-4 flex items-center gap-1 bg-black/60 backdrop-blur-sm rounded-lg p-1 border border-white/10">
        <button onClick={zoomOut} disabled={zoom <= MIN_ZOOM} className="p-1.5 rounded hover:bg-white/15 text-white/80 hover:text-white transition-colors disabled:opacity-30">
          <ZoomOut className="w-4 h-4" />
        </button>
        <span className="text-xs text-white/80 px-2 min-w-[3rem] text-center tabular-nums">{Math.round(zoom * 100)}%</span>
        <button onClick={zoomIn} disabled={zoom >= MAX_ZOOM} className="p-1.5 rounded hover:bg-white/15 text-white/80 hover:text-white transition-colors disabled:opacity-30">
          <ZoomIn className="w-4 h-4" />
        </button>
        <div className="w-px h-5 bg-white/15 mx-0.5" />
        <button onClick={resetView} className="p-1.5 rounded hover:bg-white/15 text-white/80 hover:text-white transition-colors">
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

function VideoContent({ url }: { url: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  return (
    <div className="relative w-full h-full flex items-center justify-center">
      {status === "loading" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-white/40" />
          <p className="text-sm text-white/60">视频加载中...</p>
        </div>
      )}
      {status === "error" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-8 text-center">
          <FileText className="w-12 h-12 text-white/20" />
          <p className="text-sm text-red-400">视频加载失败</p>
        </div>
      )}
      <video
        ref={videoRef}
        src={url}
        controls
        autoPlay
        playsInline
        preload="metadata"
        onLoadedData={() => setStatus("ready")}
        onError={() => setStatus("error")}
        className={`max-w-full max-h-full object-contain rounded-lg shadow-2xl ${status === "ready" ? "" : "opacity-0 absolute"}`}
      />
    </div>
  );
}
