"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { Compass, Upload, X, Loader2, ArrowUpDown, ChevronDown, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import WorkCard, { type WorkItem, type Domain, type ContentType } from "@/components/WorkCard";
import WorkPreviewModal from "@/components/WorkPreviewModal";
import {
  saveWork,
  updateWork,
  deleteWork,
  getWorksByScope,
  getFileBlobs,
  getDeletedMockIds,
  addDeletedMockId,
  clearDeletedMockIds,
  type StoredWork,
  type WorkScope,
} from "@/lib/ugc-storage";
import { runGlobalAppSeed } from "@/lib/app-seed";
import {
  PERMANENT_ECOMMERCE_WORKS,
  isPermanentEcommerceWork,
  seedPermanentEcommerceWorks,
  validatePermanentEcommerceWorks,
} from "@/lib/ecommerce-permanent";
import {
  PERMANENT_COMIC_WORKS,
  isPermanentComicWork,
  seedPermanentComicWorks,
  validatePermanentComicWorks,
} from "@/lib/comic-permanent";
import {
  PERMANENT_ARCHITECTURE_WORKS,
  isPermanentArchitectureWork,
  seedPermanentArchitectureWorks,
  validatePermanentArchitectureWorks,
} from "@/lib/architecture-permanent";
import {
  loadDiscoverState,
  saveDiscoverState,
  type DiscoverState,
} from "@/lib/discover-state";

// ============ Mock 数据：初始作品列表 ============
// 仅保留 image / video 两类作品，与筛选器（全部/图像/视频）对齐

const MOCK_WORKS: WorkItem[] = [
  // 建筑永久作品（8 图 + 4 视频）已迁移至 @/lib/architecture-permanent.ts
  // 此处不再保留建筑 mock 数据，避免无关占位内容混入展示

  // 电商永久作品（4 图 + 5 视频）已迁移至 @/lib/ecommerce-permanent.ts
  // 此处不再保留电商 mock 数据，避免无关占位内容混入展示

  // 漫剧永久作品（9 图 + 1 视频）已迁移至 @/lib/comic-permanent.ts
  // 此处不再保留漫剧 mock 数据，避免无关占位内容混入展示
];

const DOMAINS: { key: Domain; label: string }[] = [
  { key: "architecture", label: "建筑" },
  { key: "ecommerce", label: "电商" },
  { key: "comic", label: "漫剧" },
];

const CONTENT_TYPES: { key: ContentType | null; label: string }[] = [
  { key: null, label: "全部" },
  { key: "image", label: "图像" },
  { key: "video", label: "视频" },
  { key: "workflow", label: "工作流" },
];

export default function DiscoverPage() {
  const [activeDomain, setActiveDomain] = useState<Domain>("architecture");
  const [activeType, setActiveType] = useState<ContentType | null>(null);
  const [sortBy, setSortBy] = useState<"recommend" | "hot">("recommend");
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  // 上传弹窗与输入状态（提前声明，供状态保存 effect 引用）
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadTitle, setUploadTitle] = useState("");
  // 已预览（已读）的作品 ID 集合 — 从 localStorage 恢复，预览时追加
  const [viewedIds, setViewedIds] = useState<Set<string>>(new Set());
  // 标记初始数据加载完成，用于触发滚动位置恢复
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);

  // 作品列表：初始用永久建筑 + 电商 + 漫剧数据 + Mock 数据，异步从 IndexedDB 加载用户上传作品后合并
  const [works, setWorks] = useState<WorkItem[]>([
    ...PERMANENT_ARCHITECTURE_WORKS,
    ...PERMANENT_ECOMMERCE_WORKS,
    ...PERMANENT_COMIC_WORKS,
    ...MOCK_WORKS,
  ]);
  const blobUrlsRef = useRef<Set<string>>(new Set());

  // 初始化：触发全局 seed，然后从 IndexedDB 加载社区模块作品 + Mock 合并
  useEffect(() => {
    (async () => {
      try {
        // 恢复上次保存的筛选/UI状态
        const savedState = loadDiscoverState();
        if (savedState) {
          if (savedState.activeDomain) setActiveDomain(savedState.activeDomain);
          if (savedState.activeType !== undefined) setActiveType(savedState.activeType);
          if (savedState.sortBy) setSortBy(savedState.sortBy);
          if (savedState.sortMenuOpen !== undefined) setSortMenuOpen(savedState.sortMenuOpen);
          if (savedState.showUploadModal !== undefined) setShowUploadModal(savedState.showUploadModal);
          if (savedState.uploadTitle !== undefined) setUploadTitle(savedState.uploadTitle);
          if (savedState.viewedIds) setViewedIds(new Set(savedState.viewedIds));
        }
        // 保存的交互状态（点赞/收藏），用于恢复到永久作品
        const savedLiked = new Set<string>(savedState?.likedIds ?? []);
        const savedFavorited = new Set<string>(savedState?.favoritedIds ?? []);

        await runGlobalAppSeed();
        // 种子永久电商作品到 IndexedDB（数据库留存），源码数组仍是展示数据源
        await seedPermanentEcommerceWorks().catch(() => {});
        // 验证永久数据集数量一致性：恰好 4 图 + 5 视频
        const validation = validatePermanentEcommerceWorks();
        if (!validation.valid) {
          console.warn("[ecommerce-permanent] 永久数据集数量异常:", validation);
        }
        // 种子永久漫剧作品到 IndexedDB（数据库留存），源码数组仍是展示数据源
        await seedPermanentComicWorks().catch(() => {});
        // 验证永久漫剧数据集数量一致性：恰好 9 图 + 1 视频
        const comicValidation = validatePermanentComicWorks();
        if (!comicValidation.valid) {
          console.warn("[comic-permanent] 永久数据集数量异常:", comicValidation);
        }
        // 种子永久建筑作品到 IndexedDB（数据库留存），源码数组仍是展示数据源
        await seedPermanentArchitectureWorks().catch(() => {});
        // 验证永久建筑数据集数量一致性：恰好 8 图 + 4 视频
        const archValidation = validatePermanentArchitectureWorks();
        if (!archValidation.valid) {
          console.warn("[architecture-permanent] 永久数据集数量异常:", archValidation);
        }

        const [deletedMockIds, storedWorks] = await Promise.all([
          getDeletedMockIds().catch(() => [] as string[]),
          getWorksByScope("community").catch(() => [] as StoredWork[]),
        ]);

        const deletedSet = new Set(deletedMockIds);
        const filterDeleted = (works: WorkItem[]) =>
          works.filter((w) => !deletedSet.has(w.id));
        const remainingMocks = filterDeleted(MOCK_WORKS);

        // 仅保留真正的用户上传作品（ID 以 "upload-" 开头）
        const userStoredWorks = storedWorks.filter(
          (w) => w.id.startsWith("upload-")
        );

        userStoredWorks.sort((a, b) => b.createdAt - a.createdAt);
        const blobs: Map<string, Blob> = await getFileBlobs(
          userStoredWorks.map((w) => w.id),
        ).catch(() => new Map());

        // 为新上传作品生成虚构的互动数据（如果为0）
        const seedEngagement = (work: StoredWork) => {
          if (work.likes === 0 || work.likes == null) {
            const hash = [...work.id].reduce((acc, c) => acc + c.charCodeAt(0), 0);
            const likes = 8 + (hash % 50);
            const favCount = 2 + (hash % 15);
            const cmCount = 1 + (hash % 8);
            return { likes, favoriteCount: favCount, commentCount: cmCount };
          }
          return {
            likes: work.likes,
            favoriteCount: work.favoriteCount ?? 0,
            commentCount: work.commentCount ?? 0,
          };
        };

        const userWorks: WorkItem[] = userStoredWorks
          .map((w) => {
            const blob = blobs.get(w.id);
            const preview = blob
              ? (() => {
                  const url = URL.createObjectURL(blob);
                  blobUrlsRef.current.add(url);
                  return url;
                })()
              : w.previewUrl;
            if (!preview) return null;
            const engagement = seedEngagement(w);
            return {
              id: w.id,
              title: w.title,
              preview,
              domain: w.domain,
              contentType: w.contentType,
              author: w.author,
              likes: engagement.likes,
              liked: w.liked,
              favorited: w.favorited,
              favoriteCount: engagement.favoriteCount,
              commentCount: engagement.commentCount,
            } as WorkItem;
          })
          .filter((w): w is WorkItem => w !== null);

        // 合并所有作品，并恢复保存的点赞/收藏状态
        const hasSavedInteractions = savedState?.likedIds !== undefined;
        const applyInteractions = (items: WorkItem[]): WorkItem[] =>
          hasSavedInteractions
            ? items.map((w) => ({
                ...w,
                liked: savedLiked.has(w.id),
                favorited: savedFavorited.has(w.id),
              }))
            : items;

        setWorks(
          applyInteractions([
            ...userWorks,
            ...filterDeleted(PERMANENT_ARCHITECTURE_WORKS),
            ...filterDeleted(PERMANENT_ECOMMERCE_WORKS),
            ...filterDeleted(PERMANENT_COMIC_WORKS),
            ...remainingMocks,
          ]),
        );
        // 标记初始加载完成，触发滚动位置恢复
        setInitialLoadComplete(true);
      } catch (err) {
        console.error("加载作品失败:", err);
        const fallbackDeletedIds = await getDeletedMockIds().catch(() => [] as string[]);
        const fallbackDeletedSet = new Set(fallbackDeletedIds);
        const fallbackFilter = (works: WorkItem[]) =>
          works.filter((w) => !fallbackDeletedSet.has(w.id));
        setWorks([
          ...fallbackFilter(PERMANENT_ARCHITECTURE_WORKS),
          ...fallbackFilter(PERMANENT_ECOMMERCE_WORKS),
          ...fallbackFilter(PERMANENT_COMIC_WORKS),
          ...fallbackFilter(MOCK_WORKS),
        ]);
        setInitialLoadComplete(true);
      }
    })();
  }, []);

  // 组件卸载时释放所有 blob URL
  useEffect(() => {
    return () => {
      blobUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      blobUrlsRef.current.clear();
    };
  }, []);

  // 保存筛选/UI 状态到 localStorage（变化时实时保存）
  useEffect(() => {
    saveDiscoverState({
      activeDomain,
      activeType,
      sortBy,
      sortMenuOpen,
      showUploadModal,
      uploadTitle,
    });
  }, [activeDomain, activeType, sortBy, sortMenuOpen, showUploadModal, uploadTitle]);

  // 保存交互状态（点赞/收藏/已读）到 localStorage
  useEffect(() => {
    saveDiscoverState({
      likedIds: works.filter((w) => w.liked).map((w) => w.id),
      favoritedIds: works.filter((w) => w.favorited).map((w) => w.id),
      viewedIds: Array.from(viewedIds),
    });
  }, [works, viewedIds]);

  // 滚动位置：debounce 保存 + 页面隐藏时立即保存
  useEffect(() => {
    // 禁用浏览器默认滚动恢复，改由手动控制
    if ("scrollRestoration" in history) {
      history.scrollRestoration = "manual";
    }
    let timer: ReturnType<typeof setTimeout>;
    const handler = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        saveDiscoverState({ scrollY: window.scrollY });
      }, 200);
    };
    // 页面隐藏/关闭前立即保存（不经过 debounce）
    const saveImmediate = () => {
      clearTimeout(timer);
      saveDiscoverState({ scrollY: window.scrollY });
    };
    window.addEventListener("scroll", handler, { passive: true });
    window.addEventListener("pagehide", saveImmediate);
    return () => {
      window.removeEventListener("scroll", handler);
      window.removeEventListener("pagehide", saveImmediate);
      clearTimeout(timer);
    };
  }, []);

  // 滚动位置：初始加载完成后恢复（延迟以确保 DOM 完全渲染）
  useEffect(() => {
    if (!initialLoadComplete) return;
    const saved = loadDiscoverState();
    if (saved?.scrollY && saved.scrollY > 0) {
      const timer = setTimeout(() => {
        window.scrollTo({ top: saved.scrollY, behavior: "instant" });
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [initialLoadComplete]);

  // 上传相关状态
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingFile, setPendingFile] = useState<{
    file: File;
    previewUrl: string;
    contentType: ContentType;
  } | null>(null);
  const [uploading, setUploading] = useState(false); // 上传中状态，防止重复点击

  // 根据文件扩展名推断内容类型
  // 仅支持图像与视频（与社区子板块结构一致：全部 / 图像 / 视频）
  const inferContentType = (fileName: string): ContentType | null => {
    const ext = fileName.split(".").pop()?.toLowerCase() || "";
    if (["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(ext)) return "image";
    if (["mp4", "webm", "mov", "avi", "mkv"].includes(ext)) return "video";
    return null;
  };

  // 根据文件扩展名推断标准 MIME 类型
  // 修复：Windows 文件选择器对图片/视频扩展名经常返回空 file.type，
  // 导致 blob 被存为 application/octet-stream，<img>/<video> 拒绝渲染。
  const inferMimeType = (fileName: string): string => {
    const ext = fileName.split(".").pop()?.toLowerCase() || "";
    const mimeMap: Record<string, string> = {
      png: "image/png",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      gif: "image/gif",
      webp: "image/webp",
      svg: "image/svg+xml",
      mp4: "video/mp4",
      webm: "video/webm",
      mov: "video/quicktime",
      avi: "video/x-msvideo",
      mkv: "video/x-matroska",
    };
    return mimeMap[ext] || "application/octet-stream";
  };

  // 上传文件大小限制（50MB）— 防止大文件触发 IndexedDB 事务 abort
  const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const ct = inferContentType(file.name);
    if (!ct) {
      toast.error("不支持的文件类型，仅支持图片或视频");
      e.target.value = "";
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      toast.error(`文件过大（${(file.size / 1024 / 1024).toFixed(1)}MB），上限为 50MB，请压缩后上传`);
      e.target.value = "";
      return;
    }
    const previewUrl = URL.createObjectURL(file);
    setPendingFile({ file, previewUrl, contentType: ct });
    setUploadTitle(file.name.replace(/\.[^.]+$/, ""));
    e.target.value = "";
  };

  const handleUploadConfirm = async () => {
    if (!pendingFile || uploading) return;
    setUploading(true);
    const title = uploadTitle.trim() || pendingFile.file.name;
    const workId = `upload-${Date.now()}`;
    try {
      // 将 File 转为纯 Blob，避免 File 对象结构化克隆在某些浏览器/大文件下的兼容性问题
      const arrayBuffer = await pendingFile.file.arrayBuffer();
      // 关键修复：浏览器（特别是 Windows）对 .html/.htm 等扩展名 file.type 经常为空，
      // 这里优先用 file.type，为空时按扩展名推断标准 MIME，
      // 否则 blob 会被记为 application/octet-stream，导致 iframe/<video> 拒绝渲染。
      const mimeType = pendingFile.file.type || inferMimeType(pendingFile.file.name);
      const blob = new Blob([arrayBuffer], { type: mimeType });

      // 持久化到 IndexedDB：文件 Blob + 元数据
      const stored: StoredWork = {
        id: workId,
        title,
        domain: activeDomain,
        contentType: pendingFile.contentType,
        author: { name: "我" },
        likes: 0,
        fileType: mimeType,
        createdAt: Date.now(),
        scope: "community",
      };
      await saveWork(stored, blob);

      // 生成运行时 blob URL 用于展示
      const previewUrl = URL.createObjectURL(blob);
      blobUrlsRef.current.add(previewUrl);

      const newItem: WorkItem = {
        id: workId,
        title,
        preview: previewUrl,
        domain: activeDomain,
        contentType: pendingFile.contentType,
        author: { name: "我" },
        likes: 0,
      };
      // 释放上传弹窗用的临时 blob URL
      URL.revokeObjectURL(pendingFile.previewUrl);
      setWorks((prev) => [newItem, ...prev]);
      setShowUploadModal(false);
      setPendingFile(null);
      setUploadTitle("");
      toast.success("作品已上传");
    } catch (err) {
      console.error("上传失败:", err);
      const msg = err instanceof Error ? err.message : "未知错误";
      // IndexedDB 事务被中止（多为文件过大或配额不足）
      if (msg.includes("中止") || msg.includes("存储") || msg.includes("quota") || msg.includes("Quota")) {
        toast.error("存储空间不足或文件过大（上限 50MB），请清理浏览器站点数据或压缩后重试");
      } else if (pendingFile.file.size > MAX_UPLOAD_BYTES) {
        toast.error(`文件过大（${(pendingFile.file.size / 1024 / 1024).toFixed(1)}MB），上限为 50MB`);
      } else {
        toast.error("上传失败，请重试");
      }
      // 失败时不关闭弹窗，保留 pendingFile 让用户可以重试
    } finally {
      setUploading(false);
    }
  };

  const handleUploadCancel = () => {
    if (pendingFile) URL.revokeObjectURL(pendingFile.previewUrl);
    setPendingFile(null);
    setUploadTitle("");
    setShowUploadModal(false);
  };

  // 过滤逻辑：领域必选 + 形式可选
  const filteredWorks = useMemo(() => {
    const filtered = works.filter((w) => {
      if (w.domain !== activeDomain) return false;
      if (activeType && w.contentType !== activeType) return false;
      // 用户上传作品（upload-*）始终允许在所属分类展示，不受永久作品白名单限制
      const isUserUpload = w.id.startsWith("upload-");
      // 建筑分类仅展示永久作品集 + 用户上传作品，排除任何无关 mock / 旧数据
      if (activeDomain === "architecture" && !isUserUpload && !isPermanentArchitectureWork(w.id)) return false;
      // 电商分类仅展示永久作品集 + 用户上传作品，排除任何无关 mock / 旧数据
      if (activeDomain === "ecommerce" && !isUserUpload && !isPermanentEcommerceWork(w.id)) return false;
      // 漫剧分类仅展示永久作品集 + 用户上传作品，排除任何无关 mock / 旧数据
      if (activeDomain === "comic" && !isUserUpload && !isPermanentComicWork(w.id)) return false;
      return true;
    });
    if (sortBy === "hot") {
      return [...filtered].sort((a, b) => b.likes - a.likes);
    }
    // recommend: latest first — by createdAt timestamp (mock works have createdAt, uploaded works use id timestamp)
    return [...filtered].sort((a, b) => {
      const aTs = a.createdAt ?? (a.id.startsWith("upload-") ? Number(a.id.replace("upload-", "")) : 0);
      const bTs = b.createdAt ?? (b.id.startsWith("upload-") ? Number(b.id.replace("upload-", "")) : 0);
      return bTs - aTs;
    });
  }, [works, activeDomain, activeType, sortBy]);

  // ——— NEW 角标判断：当前 activeDomain 分类下，按 createdAt 时间戳取最新 5 个作品
  const newestIdsInCategory = useMemo(() => {
    // 从全量 works 中取当前分类作品（不限制 activeType，NEW 是分类维度的 TOP5 新鲜度标记）
    const inDomain = works.filter((w) => w.domain === activeDomain);
    // 按 createdAt 倒序（最新优先）
    const sorted = [...inDomain].sort((a, b) => {
      const aTs = a.createdAt ?? (a.id.startsWith("upload-") ? Number(a.id.replace("upload-", "")) : 0);
      const bTs = b.createdAt ?? (b.id.startsWith("upload-") ? Number(b.id.replace("upload-", "")) : 0);
      return bTs - aTs;
    });
    return new Set(sorted.slice(0, 5).map((w) => w.id));
  }, [works, activeDomain]);

  const handleLike = (id: string) => {
    setWorks((prev) =>
      prev.map((w) => {
        if (w.id !== id) return w;
        const updated = { ...w, liked: !w.liked, likes: w.liked ? w.likes - 1 : w.likes + 1 };
        return updated;
      }),
    );
    // 同步到 IndexedDB（仅用户上传的作品）
    syncWorkToDB(id);
  };

  const handleFavorite = (id: string) => {
    setWorks((prev) =>
      prev.map((w) => {
        if (w.id !== id) return w;
        const favorited = !w.favorited;
        const updated = { ...w, favorited, favoriteCount: Math.max(0, (w.favoriteCount ?? 0) + (favorited ? 1 : -1)) };
        return updated;
      }),
    );
    syncWorkToDB(id);
  };

  const handleComment = (item: WorkItem) => {
    toast.success(`评论功能：${item.title}`);
  };

  const handleDelete = (id: string) => {
    // 所有作品均允许用户主动删除（含建筑/电商/漫剧默认作品集与用户上传作品）
    setWorks((prev) => prev.filter((w) => w.id !== id));
    if (id.startsWith("upload-")) {
      // 用户上传作品：从 IndexedDB 删除元数据 + 文件 Blob
      deleteWork(id).catch((err) => console.error("删除持久化作品失败:", err));
    } else {
      // 默认作品集 / Mock 作品：记录已删除 id，刷新后不再加载；
      // 用户可通过"恢复默认作品"按钮强制重新 seed 复原
      addDeletedMockId(id).catch((err) => console.error("记录 Mock 删除失败:", err));
      // 同时尝试从 IndexedDB 清理（默认作品集已被 seed 入库的情境）
      deleteWork(id).catch(() => { /* 默认作品可能未入库，忽略错误 */ });
    }
    toast.success("作品已删除");
  };

  /**
   * 恢复默认作品集：强制重新 seed 建筑/电商/漫剧三类永久作品到 IndexedDB，
   * 并清除对应已删除记录，让用户重新看到全部默认内容。
   * 不影响用户上传作品（upload-*）与交互状态（点赞/收藏/已读）。
   */
  const [restoring, setRestoring] = useState(false);
  const handleRestoreDefaults = async () => {
    if (restoring) return;
    setRestoring(true);
    try {
      await Promise.all([
        seedPermanentArchitectureWorks(true).catch(() => {}),
        seedPermanentEcommerceWorks(true).catch(() => {}),
        seedPermanentComicWorks(true).catch(() => {}),
      ]);
      // 清空已删除 Mock 记录，让默认作品集在下次加载时全部可见
      await clearDeletedMockIds().catch(() => {});
      // 重新拉取社区作品并合并展示
      const storedWorks = await getWorksByScope("community").catch(() => [] as StoredWork[]);
      const userStoredWorks = storedWorks.filter((w) => w.id.startsWith("upload-"));
      userStoredWorks.sort((a, b) => b.createdAt - a.createdAt);
      const blobs: Map<string, Blob> = await getFileBlobs(
        userStoredWorks.map((w) => w.id),
      ).catch(() => new Map());
      const seedEngagement = (work: StoredWork) => {
        if (work.likes === 0 || work.likes == null) {
          const hash = [...work.id].reduce((acc, c) => acc + c.charCodeAt(0), 0);
          return { likes: 8 + (hash % 50), favoriteCount: 2 + (hash % 15), commentCount: 1 + (hash % 8) };
        }
        return { likes: work.likes, favoriteCount: work.favoriteCount ?? 0, commentCount: work.commentCount ?? 0 };
      };
      const userWorks: WorkItem[] = userStoredWorks
        .map((w) => {
          const blob = blobs.get(w.id);
          const preview = blob
            ? (() => {
                const url = URL.createObjectURL(blob);
                blobUrlsRef.current.add(url);
                return url;
              })()
            : w.previewUrl;
          if (!preview) return null;
          const engagement = seedEngagement(w);
          return {
            id: w.id,
            title: w.title,
            preview,
            domain: w.domain,
            contentType: w.contentType,
            author: w.author,
            likes: engagement.likes,
            liked: w.liked,
            favorited: w.favorited,
            favoriteCount: engagement.favoriteCount,
            commentCount: engagement.commentCount,
          } as WorkItem;
        })
        .filter((w): w is WorkItem => w !== null);
      // 恢复交互状态
      const savedState = loadDiscoverState();
      const savedLiked = new Set<string>(savedState?.likedIds ?? []);
      const savedFavorited = new Set<string>(savedState?.favoritedIds ?? []);
      setWorks((prev) => {
        const userInteractions = new Map(prev.filter((w) => w.id.startsWith("upload-")).map((w) => [w.id, w]));
        const restoredUserWorks = userWorks.map((w) => userInteractions.get(w.id) ?? w);
        const merged = [
          ...restoredUserWorks,
          ...PERMANENT_ARCHITECTURE_WORKS,
          ...PERMANENT_ECOMMERCE_WORKS,
          ...PERMANENT_COMIC_WORKS,
        ].map((w) => ({
          ...w,
          liked: savedLiked.has(w.id) || w.liked,
          favorited: savedFavorited.has(w.id) || w.favorited,
        }));
        return merged;
      });
      toast.success("已恢复默认作品集");
    } catch (err) {
      console.error("恢复默认作品失败:", err);
      toast.error("恢复失败，请重试");
    } finally {
      setRestoring(false);
    }
  };

  const handleRename = (id: string, newTitle: string) => {
    setWorks((prev) =>
      prev.map((w) => (w.id === id ? { ...w, title: newTitle } : w)),
    );
    syncWorkToDB(id);
  };

  /**
   * 将指定作品的最新状态同步到 IndexedDB
   * 使用函数式更新获取最新状态，避免闭包陷阱
   */
  const syncWorkToDB = (id: string) => {
    if (!id.startsWith("upload-")) return;
    setWorks((prev) => {
      const w = prev.find((x) => x.id === id);
      if (w) {
        const stored: StoredWork = {
          id: w.id,
          title: w.title,
          domain: w.domain,
          contentType: w.contentType,
          author: w.author,
          likes: w.likes,
          liked: w.liked,
          favorited: w.favorited,
          fileType: "",
          createdAt: Number(w.id.replace("upload-", "")) || Date.now(),
          scope: "community",
        };
        updateWork(stored).catch((err) => console.error("同步作品状态失败:", err));
      }
      return prev;
    });
  };

  // 预览状态
  const [previewItem, setPreviewItem] = useState<WorkItem | null>(null);

  // 预览作品时标记为已读
  const handlePreview = (item: WorkItem) => {
    setPreviewItem(item);
    setViewedIds((prev) => {
      if (prev.has(item.id)) return prev;
      const next = new Set(prev);
      next.add(item.id);
      return next;
    });
  };

  return (
    <div className="min-h-screen bg-[#1a1a1a] pt-16">
      {/* 顶部标题区 */}
      <div className="px-6 py-8 max-w-[1600px] mx-auto">
        <div className="flex items-center gap-3 mb-2">
          <Compass className="w-8 h-8 text-white/80" />
          <h1 className="text-3xl font-bold text-white">PUGC社区</h1>
        </div>
        <p className="text-white/50 text-sm">探索其他创作者分享的优秀 AIGC 作品</p>
      </div>

      {/* 筛选区 */}
      <div className="px-6 max-w-[1600px] mx-auto mb-8">
        <div className="flex flex-col gap-4">
          {/* 领域分类标签 - 横向排列，下划线高亮 */}
          <div>
            <div className="flex items-baseline gap-4">
              <p className="text-xs text-white/40 flex-shrink-0">领域分类</p>
              <div className="flex gap-6 border-b border-white/10 flex-1">
                {DOMAINS.map((d) => (
                  <button
                    key={d.key}
                    onClick={() => {
                      setActiveDomain(d.key);
                      // 切换主分类时，内容形式筛选默认重置为"全部"
                      setActiveType(null);
                    }}
                    className={`relative pb-3 text-sm font-medium transition-colors ${
                      activeDomain === d.key
                        ? "text-white"
                        : "text-white/50 hover:text-white/80"
                    }`}
                  >
                    {d.label}
                    {activeDomain === d.key && (
                      <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-white rounded-full" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 内容形式筛选 - 横向排列胶囊按钮 */}
          <div>
            <div className="flex items-center gap-4">
              <p className="text-xs text-white/40 flex-shrink-0">内容形式</p>
              <div className="flex flex-row gap-1.5 flex-wrap">
                {CONTENT_TYPES.map((t) => {
                  const isActive = activeType === t.key;
                  return (
                    <button
                      key={t.key}
                      onClick={() => setActiveType(isActive ? null : t.key)}
                      className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all ${
                        isActive
                          ? "bg-white text-black"
                          : "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white/80 border border-white/10"
                      }`}
                    >
                      {t.label}
                    </button>
                  );
                })}
              </div>
              {/* 排序下拉按钮 */}
              <div className="ml-auto relative flex-shrink-0">
                <button
                  onClick={() => setSortMenuOpen(!sortMenuOpen)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-white/5 text-white/70 hover:bg-white/10 hover:text-white border border-white/10 transition-all"
                  title="排序方式"
                >
                  <ArrowUpDown className="w-3.5 h-3.5" />
                  <span>{sortBy === "recommend" ? "最新" : "最热"}</span>
                  <ChevronDown className={`w-3 h-3 transition-transform ${sortMenuOpen ? "rotate-180" : ""}`} />
                </button>
                {/* 下拉菜单 */}
                {sortMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setSortMenuOpen(false)} />
                    <div className="absolute right-0 mt-1.5 w-32 bg-[#1a1a1a] border border-white/15 rounded-lg shadow-xl overflow-hidden z-50">
                      <button
                        onClick={() => { setSortBy("recommend"); setSortMenuOpen(false); }}
                        className={`w-full px-3 py-2 text-left text-sm transition-colors ${
                          sortBy === "recommend"
                            ? "bg-white/10 text-white"
                            : "text-white/60 hover:bg-white/5 hover:text-white/80"
                        }`}
                      >
                        最新
                      </button>
                      <button
                        onClick={() => { setSortBy("hot"); setSortMenuOpen(false); }}
                        className={`w-full px-3 py-2 text-left text-sm transition-colors ${
                          sortBy === "hot"
                            ? "bg-white/10 text-white"
                            : "text-white/60 hover:bg-white/5 hover:text-white/80"
                        }`}
                      >
                        最热
                      </button>
                    </div>
                  </>
                )}
              </div>
              {/* 上传按钮 */}
              <button
                onClick={() => setShowUploadModal(true)}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-medium bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 border border-blue-500/30 transition-all flex-shrink-0"
                title="上传作品"
              >
                <Upload className="w-3.5 h-3.5" />
                上传作品
              </button>
            </div>
          </div>

          {/* 已选筛选条件提示 */}
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-white/40">当前筛选：</span>
              <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded text-xs">
                {DOMAINS.find((d) => d.key === activeDomain)?.label}
              </span>
              <span className="px-2 py-0.5 bg-white/10 text-white/70 rounded text-xs">
                {CONTENT_TYPES.find((t) => t.key === activeType)?.label ?? "全部"}
              </span>
              <span className="text-xs text-white/30">· 共 {filteredWorks.length} 个作品</span>
              <button
                onClick={handleRestoreDefaults}
                disabled={restoring}
                className="ml-auto px-3 py-1 rounded-full text-xs font-medium bg-white/5 text-white/60 hover:bg-white/10 hover:text-white border border-white/10 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                title="恢复默认作品集（建筑/电商/漫剧）"
              >
                {restoring ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin" />
                    恢复中...
                  </>
                ) : (
                  <>
                    <RotateCcw className="w-3 h-3" />
                    恢复默认作品
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 作品网格 */}
      <div className="px-6 max-w-[1600px] mx-auto pb-16">
        {filteredWorks.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-5">
            {filteredWorks.map((item) => (
              <WorkCard
                key={item.id}
                item={item}
                onLike={handleLike}
                onFavorite={handleFavorite}
                onComment={handleComment}
                onRename={handleRename}
                onDelete={handleDelete}
                onPreview={handlePreview}
                showReuse={false}
                isNew={false}
              />
            ))}
          </div>
        ) : (
          <div className="py-24 text-center">
            <Compass className="w-12 h-12 text-white/20 mx-auto mb-4" />
            <p className="text-white/40">该分类下暂无作品，请尝试其他筛选条件</p>
          </div>
        )}
      </div>

      {/* 上传弹窗 */}
      {showUploadModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={handleUploadCancel}
        >
          <div
            className="w-full max-w-md bg-[#1a1a1a] border border-white/15 rounded-2xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 弹窗头部 */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
              <h3 className="text-base font-semibold text-white">上传作品到「{DOMAINS.find((d) => d.key === activeDomain)?.label}」</h3>
              <button
                onClick={handleUploadCancel}
                className="p-1 text-white/40 hover:text-white hover:bg-white/10 rounded transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* 弹窗内容 */}
            <div className="p-5 space-y-4">
              {/* 文件选择区 */}
              {!pendingFile ? (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full flex flex-col items-center justify-center py-10 border-2 border-dashed border-white/15 rounded-xl hover:border-white/30 hover:bg-white/5 transition-colors"
                >
                  <Upload className="w-8 h-8 text-white/40 mb-2" />
                  <p className="text-sm text-white/60">点击选择文件</p>
                  <p className="text-xs text-white/30 mt-1">支持图片 / 视频</p>
                </button>
              ) : (
                <div className="space-y-3">
                  {/* 预览区 */}
                  <div className="relative rounded-xl overflow-hidden bg-black/40 border border-white/10">
                    {pendingFile.contentType === "image" && (
                      <img src={pendingFile.previewUrl} alt="预览" className="w-full max-h-56 object-contain" />
                    )}
                    {pendingFile.contentType === "video" && (
                      <video src={pendingFile.previewUrl} controls className="w-full max-h-56" />
                    )}
                  </div>

                  {/* 标题输入 */}
                  <div>
                    <label className="block text-xs text-white/50 mb-1.5">作品标题</label>
                    <input
                      type="text"
                      value={uploadTitle}
                      onChange={(e) => setUploadTitle(e.target.value)}
                      placeholder="为你的作品起个名字"
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-white/30 outline-none focus:border-white/30"
                    />
                  </div>

                  {/* 内容类型标签 */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-white/40">类型：</span>
                    <span className="px-2 py-0.5 bg-white/10 text-white/70 rounded text-xs">
                      {CONTENT_TYPES.find((t) => t.key === pendingFile.contentType)?.label}
                    </span>
                  </div>
                </div>
              )}

              {/* 隐藏的文件输入 */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*"
                className="hidden"
                onChange={handleFileSelect}
              />
            </div>

            {/* 弹窗底部按钮 */}
            {pendingFile && (
              <div className="flex gap-2 px-5 py-4 border-t border-white/10">
                <button
                  onClick={handleUploadCancel}
                  disabled={uploading}
                  className="flex-1 px-4 py-2 rounded-lg text-sm text-white/60 hover:text-white bg-white/5 hover:bg-white/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  取消
                </button>
                <button
                  onClick={handleUploadConfirm}
                  disabled={uploading}
                  className="flex-1 px-4 py-2 rounded-lg text-sm font-medium text-black bg-white hover:bg-white/90 transition-colors disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      上传中...
                    </>
                  ) : (
                    "确认上传"
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 作品预览模态框 */}
      {previewItem && (
        <WorkPreviewModal
          item={previewItem}
          onClose={() => setPreviewItem(null)}
          onLike={handleLike}
          onFavorite={handleFavorite}
        />
      )}
    </div>
  );
}
