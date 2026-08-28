"use client";

import type { WorkItem } from "@/components/WorkCard";
import type { StoredWork } from "@/lib/ugc-storage";
import { seedWorks } from "@/lib/ugc-storage";

/**
 * 漫剧社区永久作品数据集
 *
 * 设计目标：
 * - 恰好 9 张图片 + 1 个视频 + 2 个工作流，共 12 条作品
 * - 数据硬编码在源码中，天然跨刷新 / 服务重启持久（源码即数据）
 * - 同时种子到 IndexedDB（数据库留存），并标记 permanent: true 防删
 * - ID 统一前缀 comic-perm-，删除逻辑据此拦截
 */

export const COMIC_PERM_PREFIX = "comic-perm-";

/** 数据留存标记：写入 localStorage，避免重复种子 */
const COMIC_PERM_SEEDED_FLAG = "aga-comic-perm-seeded-v1";

/**
 * 永久漫剧作品（9 图 + 1 视频 + 2 工作流）
 * 全部引用本地 /mock-manju/ 静态文件，确保稳定可访问
 */
export const PERMANENT_COMIC_WORKS: WorkItem[] = [
  // ===== 9 张图片 =====
  {
    id: "comic-perm-img-1",
    title: "半块碎玉",
    preview: "/mock-manju/半块碎玉.png",
    domain: "comic",
    contentType: "image",
    author: { name: "ManJuStudio" },
    likes: 612,
    favoriteCount: 128,
    commentCount: 42,
    liked: true,
    createdAt: new Date(2026, 7, 12).getTime(),
  },
  {
    id: "comic-perm-img-2",
    title: "墨断剑红绳",
    preview: "/mock-manju/墨断剑红绳.png",
    domain: "comic",
    contentType: "image",
    author: { name: "ManJuStudio" },
    likes: 487,
    favoriteCount: 96,
    commentCount: 31,
    createdAt: new Date(2026, 7, 10).getTime(),
  },
  {
    id: "comic-perm-img-3",
    title: "墨玉牌",
    preview: "/mock-manju/墨玉牌.png",
    domain: "comic",
    contentType: "image",
    author: { name: "InkArt" },
    likes: 398,
    favoriteCount: 74,
    commentCount: 23,
    createdAt: new Date(2026, 7, 8).getTime(),
  },
  {
    id: "comic-perm-img-4",
    title: "灭门旧夜",
    preview: "/mock-manju/灭门旧夜.png",
    domain: "comic",
    contentType: "image",
    author: { name: "InkArt" },
    likes: 521,
    favoriteCount: 103,
    commentCount: 38,
    favorited: true,
    createdAt: new Date(2026, 7, 5).getTime(),
  },
  {
    id: "comic-perm-img-5",
    title: "玄青上人",
    preview: "/mock-manju/玄青上人.png",
    domain: "comic",
    contentType: "image",
    author: { name: "CharacterLab" },
    likes: 456,
    favoriteCount: 89,
    commentCount: 27,
    createdAt: new Date(2026, 7, 3).getTime(),
  },
  {
    id: "comic-perm-img-6",
    title: "苏挽",
    preview: "/mock-manju/苏挽.png",
    domain: "comic",
    contentType: "image",
    author: { name: "CharacterLab" },
    likes: 634,
    favoriteCount: 142,
    commentCount: 46,
    liked: true,
    createdAt: new Date(2026, 7, 1).getTime(),
  },
  {
    id: "comic-perm-img-7",
    title: "萧珩",
    preview: "/mock-manju/萧珩.png",
    domain: "comic",
    contentType: "image",
    author: { name: "CharacterLab" },
    likes: 572,
    favoriteCount: 118,
    commentCount: 35,
    createdAt: new Date(2026, 6, 28).getTime(),
  },
  {
    id: "comic-perm-img-8",
    title: "诛仙台",
    preview: "/mock-manju/诛仙台.png",
    domain: "comic",
    contentType: "image",
    author: { name: "SceneCraft" },
    likes: 343,
    favoriteCount: 61,
    commentCount: 19,
    favorited: true,
    createdAt: new Date(2026, 6, 25).getTime(),
  },
  {
    id: "comic-perm-img-9",
    title: "青云大殿",
    preview: "/mock-manju/青云大殿.png",
    domain: "comic",
    contentType: "image",
    author: { name: "SceneCraft" },
    likes: 412,
    favoriteCount: 82,
    commentCount: 24,
    createdAt: new Date(2026, 6, 20).getTime(),
  },
  // ===== 1 个视频 =====
  {
    id: "comic-perm-vid-1",
    title: "漫剧先导预告",
    preview: "/mock-manju/视频0-30s.mp4",
    domain: "comic",
    contentType: "video",
    author: { name: "ManJuStudio" },
    likes: 728,
    favoriteCount: 165,
    commentCount: 53,
    liked: true,
    createdAt: new Date(2026, 6, 15).getTime(),
  },
  // ===== 1 个工作流 =====
  {
    id: "comic-perm-wf-1",
    title: "古风仙侠漫剧一键生成工作流",
    preview: "/mock-manju/玄青上人.png",
    domain: "comic",
    contentType: "workflow",
    author: { name: "CharFlow" },
    likes: 683,
    favoriteCount: 157,
    commentCount: 48,
    liked: true,
    createdAt: new Date(2026, 7, 18).getTime(),
  },
];

/** 预期数量常量（验证基准） */
export const EXPECTED_COMIC_IMAGES = 9;
export const EXPECTED_COMIC_VIDEOS = 1;
export const EXPECTED_COMIC_WORKFLOWS = 1;

/**
 * 判断 ID 是否为漫剧永久作品
 */
export function isPermanentComicWork(id: string): boolean {
  return id.startsWith(COMIC_PERM_PREFIX);
}

/**
 * 验证永久漫剧作品集数量一致性
 * 确保：恰好 9 张图片 + 1 个视频 + 1 个工作流，不多不少
 */
export function validatePermanentComicWorks(): {
  valid: boolean;
  imageCount: number;
  videoCount: number;
  workflowCount: number;
  total: number;
} {
  const imageCount = PERMANENT_COMIC_WORKS.filter(
    (w) => w.contentType === "image",
  ).length;
  const videoCount = PERMANENT_COMIC_WORKS.filter(
    (w) => w.contentType === "video",
  ).length;
  const workflowCount = PERMANENT_COMIC_WORKS.filter(
    (w) => w.contentType === "workflow",
  ).length;
  const valid =
    imageCount === EXPECTED_COMIC_IMAGES &&
    videoCount === EXPECTED_COMIC_VIDEOS &&
    workflowCount === EXPECTED_COMIC_WORKFLOWS;
  return {
    valid,
    imageCount,
    videoCount,
    workflowCount,
    total: PERMANENT_COMIC_WORKS.length,
  };
}

/**
 * 将永久作品种子到 IndexedDB（数据库留存）
 * - 标记 permanent: true，deleteWork 据此拒绝删除
 * - 使用 localStorage flag 做幂等控制，避免重复写入
 * - IndexedDB 不可用时静默降级，不阻塞页面（源码仍是数据源）
 */
export async function seedPermanentComicWorks(force = false): Promise<void> {
  if (typeof window === "undefined") return;
  if (!force && localStorage.getItem(COMIC_PERM_SEEDED_FLAG) === "1") return;

  const stored: StoredWork[] = PERMANENT_COMIC_WORKS.map((w) => ({
    id: w.id,
    title: w.title,
    domain: w.domain,
    contentType: w.contentType,
    author: w.author,
    likes: w.likes,
    liked: w.liked,
    favorited: w.favorited,
    favoriteCount: w.favoriteCount,
    commentCount: w.commentCount,
    fileType: w.contentType === "image" ? "image/png" : "video/mp4",
    createdAt: w.createdAt ?? Date.now(),
    previewUrl: w.preview,
    scope: "community",
    permanent: true,
  }));

  try {
    await seedWorks(stored);
    localStorage.setItem(COMIC_PERM_SEEDED_FLAG, "1");
  } catch (e) {
    console.warn("[comic-permanent] IndexedDB 种子失败，使用源码兜底:", e);
  }
}
