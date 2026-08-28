"use client";

import type { WorkItem } from "@/components/WorkCard";
import type { StoredWork } from "@/lib/ugc-storage";
import { seedWorks } from "@/lib/ugc-storage";

/**
 * 电商社区永久作品数据集
 *
 * 设计目标：
 * - 恰好 4 张图片 + 5 个视频 + 2 个工作流，共 11 条作品
 * - 数据硬编码在源码中，天然跨刷新 / 服务重启持久（源码即数据）
 * - 同时种子到 IndexedDB（数据库留存），并标记 permanent: true 防删
 * - ID 统一前缀 ecom-perm-，删除逻辑据此拦截
 */

export const ECOM_PERM_PREFIX = "ecom-perm-";

/** 数据留存标记：写入 localStorage，避免重复种子 */
const ECOM_PERM_SEEDED_FLAG = "aga-ecom-perm-seeded-v1";

/**
 * 永久电商作品（4 图 + 5 视频 + 2 工作流）
 * 全部引用本地 /mock-dianshang/ 静态文件，确保稳定可访问
 */
export const PERMANENT_ECOMMERCE_WORKS: WorkItem[] = [
  // ===== 4 张图片 =====
  {
    id: "ecom-perm-img-1",
    title: "产品精修主图",
    preview: "/mock-dianshang/img1.png",
    domain: "ecommerce",
    contentType: "image",
    author: { name: "PhotoShop" },
    likes: 512,
    favoriteCount: 98,
    commentCount: 34,
    liked: true,
    createdAt: new Date(2026, 7, 10).getTime(),
  },
  {
    id: "ecom-perm-img-2",
    title: "模特展示场景图",
    preview: "/mock-dianshang/img2.png",
    domain: "ecommerce",
    contentType: "image",
    author: { name: "PhotoShop" },
    likes: 387,
    favoriteCount: 76,
    commentCount: 22,
    createdAt: new Date(2026, 7, 8).getTime(),
  },
  {
    id: "ecom-perm-img-3",
    title: "商品详情页配图",
    preview: "/mock-dianshang/img3.png",
    domain: "ecommerce",
    contentType: "image",
    author: { name: "VisualStudio" },
    likes: 298,
    favoriteCount: 54,
    commentCount: 16,
    favorited: true,
    createdAt: new Date(2026, 7, 5).getTime(),
  },
  {
    id: "ecom-perm-img-4",
    title: "白底产品图",
    preview: "/mock-dianshang/img4.png",
    domain: "ecommerce",
    contentType: "image",
    author: { name: "VisualStudio" },
    likes: 421,
    favoriteCount: 83,
    commentCount: 28,
    createdAt: new Date(2026, 7, 2).getTime(),
  },
  // ===== 5 个视频 =====
  {
    id: "ecom-perm-vid-1",
    title: "产品展示短片",
    preview: "/mock-dianshang/video1.mp4",
    domain: "ecommerce",
    contentType: "video",
    author: { name: "AdMaker" },
    likes: 198,
    favoriteCount: 41,
    commentCount: 11,
    createdAt: new Date(2026, 6, 25).getTime(),
  },
  {
    id: "ecom-perm-vid-2",
    title: "品牌宣传视频",
    preview: "/mock-dianshang/video2.mp4",
    domain: "ecommerce",
    contentType: "video",
    author: { name: "AdMaker" },
    likes: 256,
    favoriteCount: 58,
    commentCount: 19,
    liked: true,
    createdAt: new Date(2026, 6, 20).getTime(),
  },
  {
    id: "ecom-perm-vid-3",
    title: "商品使用教程",
    preview: "/mock-dianshang/video3.mp4",
    domain: "ecommerce",
    contentType: "video",
    author: { name: "FilmMaker" },
    likes: 143,
    favoriteCount: 32,
    commentCount: 8,
    createdAt: new Date(2026, 6, 15).getTime(),
  },
  {
    id: "ecom-perm-vid-4",
    title: "开箱评测视频",
    preview: "/mock-dianshang/video4.mp4",
    domain: "ecommerce",
    contentType: "video",
    author: { name: "FilmMaker" },
    likes: 312,
    favoriteCount: 67,
    commentCount: 24,
    favorited: true,
    createdAt: new Date(2026, 6, 10).getTime(),
  },
  {
    id: "ecom-perm-vid-5",
    title: "直播切片精选",
    preview: "/mock-dianshang/1.mp4",
    domain: "ecommerce",
    contentType: "video",
    author: { name: "LiveStudio" },
    likes: 175,
    favoriteCount: 38,
    commentCount: 13,
    createdAt: new Date(2026, 6, 5).getTime(),
  },
  // ===== 1 个工作流 =====
  {
    id: "ecom-perm-wf-1",
    title: "商品详情页一键生成工作流",
    preview: "/mock-dianshang/img2.png",
    domain: "ecommerce",
    contentType: "workflow",
    author: { name: "GoodsFlow" },
    likes: 420,
    favoriteCount: 112,
    commentCount: 31,
    liked: true,
    createdAt: new Date(2026, 7, 15).getTime(),
  },
];

/** 预期数量常量（验证基准） */
export const EXPECTED_ECOM_IMAGES = 4;
export const EXPECTED_ECOM_VIDEOS = 5;
export const EXPECTED_ECOM_WORKFLOWS = 1;

/**
 * 判断 ID 是否为电商永久作品
 */
export function isPermanentEcommerceWork(id: string): boolean {
  return id.startsWith(ECOM_PERM_PREFIX);
}

/**
 * 验证永久电商作品集数量一致性
 * 确保：恰好 4 张图片 + 5 个视频 + 1 个工作流，不多不少
 * 返回校验结果与实际数量
 */
export function validatePermanentEcommerceWorks(): {
  valid: boolean;
  imageCount: number;
  videoCount: number;
  workflowCount: number;
  total: number;
} {
  const imageCount = PERMANENT_ECOMMERCE_WORKS.filter(
    (w) => w.contentType === "image",
  ).length;
  const videoCount = PERMANENT_ECOMMERCE_WORKS.filter(
    (w) => w.contentType === "video",
  ).length;
  const workflowCount = PERMANENT_ECOMMERCE_WORKS.filter(
    (w) => w.contentType === "workflow",
  ).length;
  const valid =
    imageCount === EXPECTED_ECOM_IMAGES &&
    videoCount === EXPECTED_ECOM_VIDEOS &&
    workflowCount === EXPECTED_ECOM_WORKFLOWS;
  return {
    valid,
    imageCount,
    videoCount,
    workflowCount,
    total: PERMANENT_ECOMMERCE_WORKS.length,
  };
}

/**
 * 将永久作品种子到 IndexedDB（数据库留存）
 * - 标记 permanent: true，deleteWork 据此拒绝删除
 * - 使用 localStorage flag 做幂等控制，避免重复写入
 * - IndexedDB 不可用时静默降级，不阻塞页面（源码仍是数据源）
 */
export async function seedPermanentEcommerceWorks(force = false): Promise<void> {
  if (typeof window === "undefined") return;
  if (!force && localStorage.getItem(ECOM_PERM_SEEDED_FLAG) === "1") return;

  // 转换为 StoredWork 并标记永久
  const stored: StoredWork[] = PERMANENT_ECOMMERCE_WORKS.map((w) => ({
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
    localStorage.setItem(ECOM_PERM_SEEDED_FLAG, "1");
  } catch (e) {
    // IndexedDB 不可用时静默降级：源码数组仍是展示数据源
    console.warn("[ecommerce-permanent] IndexedDB 种子失败，使用源码兜底:", e);
  }
}
