"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import {
  User, Edit3, Heart, MessageCircle, Bookmark,
  Image as ImageIcon, Video as VideoIcon, MoreHorizontal,
  Copy, Share2, X, Plus, Upload, FileVideo, Workflow,
} from "lucide-react";
import { toast } from "sonner";
import WorkCard, { type WorkItem, type Domain } from "@/components/WorkCard";
import WorkPreviewModal from "@/components/WorkPreviewModal";
import { asset } from "@/lib/asset";
import {
  getWorksByScope,
  getFileBlobs,
  saveWork,
  updateWork,
  deleteWork,
  type StoredWork,
} from "@/lib/ugc-storage";
import {
  runGlobalAppSeed,
  getStaticWorksByScope,
  PROFILE_SEED_WORKS,
  LIKED_SEED_WORKS,
  FAVORITED_SEED_WORKS,
} from "@/lib/app-seed";

/** 与 app-seed.ts 的版本 key 保持一致（跟随种子升级强制刷新点赞/收藏） */
const LIKED_WORKS_KEY = "aga-profile-liked-works::v7";
const FAVORITED_WORKS_KEY = "aga-profile-favorited-works::v7";

// ============ 文件名处理工具 ============
const MAX_TITLE_LENGTH = 50;

function extractTitleFromFilename(filename: string): string {
  // 1. 去除扩展名
  const dotIndex = filename.lastIndexOf(".");
  let title = dotIndex > 0 ? filename.substring(0, dotIndex) : filename;
  
  // 2. 清理特殊字符（保留中英文、数字、空格、常见标点）
  title = title.replace(/[\\/:*?"<>|]/g, " ");
  title = title.replace(/[\u0000-\u001f\u007f-\u009f]/g, "");
  
  // 3. 清理多余空白
  title = title.replace(/\s+/g, " ").trim();
  
  // 4. 长度限制
  if (title.length > MAX_TITLE_LENGTH) {
    title = title.substring(0, MAX_TITLE_LENGTH).trim();
  }
  
  // 5. 空值兜底
  if (!title) {
    title = "未命名作品";
  }
  
  return title;
}

// ============ 个人主页 Mock 用户数据 ============
const MOCK_PROFILE = {
  name: "Aigc.Kang",
  handle: "aigc_kang",
  avatar: "/mock-arch/avatar.jpg",
  bio: "专注建筑设计 · AIGC 探索者",
  followers: 238,
  following: 156,
  totalWorks: 0,
  totalLikes: 0,
  stats: {
    worksUsedCount: 0,
    worksLikedCount: 0,
  },
};

type MainTab = "publish" | "liked" | "favorited";
type SubFilter = "all" | "image" | "video" | "workflow";

// ============ Mock: 点赞的4个作品（已移至 lib/app-seed.ts LIKED_SEED_WORKS，此处保持向后兼容） ============
const MOCK_LIKED_SEED: WorkItem[] = [...LIKED_SEED_WORKS] as WorkItem[];

// 本地存储键
const COMMENTS_STORAGE_KEY = "aga-profile-comments";

interface Comment {
  id: string;
  workId: string;
  user: string;
  text: string;
  createdAt: number;
}

export default function ProfilePage() {
  const [mainTab, setMainTab] = useState<MainTab>("publish");
  const [subFilter, setSubFilter] = useState<SubFilter>("all");
  const [myWorks, setMyWorks] = useState<WorkItem[]>([]);
  const [likedWorks, setLikedWorks] = useState<WorkItem[]>([]);
  const [favoritedWorks, setFavoritedWorks] = useState<WorkItem[]>([]);
  const [previewItem, setPreviewItem] = useState<WorkItem | null>(null);
  const [comments, setComments] = useState<Comment[]>(() => {
    try {
      const raw = localStorage.getItem(COMMENTS_STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  });
  const [commentTarget, setCommentTarget] = useState<WorkItem | null>(null);
  const [commentText, setCommentText] = useState("");
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [publishType, setPublishType] = useState<"image" | "video">("image");
  const [publishTitle, setPublishTitle] = useState("");
  const [publishFile, setPublishFile] = useState<File | null>(null);
  const [publishUploading, setPublishUploading] = useState(false);
  const [publishDomain, setPublishDomain] = useState<"architecture" | "ecommerce" | "comic">("architecture");

  const blobUrlsRef = useRef<Set<string>>(new Set());

  /** 从 StoredWork 数组生成 WorkItem（统一使用 seed 的静态 previewUrl，避免 IndexedDB 没写完全导致 fallback 失效） */
  const buildItemsFromStored = (stored: StoredWork[]): WorkItem[] =>
    stored
      .filter((w) => w.previewUrl)
      .map((w) => ({
        id: w.id,
        title: w.title,
        preview: w.previewUrl!,
        domain: w.domain,
        contentType: w.contentType,
        author: w.author,
        likes: w.likes,
        liked: w.liked,
        favorited: w.favorited,
        favoriteCount: w.favoriteCount ?? 0,
        commentCount: w.commentCount ?? 0,
      }));

  // 加载我的作品：先跑全局 seed，再从 IndexedDB 读取；失败时降级使用硬编码静态 mock
  useEffect(() => {
    const loadWorks = async () => {
      try {
        // 执行全局 seed（幂等），确保任何浏览器打开都有默认作品
        await runGlobalAppSeed();

        // 读取 profile 模块的作品（按 scope 隔离）
        const storedWorks: StoredWork[] = await getWorksByScope("profile").catch(() => []);
        storedWorks.sort((a, b) => b.createdAt - a.createdAt);

        // 优先使用 IndexedDB 中的 stored（即使 FILES_STORE 为空、无 blob 也用静态 URL 渲染，保证不空白）
        let items: WorkItem[] = buildItemsFromStored(storedWorks);

        // 若 IndexedDB 还没写入任何数据（seed 升级竞态），直接用静态 seed 兜底，保证页面不空
        if (items.length === 0) {
          const fallback: StoredWork[] = [...PROFILE_SEED_WORKS].sort(
            (a, b) => b.createdAt - a.createdAt,
          );
          items = buildItemsFromStored(fallback);
        }

        // 额外尝试用 FILES_STORE 替换 blob URL（若 seed 有上传文件）
        try {
          if (storedWorks.length > 0) {
            const ids = storedWorks.map((w) => w.id);
            const blobs: Map<string, Blob> = await getFileBlobs(ids).catch(
              () => new Map(),
            );
            if (blobs.size > 0) {
              items = storedWorks
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
                  return {
                    id: w.id,
                    title: w.title,
                    preview,
                    domain: w.domain,
                    contentType: w.contentType,
                    author: w.author,
                    likes: w.likes,
                    liked: w.liked,
                    favorited: w.favorited,
                    favoriteCount: w.favoriteCount ?? 0,
                    commentCount: w.commentCount ?? 0,
                  } as WorkItem;
                })
                .filter((w): w is WorkItem => w !== null);
            }
          }
        } catch {
          /* ignore — 即使 blob 加载失败也保留静态 URL 渲染 */
        }

        setMyWorks(items);
      } catch (err) {
        console.error("加载我的作品失败，使用静态 mock:", err);
        const fallback: StoredWork[] = [...PROFILE_SEED_WORKS].sort(
          (a, b) => b.createdAt - a.createdAt,
        );
        setMyWorks(buildItemsFromStored(fallback));
      }
    };
    loadWorks();
  }, []);

  // 组件卸载时释放 blob URL
  useEffect(() => {
    return () => {
      blobUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      blobUrlsRef.current.clear();
    };
  }, []);

  // 持久化 comments
  useEffect(() => {
    localStorage.setItem(COMMENTS_STORAGE_KEY, JSON.stringify(comments));
  }, [comments]);

  // Tab 切换到"点赞"时，从 localStorage 加载；确保 seed 完成再渲染
  useEffect(() => {
    if (mainTab !== "liked") return;
    const load = async () => {
      await runGlobalAppSeed();
      try {
        const raw = localStorage.getItem(LIKED_WORKS_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setLikedWorks(parsed);
            return;
          }
        }
      } catch {
        /* ignore */
      }
      setLikedWorks(LIKED_SEED_WORKS);
    };
    load();
  }, [mainTab]);

  // Tab 切换到"收藏"时，从 localStorage 加载
  useEffect(() => {
    if (mainTab !== "favorited") return;
    const load = async () => {
      await runGlobalAppSeed();
      try {
        const raw = localStorage.getItem(FAVORITED_WORKS_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setFavoritedWorks(parsed);
            return;
          }
        }
      } catch {
        /* ignore */
      }
      setFavoritedWorks(FAVORITED_SEED_WORKS);
    };
    load();
  }, [mainTab]);

  // 筛选我的作品
  const filteredWorks = useMemo(() => {
    if (subFilter === "all") return myWorks;
    return myWorks.filter((w) => w.contentType === subFilter);
  }, [myWorks, subFilter]);

  // 筛选收藏作品
  const filteredFavoritedWorks = useMemo(() => {
    if (subFilter === "all") return favoritedWorks;
    return favoritedWorks.filter((w) => w.contentType === subFilter);
  }, [favoritedWorks, subFilter]);

  // 提交评论
  const submitComment = () => {
    if (!commentTarget || !commentText.trim()) return;
    const newComment: Comment = {
      id: `c-${Date.now()}`,
      workId: commentTarget.id,
      user: "我",
      text: commentText.trim(),
      createdAt: Date.now(),
    };
    setComments((prev) => [newComment, ...prev]);
    setCommentText("");
    toast.success("评论已发布");
  };

  // 发布作品
  const handlePublish = async () => {
    if (!publishFile || !publishTitle) {
      toast.error("请选择文件");
      return;
    }
    setPublishUploading(true);
    try {
      const fileBuffer = await publishFile.arrayBuffer();
      const id = `pub-${Date.now()}`;
      const work = {
        id,
        title: publishTitle,
        domain: publishDomain,
        contentType: publishType,
        author: { name: "我" },
        likes: 0,
        fileType: publishFile.type,
        createdAt: Date.now(),
        scope: "profile" as const,
      };
      const blob = new Blob([fileBuffer], { type: publishFile.type });
      await saveWork(work, blob);
      const newUrl = URL.createObjectURL(blob);
      blobUrlsRef.current.add(newUrl);
      const newItem: WorkItem = {
        id,
        title: publishTitle,
        preview: newUrl,
        domain: publishDomain,
        contentType: publishType,
        author: { name: "我" },
        likes: 0,
      };
      setMyWorks((prev) => [newItem, ...prev]);
      setPublishTitle("");
      setPublishFile(null);
      setShowPublishModal(false);
      setPublishDomain("architecture");
      toast.success("作品发布成功");
    } catch (err) {
      console.error("发布失败:", err);
      toast.error("发布失败，请重试");
    } finally {
      setPublishUploading(false);
    }
  };

  // 复制 UID
  const copyHandle = async () => {
    try {
      await navigator.clipboard.writeText(MOCK_PROFILE.handle);
      toast.success("UID 已复制");
    } catch {
      toast.error("复制失败");
    }
  };

  // 删除作品（发布 tab）
  const handleDeletePublished = async (id: string) => {
    try {
      await deleteWork(id);
      setMyWorks((prev) => prev.filter((w) => w.id !== id));
      toast.success("已删除");
    } catch (err) {
      console.error("删除失败:", err);
      toast.error("删除失败，请重试");
    }
  };

  // 重命名作品（发布 tab）
  const handleRenamePublished = async (id: string, newTitle: string) => {
    try {
      const allWorks = await getWorksByScope("profile");
      const target = allWorks.find((w) => w.id === id);
      if (target) {
        await updateWork({ ...target, title: newTitle });
      }
      setMyWorks((prev) => prev.map((w) => (w.id === id ? { ...w, title: newTitle } : w)));
      toast.success("已重命名");
    } catch (err) {
      console.error("重命名失败:", err);
      toast.error("重命名失败，请重试");
    }
  };

  // 更换领域标签（发布 tab）
  const handleChangeDomain = async (id: string, newDomain: Domain) => {
    try {
      const allWorks = await getWorksByScope("profile");
      const target = allWorks.find((w) => w.id === id);
      if (target) {
        await updateWork({ ...target, domain: newDomain });
      }
      setMyWorks((prev) => prev.map((w) => (w.id === id ? { ...w, domain: newDomain } : w)));
      toast.success("已更新分类");
    } catch (err) {
      console.error("更新分类失败:", err);
      toast.error("更新分类失败，请重试");
    }
  };

  // 删除作品（点赞 tab）
  const handleDeleteLiked = (id: string) => {
    const updated = likedWorks.filter((w) => w.id !== id);
    setLikedWorks(updated);
    localStorage.setItem(LIKED_WORKS_KEY, JSON.stringify(updated));
    toast.success("已移除");
  };

  // 重命名作品（点赞 tab）
  const handleRenameLiked = (id: string, newTitle: string) => {
    const updated = likedWorks.map((w) => (w.id === id ? { ...w, title: newTitle } : w));
    setLikedWorks(updated);
    localStorage.setItem(LIKED_WORKS_KEY, JSON.stringify(updated));
    toast.success("已重命名");
  };

  // 统计数据
  const imageCount = myWorks.filter((w) => w.contentType === "image").length;
  const videoCount = myWorks.filter((w) => w.contentType === "video").length;
  const workflowCount = myWorks.filter((w) => w.contentType === "workflow").length;
  const totalLikes = myWorks.reduce((sum, w) => sum + (w.likes || 0), 0);

  const likedImageCount = likedWorks.filter((w) => w.contentType === "image").length;
  const likedVideoCount = likedWorks.filter((w) => w.contentType === "video").length;
  const likedWorkflowCount = likedWorks.filter((w) => w.contentType === "workflow").length;

  const favoritedImageCount = favoritedWorks.filter((w) => w.contentType === "image").length;
  const favoritedVideoCount = favoritedWorks.filter((w) => w.contentType === "video").length;
  const favoritedWorkflowCount = favoritedWorks.filter((w) => w.contentType === "workflow").length;

  const subTabs: { key: SubFilter; label: string; count: number }[] = [
    { key: "all", label: "全部", count: myWorks.length },
    { key: "image", label: "图像", count: imageCount },
    { key: "video", label: "视频", count: videoCount },
    { key: "workflow", label: "工作流", count: workflowCount },
  ];

  const likedSubTabs: { key: SubFilter; label: string; count: number }[] = [
    { key: "all", label: "全部", count: likedWorks.length },
    { key: "image", label: "图像", count: likedImageCount },
    { key: "video", label: "视频", count: likedVideoCount },
    { key: "workflow", label: "工作流", count: likedWorkflowCount },
  ];

  const favoritedSubTabs: { key: SubFilter; label: string; count: number }[] = [
    { key: "all", label: "全部", count: favoritedWorks.length },
    { key: "image", label: "图像", count: favoritedImageCount },
    { key: "video", label: "视频", count: favoritedVideoCount },
    { key: "workflow", label: "工作流", count: favoritedWorkflowCount },
  ];

  const filteredLikedWorks = useMemo(() => {
    if (subFilter === "all") return likedWorks;
    return likedWorks.filter((w) => w.contentType === subFilter);
  }, [likedWorks, subFilter]);

  return (
    <div className="min-h-screen bg-[#0a0a0a] pt-16">
      {/* 顶部用户信息（移除头像上方的封面背景图） */}
      <section className="relative">
        <div className="max-w-[1600px] mx-auto px-6 relative">
          <div className="flex flex-col md:flex-row md:items-start gap-4 pb-6 pt-4">
            {/* 头像 */}
            <div className="relative flex-shrink-0">
              <div className="w-28 h-28 md:w-32 md:h-32 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 border-4 border-[#0a0a0a] flex items-center justify-center shadow-2xl overflow-hidden">
                {MOCK_PROFILE.avatar ? (
                  <img src={asset(MOCK_PROFILE.avatar)} alt="avatar" className="w-full h-full object-cover" />
                ) : (
                  <User className="w-14 h-14 md:w-16 md:h-16 text-white" />
                )}
              </div>
              <button className="absolute bottom-1 right-1 w-8 h-8 rounded-full bg-white text-black flex items-center justify-center shadow-lg hover:bg-white/90 transition-colors">
                <Edit3 className="w-4 h-4" />
              </button>
            </div>

            {/* 基本信息 */}
            <div className="flex-1 min-w-0 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
              <div className="min-w-0 md:pt-8">
                <div className="flex items-center gap-2 mb-1">
                  <h1 className="text-2xl md:text-3xl font-bold text-white truncate">{MOCK_PROFILE.name}</h1>
                  <button
                    onClick={copyHandle}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/10 hover:bg-white/20 text-white/70 text-xs transition-colors"
                    title="复制 UID"
                  >
                    <Copy className="w-3 h-3" />
                    <span className="truncate">@{MOCK_PROFILE.handle}</span>
                  </button>
                </div>

                {/* 数据统计 */}
                <div className="flex items-center gap-6 mt-4">
                  <div className="text-center md:text-left">
                    <div className="text-lg font-bold text-white">{MOCK_PROFILE.followers}</div>
                    <div className="text-xs text-white/50">粉丝</div>
                  </div>
                  <div className="text-center md:text-left">
                    <div className="text-lg font-bold text-white">{MOCK_PROFILE.following}</div>
                    <div className="text-xs text-white/50">关注</div>
                  </div>
                  <div className="text-center md:text-left">
                    <div className="text-lg font-bold text-white">{myWorks.length}</div>
                    <div className="text-xs text-white/50">作品</div>
                  </div>
                  <div className="text-center md:text-left">
                    <div className="text-lg font-bold text-white">{totalLikes}</div>
                    <div className="text-xs text-white/50">获赞</div>
                  </div>
                </div>
              </div>

              {/* 操作按钮 */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => setShowPublishModal(true)}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-gradient-to-r from-blue-500 to-cyan-500 text-white text-sm font-medium hover:from-blue-600 hover:to-cyan-600 transition-all"
                >
                  <Plus className="w-4 h-4" />
                  <span>发布作品</span>
                </button>
                <button className="px-4 py-1.5 rounded-lg bg-white text-black text-sm font-medium hover:bg-white/90 transition-colors">
                  编辑资料
                </button>
                <button className="p-2 rounded-lg bg-white/10 text-white/70 hover:bg-white/20 transition-colors">
                  <Share2 className="w-4 h-4" />
                </button>
                <button className="p-2 rounded-lg bg-white/10 text-white/70 hover:bg-white/20 transition-colors">
                  <MoreHorizontal className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Tab 切换 - 发布 / 点赞 / 收藏 */}
      <section className="max-w-[1600px] mx-auto px-6 border-b border-white/10">
        <div className="flex items-center gap-1">
          {([
            { key: "publish" as MainTab, label: "发布" },
            { key: "liked" as MainTab, label: "点赞" },
            { key: "favorited" as MainTab, label: "收藏" },
          ]).map((tab) => (
            <button
              key={tab.key}
              onClick={() => setMainTab(tab.key)}
              className={`relative px-4 py-3 text-sm font-medium transition-colors ${
                mainTab === tab.key ? "text-white" : "text-white/50 hover:text-white/80"
              }`}
            >
              <span>{tab.label}</span>
              {mainTab === tab.key && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-white rounded-full" />
              )}
            </button>
          ))}
        </div>
      </section>

      {/* 内容区 */}
      <section className="max-w-[1600px] mx-auto px-6 py-6">
        {mainTab === "publish" && (
          <>
            {/* 子筛选 Tab：图像 / 视频 */}
            <div className="flex items-center gap-2 mb-6">
              {subTabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setSubFilter(tab.key)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                    subFilter === tab.key
                      ? "bg-white text-black"
                      : "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white/80 border border-white/10"
                  }`}
                >
                  {tab.key === "image" && <ImageIcon className="w-3.5 h-3.5" />}
                  {tab.key === "video" && <VideoIcon className="w-3.5 h-3.5" />}
                  {tab.key === "workflow" && <Workflow className="w-3.5 h-3.5" />}
                  <span>{tab.label}</span>
                  <span className={`${subFilter === tab.key ? "text-black/60" : "text-white/40"}`}>
                    ({tab.count})
                  </span>
                </button>
              ))}
            </div>

            {/* 发布内容网格 */}
            {filteredWorks.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-5">
                {filteredWorks.map((item) => (
                  <WorkCard
                    key={item.id}
                    item={item}
                    onLike={async (id) => {
                      const cur = myWorks.find((w) => w.id === id);
                      if (!cur) return;
                      const newLiked = !cur.liked;
                      const newLikes = cur.likes + (newLiked ? 1 : -1);
                      setMyWorks((prev) =>
                        prev.map((w) =>
                          w.id === id ? { ...w, liked: newLiked, likes: newLikes } : w
                        )
                      );
                      try {
                        const storedWorks = await getWorksByScope("profile");
                        const target = storedWorks.find((w) => w.id === id);
                        if (target) {
                          await updateWork({ ...target, liked: newLiked, likes: newLikes });
                        }
                      } catch (err) {
                        console.error("同步点赞状态到 IndexedDB 失败:", err);
                      }
                      toast.success(newLiked ? "已点赞" : "已取消点赞");
                    }}
                    onDelete={handleDeletePublished}
                    onRename={handleRenamePublished}
                    onChangeDomain={handleChangeDomain}
                    showDomainSelector={true}
                    onComment={setCommentTarget}
                    onPreview={setPreviewItem}
                    showReuse={false}
                  />
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <ImageIcon className="w-16 h-16 text-white/10 mb-4" />
                <h3 className="text-lg font-medium text-white/70 mb-2">
                  {subFilter === "all" ? "还没有发布任何作品" : `还没有发布${subFilter === "image" ? "图像" : subFilter === "video" ? "视频" : "工作流"}作品`}
                </h3>
                <p className="text-sm text-white/40 mb-6">前往工作台，开启你的 AI 创作之旅</p>
                <a
                  href="/chat"
                  className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 text-white text-sm font-medium hover:from-blue-600 hover:to-cyan-600 transition-all"
                >
                  前往工作台
                </a>
              </div>
            )}
          </>
        )}

        {mainTab === "liked" && (
          <>
            {/* 子筛选 Tab：图像 / 视频 */}
            <div className="flex items-center gap-2 mb-6">
              {likedSubTabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setSubFilter(tab.key)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                    subFilter === tab.key
                      ? "bg-white text-black"
                      : "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white/80 border border-white/10"
                  }`}
                >
                  {tab.key === "image" && <ImageIcon className="w-3.5 h-3.5" />}
                  {tab.key === "video" && <VideoIcon className="w-3.5 h-3.5" />}
                  {tab.key === "workflow" && <Workflow className="w-3.5 h-3.5" />}
                  <span>{tab.label}</span>
                  <span className={`${subFilter === tab.key ? "text-black/60" : "text-white/40"}`}>
                    ({tab.count})
                  </span>
                </button>
              ))}
            </div>

            {filteredLikedWorks.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-5">
                {filteredLikedWorks.map((item) => (
                  <WorkCard
                    key={item.id}
                    item={item}
                    onLike={(id) => {
                      const updated = likedWorks.map((w) =>
                        w.id === id ? { ...w, liked: !w.liked, likes: w.likes + (w.liked ? -1 : 1) } : w
                      );
                      setLikedWorks(updated);
                      // 持久化到 localStorage
                      localStorage.setItem(LIKED_WORKS_KEY, JSON.stringify(updated));
                    }}
                    onDelete={handleDeleteLiked}
                    onRename={handleRenameLiked}
                    onComment={setCommentTarget}
                    onPreview={setPreviewItem}
                    showReuse={false}
                  />
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <Heart className="w-16 h-16 text-white/10 mb-4" />
                <h3 className="text-lg font-medium text-white/70 mb-2">还没有点赞任何作品</h3>
                <p className="text-sm text-white/40">前往社区发现更多精彩内容</p>
              </div>
            )}
          </>
        )}

        {mainTab === "favorited" && (
          <>
            {/* 子筛选 Tab：图像 / 视频 / 工作流 */}
            <div className="flex items-center gap-2 mb-6">
              {favoritedSubTabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setSubFilter(tab.key)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                    subFilter === tab.key
                      ? "bg-white text-black"
                      : "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white/80 border border-white/10"
                  }`}
                >
                  {tab.key === "image" && <ImageIcon className="w-3.5 h-3.5" />}
                  {tab.key === "video" && <VideoIcon className="w-3.5 h-3.5" />}
                  {tab.key === "workflow" && <Workflow className="w-3.5 h-3.5" />}
                  <span>{tab.label}</span>
                  <span className={`${subFilter === tab.key ? "text-black/60" : "text-white/40"}`}>
                    ({tab.count})
                  </span>
                </button>
              ))}
            </div>

            {filteredFavoritedWorks.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-5">
                {filteredFavoritedWorks.map((item) => (
                  <WorkCard
                    key={item.id}
                    item={item}
                    onLike={(id) => {
                      const updated = favoritedWorks.map((w) =>
                        w.id === id ? { ...w, liked: !w.liked, likes: w.likes + (w.liked ? -1 : 1) } : w
                      );
                      setFavoritedWorks(updated);
                      localStorage.setItem(FAVORITED_WORKS_KEY, JSON.stringify(updated));
                    }}
                    onFavorite={(id) => {
                      const updated = favoritedWorks.filter((w) => w.id !== id);
                      setFavoritedWorks(updated);
                      localStorage.setItem(FAVORITED_WORKS_KEY, JSON.stringify(updated));
                      toast.success("已取消收藏");
                    }}
                    onComment={setCommentTarget}
                    onPreview={setPreviewItem}
                    showReuse={false}
                  />
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <Bookmark className="w-16 h-16 text-white/10 mb-4" />
                <h3 className="text-lg font-medium text-white/70 mb-2">还没有收藏任何作品</h3>
                <p className="text-sm text-white/40">在社区中发现喜欢的作品，点击收藏保存到这里</p>
              </div>
            )}
          </>
        )}
      </section>

      {/* 作品预览模态框 */}
      {previewItem && (
        <WorkPreviewModal
          item={previewItem}
          onClose={() => setPreviewItem(null)}
          onLike={(id) => {
            if (mainTab === "publish") {
              const cur = myWorks.find((w) => w.id === id);
              if (!cur) return;
              const newLiked = !cur.liked;
              const newLikes = cur.likes + (newLiked ? 1 : -1);
              setMyWorks((prev) => prev.map((w) => w.id === id ? { ...w, liked: newLiked, likes: newLikes } : w));
              toast.success(newLiked ? "已点赞" : "已取消点赞");
            } else if (mainTab === "liked") {
              const updated = likedWorks.map((w) => w.id === id ? { ...w, liked: !w.liked, likes: w.likes + (w.liked ? -1 : 1) } : w);
              setLikedWorks(updated);
              localStorage.setItem(LIKED_WORKS_KEY, JSON.stringify(updated));
            } else if (mainTab === "favorited") {
              const updated = favoritedWorks.map((w) => w.id === id ? { ...w, liked: !w.liked, likes: w.likes + (w.liked ? -1 : 1) } : w);
              setFavoritedWorks(updated);
              localStorage.setItem(FAVORITED_WORKS_KEY, JSON.stringify(updated));
            }
          }}
          onFavorite={(id) => {
            if (mainTab === "favorited") {
              const updated = favoritedWorks.filter((w) => w.id !== id);
              setFavoritedWorks(updated);
              localStorage.setItem(FAVORITED_WORKS_KEY, JSON.stringify(updated));
              toast.success("已取消收藏");
            } else {
              toast.success("已收藏");
            }
          }}
        />
      )}

      {/* 评论面板（简化版社交互动） */}
      {commentTarget && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end justify-center"
          onClick={() => setCommentTarget(null)}
        >
          <div
            className="w-full max-w-xl bg-[#1a1a1a] border-t border-white/10 rounded-t-2xl p-6 max-h-[80vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-white">评论</h3>
                <p className="text-sm text-white/50">{commentTarget.title}</p>
              </div>
              <button
                onClick={() => setCommentTarget(null)}
                className="p-1 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 评论列表 */}
            <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-2">
              {comments.filter((c) => c.workId === commentTarget.id).length === 0 && (
                <div className="text-center py-10 text-white/30 text-sm">
                  <MessageCircle className="w-10 h-10 mx-auto mb-2 opacity-40" />
                  还没有评论，来抢沙发吧
                </div>
              )}
              {comments
                .filter((c) => c.workId === commentTarget.id)
                .map((c) => (
                  <div key={c.id} className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center flex-shrink-0">
                      <User className="w-4 h-4 text-white" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-white">{c.user}</span>
                        <span className="text-xs text-white/40">
                          {new Date(c.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-sm text-white/80 mt-0.5">{c.text}</p>
                    </div>
                  </div>
                ))}
            </div>

            {/* 评论输入 */}
            <div className="flex items-center gap-2 pt-4 border-t border-white/10">
              <input
                type="text"
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submitComment()}
                placeholder="写下你的评论..."
                className="flex-1 px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-white/30 outline-none focus:border-white/30"
              />
              <button
                onClick={submitComment}
                disabled={!commentText.trim()}
                className="px-4 py-2 rounded-lg bg-white text-black text-sm font-medium hover:bg-white/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                发送
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 发布作品弹窗 */}
      {showPublishModal && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => {
            if (!publishUploading) {
              setShowPublishModal(false);
              setPublishFile(null);
              setPublishTitle("");
            }
          }}
        >
          <div
            className="w-full max-w-lg bg-[#141414] border border-white/10 rounded-2xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-white">发布作品</h3>
              <button
                onClick={() => {
                  if (!publishUploading) {
                    setShowPublishModal(false);
                    setPublishFile(null);
                    setPublishTitle("");
                  }
                }}
                className="p-1 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 内容类型选择：图像 / 视频 */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-white/70 mb-2">内容类型</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => { setPublishType("image"); setPublishFile(null); setPublishTitle(""); }}
                  className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-all ${
                    publishType === "image"
                      ? "border-blue-500 bg-blue-500/10 text-white"
                      : "border-white/10 bg-white/5 text-white/60 hover:border-white/20"
                  }`}
                >
                  <ImageIcon className={`w-6 h-6 ${publishType === "image" ? "text-blue-400" : ""}`} />
                  <span className="text-sm font-medium">图像</span>
                  <span className="text-xs text-white/40">PNG / JPG / WEBP</span>
                </button>
                <button
                  onClick={() => { setPublishType("video"); setPublishFile(null); setPublishTitle(""); }}
                  className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-all ${
                    publishType === "video"
                      ? "border-blue-500 bg-blue-500/10 text-white"
                      : "border-white/10 bg-white/5 text-white/60 hover:border-white/20"
                  }`}
                >
                  <FileVideo className={`w-6 h-6 ${publishType === "video" ? "text-blue-400" : ""}`} />
                  <span className="text-sm font-medium">视频</span>
                  <span className="text-xs text-white/40">MP4 / WEBM</span>
                </button>
              </div>
            </div>

            {/* 领域分类选择 */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-white/70 mb-2">领域分类</label>
              <div className="grid grid-cols-3 gap-3">
                {([
                  { key: "architecture", label: "建筑", color: "bg-blue-500/10 text-blue-400 border-blue-500/30" },
                  { key: "ecommerce", label: "电商", color: "bg-green-500/10 text-green-400 border-green-500/30" },
                  { key: "comic", label: "漫剧", color: "bg-purple-500/10 text-purple-400 border-purple-500/30" },
                ] as const).map((d) => (
                  <button
                    key={d.key}
                    onClick={() => setPublishDomain(d.key)}
                    className={`flex items-center justify-center gap-2 p-3 rounded-xl border text-sm font-medium transition-all ${
                      publishDomain === d.key
                        ? d.color
                        : "border-white/10 bg-white/5 text-white/60 hover:border-white/20"
                    }`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 文件上传 */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-white/70 mb-2">
                上传{publishType === "image" ? "图像" : "视频"}
              </label>
              <label
                className={`flex flex-col items-center justify-center gap-2 p-6 rounded-xl border-2 border-dashed transition-all cursor-pointer ${
                  publishFile
                    ? "border-blue-500/50 bg-blue-500/5"
                    : "border-white/20 bg-white/5 hover:border-white/40 hover:bg-white/10"
                }`}
              >
                {publishFile ? (
                  <>
                    {publishType === "image" ? (
                      <ImageIcon className="w-8 h-8 text-blue-400" />
                    ) : (
                      <FileVideo className="w-8 h-8 text-blue-400" />
                    )}
                    <span className="text-sm text-white font-medium truncate max-w-full">{publishFile.name}</span>
                    <span className="text-xs text-white/40">
                      {(publishFile.size / 1024 / 1024).toFixed(2)} MB
                    </span>
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        setPublishFile(null);
                        setPublishTitle("");
                      }}
                      className="text-xs text-red-400 hover:text-red-300 mt-1"
                    >
                      移除文件
                    </button>
                  </>
                ) : (
                  <>
                    <Upload className="w-8 h-8 text-white/30" />
                    <span className="text-sm text-white/60">点击选择{publishType === "image" ? "图像" : "视频"}文件</span>
                    <span className="text-xs text-white/40">
                      {publishType === "image" ? "支持 PNG、JPG、WEBP、SVG" : "支持 MP4、WEBM、MOV"}
                    </span>
                  </>
                )}
                <input
                  type="file"
                  accept={publishType === "image" ? "image/*" : "video/*"}
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setPublishFile(file);
                      // 自动从文件名提取标题
                      const title = extractTitleFromFilename(file.name);
                      setPublishTitle(title);
                    }
                  }}
                />
              </label>
            </div>

            {/* 提交按钮 */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  setShowPublishModal(false);
                  setPublishFile(null);
                  setPublishTitle("");
                }}
                disabled={publishUploading}
                className="flex-1 px-4 py-2.5 rounded-lg border border-white/20 text-white/70 text-sm font-medium hover:bg-white/10 disabled:opacity-40 transition-all"
              >
                取消
              </button>
              <button
                onClick={handlePublish}
                disabled={publishUploading || !publishFile || !publishTitle}
                className="flex-1 px-4 py-2.5 rounded-lg bg-gradient-to-r from-blue-500 to-cyan-500 text-white text-sm font-medium hover:from-blue-600 hover:to-cyan-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                {publishUploading ? "发布中..." : "发布"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
