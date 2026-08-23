"use client";

import { Heart, Bookmark, Copy, User, Trash2, Pencil, Check, X, Video, FileCode, FileText, MessageCircle, ChevronDown, Clock } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export type Domain = "architecture" | "ecommerce" | "comic";
export type ContentType = "design" | "image" | "video" | "html";

export interface WorkItem {
  id: string;
  title: string;
  preview: string;
  domain: Domain;
  contentType: ContentType;
  author: { name: string; avatar?: string };
  likes: number;
  liked?: boolean;
  favorited?: boolean;
  favoriteCount?: number;
  commentCount?: number;
  createdAt?: number;
}

const domainLabels: Record<Domain, string> = {
  architecture: "建筑",
  ecommerce: "电商",
  comic: "漫剧",
};

const domainColors: Record<Domain, string> = {
  architecture: "bg-blue-500/20 text-blue-400",
  ecommerce: "bg-green-500/20 text-green-400",
  comic: "bg-purple-500/20 text-purple-400",
};

const typeLabels: Record<ContentType, string> = {
  design: "设计",
  image: "图像",
  video: "视频",
  html: "网页",
};

function formatWorkDate(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}`;
}

/**
 * 根据 URL 判断实际媒体类型
 * 用于处理 mock 数据（图片URL）与真实上传文件（blob/data URL）的混合场景
 *
 * 注意：blob URL 形如 `blob:http://host/uuid`，没有扩展名，
 * 无法仅凭 URL 判断类型，必须依赖 contentType 兜底。
 */
function detectMediaType(url: string, contentType?: ContentType): "image" | "video" | "html" | "unknown" {
  if (!url) return "unknown";
  // blob URL：无扩展名，按 contentType 兜底（上传时已确定类型）
  if (url.startsWith("blob:")) {
    if (contentType === "image") return "image";
    if (contentType === "video") return "video";
    if (contentType === "html") return "html";
    return "unknown";
  }
  // data URL：根据 MIME 前缀判断
  if (url.startsWith("data:")) {
    if (url.startsWith("data:image/")) return "image";
    if (url.startsWith("data:video/")) return "video";
    if (url.startsWith("data:text/html")) return "html";
    return "unknown";
  }
  // http URL：检查扩展名
  const lower = url.toLowerCase().split("?")[0];
  if (/\.(png|jpg|jpeg|gif|webp|svg)$/.test(lower)) return "image";
  if (/\.(mp4|webm|mov|avi|mkv)$/.test(lower)) return "video";
  if (/\.(html|htm)$/.test(lower)) return "html";
  // 图片占位服务
  if (url.includes("picsum.photos")) return "image";
  // 兜底：按 contentType
  if (contentType === "image") return "image";
  if (contentType === "video") return "video";
  if (contentType === "html") return "html";
  return "unknown";
}

interface WorkCardProps {
  item: WorkItem;
  onLike?: (id: string) => void;
  onFavorite?: (id: string) => void;
  onDelete?: (id: string) => void;
  onRename?: (id: string, newTitle: string) => void;
  onPreview?: (item: WorkItem) => void;
  onComment?: (item: WorkItem) => void;
  onChangeDomain?: (id: string, newDomain: Domain) => void;
  showDomainSelector?: boolean;
  showReuse?: boolean;
  isNew?: boolean;
}

export default function WorkCard({ item, onLike, onFavorite, onDelete, onRename, onPreview, onComment, onChangeDomain, showDomainSelector, showReuse = true, isNew = false }: WorkCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(item.title);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [showDomainMenu, setShowDomainMenu] = useState(false);

  const startEdit = () => {
    setEditTitle(item.title);
    setIsEditing(true);
  };

  const confirmEdit = () => {
    const newTitle = editTitle.trim();
    if (!newTitle) {
      toast.error("标题不能为空");
      return;
    }
    if (newTitle !== item.title) {
      onRename?.(item.id, newTitle);
      toast.success("已重命名");
    }
    setIsEditing(false);
  };

  const cancelEdit = () => {
    setIsEditing(false);
    setEditTitle(item.title);
  };

  const handleReuse = () => {
    toast.success("已复制生成参数，跳转工作台");
  };

  return (
    <div className="group bg-[#222] rounded-xl border border-white/5 overflow-hidden hover:border-white/20 transition-all">
      {/* Preview */}
      <div
        className="relative aspect-[4/3] overflow-hidden bg-[#1a1a1a] cursor-pointer"
        onClick={() => onPreview?.(item)}
      >
        {/* 未读 NEW 角标 */}
        {isNew && (
          <span className="absolute top-3 left-3 px-2 py-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full z-10 shadow-md">
            NEW
          </span>
        )}
        {/* 根据内容类型渲染缩略图 */}
        {item.contentType === "image" && (
          <img
            src={item.preview}
            alt={item.title}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        )}
        {item.contentType === "video" && (() => {
          const mediaType = detectMediaType(item.preview, item.contentType);
          // 真实视频文件：用 video 标签显示第一帧
          if (mediaType === "video") {
            return (
              <>
                <video
                  src={item.preview}
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                  muted
                  preload="metadata"
                />
                <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/20 transition-colors">
                  <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center shadow-lg">
                    <Video className="w-5 h-5 text-black ml-0.5" />
                  </div>
                </div>
              </>
            );
          }
          // mock 数据（图片URL）：用 img 显示作为视频封面
          return (
            <>
              <img
                src={item.preview}
                alt={item.title}
                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
              />
              <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/20 transition-colors">
                <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center shadow-lg">
                  <Video className="w-5 h-5 text-black ml-0.5" />
                </div>
              </div>
            </>
          );
        })()}
        {item.contentType === "html" && (() => {
          const mediaType = detectMediaType(item.preview, item.contentType);
          // 真实 HTML 文件：用 iframe 渲染
          if (mediaType === "html") {
            return (
              <>
                <iframe
                  src={item.preview}
                  title={item.title}
                  className="w-full h-full border-0 bg-white pointer-events-none"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-transparent group-hover:bg-black/10 transition-colors flex items-center justify-center">
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity w-12 h-12 rounded-full bg-white/90 flex items-center justify-center shadow-lg">
                    <FileCode className="w-5 h-5 text-black" />
                  </div>
                </div>
              </>
            );
          }
          // mock 数据（图片URL）：用 img 显示作为网页截图
          return (
            <>
              <img
                src={item.preview}
                alt={item.title}
                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-transparent group-hover:bg-black/10 transition-colors flex items-center justify-center">
                <div className="opacity-0 group-hover:opacity-100 transition-opacity w-12 h-12 rounded-full bg-white/90 flex items-center justify-center shadow-lg">
                  <FileCode className="w-5 h-5 text-black" />
                </div>
              </div>
            </>
          );
        })()}
        {item.contentType === "design" && (
          <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-blue-500/10 to-purple-500/10">
            <FileText className="w-10 h-10 text-blue-400/60 mb-2" />
            <span className="text-xs text-white/40">文档作品</span>
          </div>
        )}

        {/* Domain tag (clickable for profile page) */}
        {showDomainSelector && onChangeDomain ? (
          <div className="absolute top-3 left-3 z-10" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={(e) => { e.stopPropagation(); setShowDomainMenu(!showDomainMenu); }}
              className={`px-2 py-0.5 rounded text-[10px] font-medium flex items-center gap-1 ${domainColors[item.domain]}`}
            >
              {domainLabels[item.domain]}
              <ChevronDown className={`w-3 h-3 transition-transform ${showDomainMenu ? "rotate-180" : ""}`} />
            </button>
            {showDomainMenu && (
              <>
                <div className="fixed inset-0 z-20" onClick={() => setShowDomainMenu(false)} />
                <div className="absolute top-full left-0 mt-1 min-w-[100px] rounded-lg bg-[#1a1a1a] border border-white/10 shadow-xl overflow-hidden z-30">
                  {(Object.keys(domainLabels) as Domain[]).map((d) => (
                    <button
                      key={d}
                      onClick={(e) => {
                        e.stopPropagation();
                        onChangeDomain(item.id, d);
                        setShowDomainMenu(false);
                      }}
                      className={`w-full text-left px-3 py-2 text-xs hover:bg-white/10 transition-colors ${
                        item.domain === d ? "text-white font-medium" : "text-white/60"
                      }`}
                    >
                      {domainLabels[d]}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        ) : (
          <span
            className={`absolute top-3 left-3 px-2 py-0.5 rounded text-[10px] font-medium ${domainColors[item.domain]}`}
          >
            {domainLabels[item.domain]}
          </span>
        )}

        {/* Content type tag */}
        <span className="absolute top-3 right-3 px-2 py-0.5 rounded text-[10px] font-medium bg-black/50 text-white/70 backdrop-blur-sm">
          {typeLabels[item.contentType]}
        </span>
      </div>

      {/* Info */}
      <div className="p-3">
        {isEditing ? (
          <div className="flex items-center gap-1 mb-2">
            <input
              autoFocus
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") confirmEdit();
                if (e.key === "Escape") cancelEdit();
              }}
              className="flex-1 min-w-0 px-2 py-1 bg-white/10 border border-white/20 rounded text-sm text-white outline-none focus:border-white/40"
            />
            <button
              onClick={confirmEdit}
              className="p-1 hover:bg-white/10 rounded text-green-400"
              title="确认"
            >
              <Check className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={cancelEdit}
              className="p-1 hover:bg-white/10 rounded text-white/50"
              title="取消"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-1 mb-2 group/title">
            <h3 className="text-sm font-medium text-white truncate flex-1">{item.title}</h3>
            {onRename && (
              <button
                onClick={startEdit}
                className="opacity-0 group-hover/title:opacity-100 p-1 hover:bg-white/10 rounded text-white/40 hover:text-white transition-all flex-shrink-0"
                title="重命名"
              >
                <Pencil className="w-3 h-3" />
              </button>
            )}
          </div>
        )}

        <div className="flex items-center justify-between">
          {/* Author */}
          <div className="flex items-center gap-1.5 min-w-0">
            <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
              {item.author.avatar ? (
                <img
                  src={item.author.avatar}
                  alt={item.author.name}
                  className="w-full h-full rounded-full object-cover"
                />
              ) : (
                <User className="w-3.5 h-3.5 text-white/60" />
              )}
            </div>
            <span className="text-xs text-white/60 truncate">{item.author.name}</span>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* 点赞 */}
            <button
              onClick={() => onLike?.(item.id)}
              className={`flex items-center gap-1 text-xs transition-colors ${
                item.liked ? "text-red-400" : "text-white/40 hover:text-red-400"
              }`}
            >
              <Heart className={`w-3.5 h-3.5 ${item.liked ? "fill-red-400" : ""}`} />
              <span>{item.likes}</span>
            </button>

            {/* 收藏 */}
            <button
              onClick={() => onFavorite?.(item.id)}
              className={`flex items-center gap-1 text-xs transition-colors ${
                item.favorited ? "text-yellow-400" : "text-white/40 hover:text-yellow-400"
              }`}
            >
              <Bookmark className={`w-3.5 h-3.5 ${item.favorited ? "fill-yellow-400" : ""}`} />
              <span>{item.favoriteCount ?? 0}</span>
            </button>

            {/* 评论 */}
            {onComment && (
              <button
                onClick={() => onComment(item)}
                className="flex items-center gap-1 text-xs text-white/40 hover:text-blue-400 transition-colors"
                title="评论"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                <span>{item.commentCount ?? 0}</span>
              </button>
            )}

            {showReuse && (
              <button
                onClick={handleReuse}
                className="flex items-center gap-1 px-2 py-1 bg-white/10 hover:bg-white/20 text-white/70 hover:text-white rounded-lg text-xs transition-colors"
                title="复用"
              >
                <Copy className="w-3 h-3" />
                <span>复用</span>
              </button>
            )}

            {onDelete && (
              <button
                onClick={() => onDelete(item.id)}
                className="flex items-center gap-1 px-2 py-1 bg-white/5 hover:bg-red-500/20 text-white/40 hover:text-red-400 rounded-lg text-xs transition-colors"
                title="删除"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
