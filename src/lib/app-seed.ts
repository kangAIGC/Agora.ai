"use client";

import type { WorkItem } from "@/components/WorkCard";
import type { StoredWork, WorkScope } from "@/lib/ugc-storage";
import { seedWorks as seedWorksDB } from "@/lib/ugc-storage";

export const PROFILE_SEED_FLAG = "aga-profile-seeded-v6";
export const GLOBAL_APP_SEED_FLAG = "aga-app-seeded-v2";

// ============ Profile 12 条发布作品（硬编码 mock，4建筑 + 4电商 + 4漫剧） ============
export const PROFILE_SEED_WORKS: StoredWork[] = [
  // 建筑 × 4
  {
    id: "pub-arch-1", title: "山地建筑效果图", domain: "architecture", contentType: "image",
    author: { name: "Aigc.Kang" }, likes: 32, favoriteCount: 5, commentCount: 2, fileType: "image/png",
    createdAt: Date.now() - 86400000 * 7, scope: "profile", previewUrl: "/mock-arch/1.png",
  },
  {
    id: "pub-arch-2", title: "现代别墅渲染", domain: "architecture", contentType: "image",
    author: { name: "Aigc.Kang" }, likes: 58, favoriteCount: 12, commentCount: 4, fileType: "image/png",
    createdAt: Date.now() - 86400000 * 6, scope: "profile", previewUrl: "/mock-arch/2.png",
  },
  {
    id: "pub-arch-3", title: "建筑漫游视频", domain: "architecture", contentType: "video",
    author: { name: "Aigc.Kang" }, likes: 21, favoriteCount: 3, commentCount: 1, fileType: "video/mp4",
    createdAt: Date.now() - 86400000 * 5, scope: "profile", previewUrl: "/mock-arch/mock-v1.mp4",
  },
  {
    id: "pub-arch-4", title: "园区规划动画", domain: "architecture", contentType: "video",
    author: { name: "Aigc.Kang" }, likes: 44, favoriteCount: 8, commentCount: 3, fileType: "video/mp4",
    createdAt: Date.now() - 86400000 * 4, scope: "profile", previewUrl: "/mock-arch/mock-v2.mp4",
  },
  // 电商 × 4
  {
    id: "pub-ecom-1", title: "产品精修主图", domain: "ecommerce", contentType: "image",
    author: { name: "Aigc.Kang" }, likes: 76, favoriteCount: 15, commentCount: 6, fileType: "image/png",
    createdAt: Date.now() - 86400000 * 3, scope: "profile", previewUrl: "/mock-dianshang/img1.png",
  },
  {
    id: "pub-ecom-2", title: "模特展示图", domain: "ecommerce", contentType: "image",
    author: { name: "Aigc.Kang" }, likes: 102, favoriteCount: 22, commentCount: 9, fileType: "image/png",
    createdAt: Date.now() - 86400000 * 2, scope: "profile", previewUrl: "/mock-dianshang/img2.png",
  },
  {
    id: "pub-ecom-3", title: "产品展示视频", domain: "ecommerce", contentType: "video",
    author: { name: "Aigc.Kang" }, likes: 33, favoriteCount: 6, commentCount: 2, fileType: "video/mp4",
    createdAt: Date.now() - 86400000 * 2, scope: "profile", previewUrl: "/mock-dianshang/video1.mp4",
  },
  {
    id: "pub-ecom-4", title: "品牌宣传视频", domain: "ecommerce", contentType: "video",
    author: { name: "Aigc.Kang" }, likes: 51, favoriteCount: 10, commentCount: 5, fileType: "video/mp4",
    createdAt: Date.now() - 86400000, scope: "profile", previewUrl: "/mock-dianshang/video2.mp4",
  },
  // 漫剧 × 4
  {
    id: "pub-comic-1", title: "苏挽人物立绘", domain: "comic", contentType: "image",
    author: { name: "Aigc.Kang" }, likes: 215, favoriteCount: 48, commentCount: 18, fileType: "image/png",
    createdAt: Date.now() - 86400000 * 4 + 3600000, scope: "profile", previewUrl: "/mock-manju/苏挽.png",
  },
  {
    id: "pub-comic-2", title: "诛仙台场景", domain: "comic", contentType: "image",
    author: { name: "Aigc.Kang" }, likes: 168, favoriteCount: 35, commentCount: 12, fileType: "image/png",
    createdAt: Date.now() - 86400000 * 3 + 3600000, scope: "profile", previewUrl: "/mock-manju/诛仙台.png",
  },
  {
    id: "pub-comic-3", title: "分镜动画预演", domain: "comic", contentType: "video",
    author: { name: "Aigc.Kang" }, likes: 89, favoriteCount: 18, commentCount: 7, fileType: "video/mp4",
    createdAt: Date.now() - 86400000 + 3600000, scope: "profile", previewUrl: "/mock-manju/视频0-30s.mp4",
  },
  {
    id: "pub-comic-4", title: "墨玉牌特写", domain: "comic", contentType: "image",
    author: { name: "Aigc.Kang" }, likes: 132, favoriteCount: 28, commentCount: 11, fileType: "image/png",
    createdAt: Date.now() - 3600000, scope: "profile", previewUrl: "/mock-manju/墨玉牌.png",
  },
  // 工作流 × 3（每个领域 1 条）
  {
    id: "pub-wf-arch", title: "建筑概念方案一键生成工作流", domain: "architecture", contentType: "workflow",
    author: { name: "Aigc.Kang" }, likes: 97, favoriteCount: 21, commentCount: 8, fileType: "application/agora-workflow",
    createdAt: Date.now() - 86400000 * 1.5, scope: "profile", previewUrl: "/mock-arch/mock-01.png",
  },
  {
    id: "pub-wf-ecom", title: "商品详情页一键生成工作流", domain: "ecommerce", contentType: "workflow",
    author: { name: "Aigc.Kang" }, likes: 84, favoriteCount: 18, commentCount: 5, fileType: "application/agora-workflow",
    createdAt: Date.now() - 86400000 * 0.75, scope: "profile", previewUrl: "/mock-dianshang/img1.png",
  },
  {
    id: "pub-wf-comic", title: "古风仙侠漫剧一键生成工作流", domain: "comic", contentType: "workflow",
    author: { name: "Aigc.Kang" }, likes: 158, favoriteCount: 41, commentCount: 15, fileType: "application/agora-workflow",
    createdAt: Date.now() - 7200000, scope: "profile", previewUrl: "/mock-manju/青云大殿.png",
  },
];

// ============ 点赞的 4 条作品（硬编码 mock，localStorage） ============
export const LIKED_SEED_WORKS: WorkItem[] = [
  {
    id: "liked-1",
    title: "现代建筑渲染图",
    preview: "/mock-arch/mock-03.png",
    domain: "architecture",
    contentType: "image",
    author: { name: "ArchDesign", avatar: "/mock-arch/avatar.jpg" },
    likes: 128,
    favoriteCount: 24,
    commentCount: 6,
    liked: true,
  },
  {
    id: "liked-2",
    title: "青云大殿场景",
    preview: "/mock-manju/青云大殿.png",
    domain: "comic",
    contentType: "image",
    author: { name: "漫剧工作室" },
    likes: 342,
    favoriteCount: 68,
    commentCount: 19,
    liked: true,
  },
  {
    id: "liked-3",
    title: "萧珩人物立绘",
    preview: "/mock-manju/萧珩.png",
    domain: "comic",
    contentType: "image",
    author: { name: "画师小林" },
    likes: 256,
    favoriteCount: 47,
    commentCount: 13,
    liked: true,
  },
  {
    id: "liked-4",
    title: "产品展示视频",
    preview: "/mock-dianshang/1.mp4",
    domain: "ecommerce",
    contentType: "video",
    author: { name: "电商运营" },
    likes: 89,
    favoriteCount: 12,
    commentCount: 3,
    liked: true,
  },
  {
    id: "liked-5",
    title: "建筑概念方案一键生成工作流",
    preview: "/mock-arch/mock-03.png",
    domain: "architecture",
    contentType: "workflow",
    author: { name: "ArchDesign" },
    likes: 512,
    favoriteCount: 96,
    commentCount: 22,
    liked: true,
  },
];

// ============ 收藏的 3 条作品（硬编码 mock，localStorage） ============
export const FAVORITED_SEED_WORKS: WorkItem[] = [
  {
    id: "fav-1",
    title: "极简主义室内设计",
    preview: "/mock-arch/mock-02.png",
    domain: "architecture",
    contentType: "image",
    author: { name: "空间设计", avatar: "/mock-arch/avatar.jpg" },
    likes: 326,
    favoriteCount: 128,
    commentCount: 24,
    favorited: true,
  },
  {
    id: "fav-2",
    title: "墨玉牌特写",
    preview: "/mock-manju/墨玉牌.png",
    domain: "comic",
    contentType: "image",
    author: { name: "道具组" },
    likes: 198,
    favoriteCount: 95,
    commentCount: 11,
    favorited: true,
  },
  {
    id: "fav-3",
    title: "模特展示图",
    preview: "/mock-dianshang/img2.png",
    domain: "ecommerce",
    contentType: "image",
    author: { name: "电商视觉" },
    likes: 467,
    favoriteCount: 210,
    commentCount: 38,
    favorited: true,
  },
  {
    id: "fav-4",
    title: "古风仙侠漫剧一键生成工作流",
    preview: "/mock-manju/青云大殿.png",
    domain: "comic",
    contentType: "workflow",
    author: { name: "漫剧工作室" },
    likes: 628,
    favoriteCount: 204,
    commentCount: 41,
    favorited: true,
  },
];

/**
 * 全局首次种子初始化（在应用启动时调用一次，任何页面都可调用）
 * - 写入 profile 模块 12 条作品（元数据 + previewUrl，无 blob）
 * - 写入点赞的 4 条 mock 作品
 * 特点：
 * - 使用 localStorage flag 做幂等控制，跨浏览器安全
 * - IndexedDB 失败时不抛出，避免阻塞页面渲染
 */
export async function runGlobalAppSeed(force = false): Promise<void> {
  if (typeof window === "undefined") return;
  if (!force && localStorage.getItem(GLOBAL_APP_SEED_FLAG) === "1") return;

  try {
    // 1) Profile seed（发布的12条作品）
    if (force || !localStorage.getItem(PROFILE_SEED_FLAG)) {
      try {
        await seedWorksDB(PROFILE_SEED_WORKS);
      } catch (e) {
        // IndexedDB 异常时，仍写 flag，避免反复尝试阻塞页面；profile 组件仍能 fallback 显示 mock
        console.warn("[app-seed] seedWorksDB 失败，将使用内存 mock 回退:", e);
      }
      try {
        localStorage.setItem(PROFILE_SEED_FLAG, "1");
      } catch {
        /* ignore */
      }
    }

    // 2) Liked seed（点赞4条，localStorage）
    try {
      const key = "aga-profile-liked-works";
      const existing = localStorage.getItem(key);
      if (!existing) {
        localStorage.setItem(key, JSON.stringify(LIKED_SEED_WORKS));
      }
    } catch {
      /* ignore */
    }

    // 3) Favorited seed（收藏3条，localStorage）
    try {
      const favKey = "aga-profile-favorited-works";
      const existingFav = localStorage.getItem(favKey);
      if (!existingFav) {
        localStorage.setItem(favKey, JSON.stringify(FAVORITED_SEED_WORKS));
      }
    } catch {
      /* ignore */
    }

    // 4) 标记全局 seed 已完成
    try {
      localStorage.setItem(GLOBAL_APP_SEED_FLAG, "1");
    } catch {
      /* ignore */
    }
  } catch (e) {
    console.error("[app-seed] 全局 seed 异常:", e);
  }
}

/**
 * 根据 scope 获取种子中的静态作品（不依赖 localStorage/IndexedDB）
 * 用于极端情况下直接渲染 mock 内容，避免页面空白
 */
export function getStaticWorksByScope(scope: WorkScope): StoredWork[] {
  if (scope === "profile") return PROFILE_SEED_WORKS;
  return [];
}
