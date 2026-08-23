"use client";

import type { WorkItem } from "@/components/WorkCard";
import type { StoredWork } from "@/lib/ugc-storage";
import { seedWorks } from "@/lib/ugc-storage";

/**
 * 建筑社区永久作品数据集
 *
 * 设计目标：
 * - 恰好 8 张图片 + 4 个视频，共 12 条作品
 * - 数据硬编码在源码中，天然跨刷新 / 服务重启持久（源码即数据）
 * - 同时种子到 IndexedDB（数据库留存），并标记 permanent: true 防删
 * - ID 统一前缀 arch-perm-，删除逻辑据此拦截
 */

export const ARCH_PERM_PREFIX = "arch-perm-";

/** 数据留存标记：写入 localStorage，避免重复种子 */
const ARCH_PERM_SEEDED_FLAG = "aga-arch-perm-seeded-v1";

/**
 * 永久建筑作品（8 图 + 4 视频）
 * 全部引用本地 /mock-arch/ 静态文件，确保稳定可访问
 */
export const PERMANENT_ARCHITECTURE_WORKS: WorkItem[] = [
  // ===== 8 张图片 =====
  {
    id: "arch-perm-img-1",
    title: "山地梯田建筑效果图",
    preview: "/mock-arch/1.png",
    domain: "architecture",
    contentType: "image",
    author: { name: "RenderPro" },
    likes: 256,
    favoriteCount: 45,
    commentCount: 12,
    favorited: true,
    createdAt: new Date(2026, 6, 8).getTime(),
  },
  {
    id: "arch-perm-img-2",
    title: "现代别墅黄昏渲染",
    preview: "/mock-arch/2.png",
    domain: "architecture",
    contentType: "image",
    author: { name: "RenderPro" },
    likes: 198,
    favoriteCount: 32,
    commentCount: 8,
    createdAt: new Date(2026, 6, 28).getTime(),
  },
  {
    id: "arch-perm-img-3",
    title: "城市综合体鸟瞰图",
    preview: "/mock-arch/3.png",
    domain: "architecture",
    contentType: "image",
    author: { name: "RenderPro" },
    likes: 312,
    favoriteCount: 67,
    commentCount: 21,
    liked: true,
    createdAt: new Date(2026, 6, 15).getTime(),
  },
  {
    id: "arch-perm-img-4",
    title: "滨水文化中心夜景",
    preview: "/mock-arch/4.png",
    domain: "architecture",
    contentType: "image",
    author: { name: "RenderPro" },
    likes: 175,
    favoriteCount: 28,
    commentCount: 6,
    createdAt: new Date(2026, 6, 2).getTime(),
  },
  {
    id: "arch-perm-img-5",
    title: "极简住宅外观表现",
    preview: "/mock-arch/5.png",
    domain: "architecture",
    contentType: "image",
    author: { name: "RenderPro" },
    likes: 224,
    favoriteCount: 38,
    commentCount: 10,
    createdAt: new Date(2026, 7, 5).getTime(),
  },
  {
    id: "arch-perm-img-6",
    title: "工业风改造空间渲染",
    preview: "/mock-arch/mock-01.png",
    domain: "architecture",
    contentType: "image",
    author: { name: "RenderPro" },
    likes: 143,
    favoriteCount: 19,
    commentCount: 4,
    createdAt: new Date(2026, 7, 15).getTime(),
  },
  {
    id: "arch-perm-img-7",
    title: "生态绿色建筑效果",
    preview: "/mock-arch/7.png",
    domain: "architecture",
    contentType: "image",
    author: { name: "RenderPro" },
    likes: 267,
    favoriteCount: 52,
    commentCount: 15,
    favorited: true,
    createdAt: new Date(2026, 6, 20).getTime(),
  },
  {
    id: "arch-perm-img-8",
    title: "未来概念建筑透视",
    preview: "/mock-arch/8.png",
    domain: "architecture",
    contentType: "image",
    author: { name: "RenderPro" },
    likes: 189,
    favoriteCount: 35,
    commentCount: 9,
    createdAt: new Date(2026, 6, 12).getTime(),
  },
  // ===== 4 个视频 =====
  {
    id: "arch-perm-vid-1",
    title: "建筑漫游动画",
    preview: "/mock-arch/mock-v1.mp4",
    domain: "architecture",
    contentType: "video",
    author: { name: "FilmMaker" },
    likes: 189,
    favoriteCount: 34,
    commentCount: 11,
    createdAt: new Date(2026, 6, 5).getTime(),
  },
  {
    id: "arch-perm-vid-2",
    title: "室内空间巡游",
    preview: "/mock-arch/mock-v2.mp4",
    domain: "architecture",
    contentType: "video",
    author: { name: "FilmMaker" },
    likes: 156,
    favoriteCount: 27,
    commentCount: 8,
    liked: true,
    createdAt: new Date(2026, 6, 3).getTime(),
  },
  {
    id: "arch-perm-vid-3",
    title: "建筑生长动画",
    preview: "/mock-arch/mock-v3.mp4",
    domain: "architecture",
    contentType: "video",
    author: { name: "StudioArch" },
    likes: 203,
    favoriteCount: 42,
    commentCount: 14,
    favorited: true,
    createdAt: new Date(2026, 5, 28).getTime(),
  },
  {
    id: "arch-perm-vid-4",
    title: "日落光影变化",
    preview: "/mock-arch/mock-v4.mp4",
    domain: "architecture",
    contentType: "video",
    author: { name: "StudioArch" },
    likes: 142,
    favoriteCount: 23,
    commentCount: 6,
    createdAt: new Date(2026, 5, 20).getTime(),
  },
];

/** 预期数量常量（验证基准） */
export const EXPECTED_ARCH_IMAGES = 8;
export const EXPECTED_ARCH_VIDEOS = 4;

/**
 * 判断 ID 是否为建筑永久作品
 */
export function isPermanentArchitectureWork(id: string): boolean {
  return id.startsWith(ARCH_PERM_PREFIX);
}

/**
 * 验证永久建筑作品集数量一致性
 * 确保：恰好 8 张图片 + 4 个视频，不多不少
 */
export function validatePermanentArchitectureWorks(): {
  valid: boolean;
  imageCount: number;
  videoCount: number;
  total: number;
} {
  const imageCount = PERMANENT_ARCHITECTURE_WORKS.filter(
    (w) => w.contentType === "image",
  ).length;
  const videoCount = PERMANENT_ARCHITECTURE_WORKS.filter(
    (w) => w.contentType === "video",
  ).length;
  const valid =
    imageCount === EXPECTED_ARCH_IMAGES &&
    videoCount === EXPECTED_ARCH_VIDEOS;
  return {
    valid,
    imageCount,
    videoCount,
    total: PERMANENT_ARCHITECTURE_WORKS.length,
  };
}

/**
 * 将永久作品种子到 IndexedDB（数据库留存）
 * - 标记 permanent: true，deleteWork 据此拒绝删除
 * - 使用 localStorage flag 做幂等控制，避免重复写入
 * - IndexedDB 不可用时静默降级，不阻塞页面（源码仍是数据源）
 */
export async function seedPermanentArchitectureWorks(force = false): Promise<void> {
  if (typeof window === "undefined") return;
  if (!force && localStorage.getItem(ARCH_PERM_SEEDED_FLAG) === "1") return;

  const stored: StoredWork[] = PERMANENT_ARCHITECTURE_WORKS.map((w) => ({
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
    localStorage.setItem(ARCH_PERM_SEEDED_FLAG, "1");
  } catch (e) {
    console.warn("[architecture-permanent] IndexedDB 种子失败，使用源码兜底:", e);
  }
}
