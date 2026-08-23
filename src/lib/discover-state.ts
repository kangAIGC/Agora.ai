"use client";

import type { Domain, ContentType } from "@/components/WorkCard";

/**
 * 社区（Discover）页面状态持久化
 *
 * 保存范围：
 * - 筛选状态：领域分类、内容形式、排序方式
 * - 滚动位置：页面垂直滚动偏移
 * - 交互状态：已点赞 / 已收藏 / 已预览（已读）的作品 ID
 * - UI 状态：排序菜单展开、上传弹窗展开
 * - 用户输入：上传标题临时文本
 *
 * 存储介质：localStorage（跨刷新、跨重启持久，浏览器级留存）
 */

const STORAGE_KEY = "aga-discover-state-v1";

export interface DiscoverState {
  /** 当前选中的领域分类 */
  activeDomain: Domain;
  /** 当前选中的内容形式（null = 全部） */
  activeType: ContentType | null;
  /** 排序方式 */
  sortBy: "recommend" | "hot";
  /** 页面垂直滚动位置 */
  scrollY: number;
  /** 已点赞的作品 ID 列表（含永久作品，刷新后恢复） */
  likedIds: string[];
  /** 已收藏的作品 ID 列表 */
  favoritedIds: string[];
  /** 已预览/已读的作品 ID 列表 */
  viewedIds: string[];
  /** 排序菜单是否展开 */
  sortMenuOpen: boolean;
  /** 上传弹窗是否展开 */
  showUploadModal: boolean;
  /** 上传弹窗中用户输入的标题文本 */
  uploadTitle: string;
}

/**
 * 从 localStorage 加载已保存的社区页面状态
 * 若无保存数据或解析失败，返回 null
 */
export function loadDiscoverState(): Partial<DiscoverState> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed as Partial<DiscoverState>;
  } catch {
    return null;
  }
}

/**
 * 将社区页面状态保存到 localStorage
 * 采用合并策略：传入的字段覆盖已有字段，未传入的保留
 */
export function saveDiscoverState(patch: Partial<DiscoverState>): void {
  if (typeof window === "undefined") return;
  try {
    const current = loadDiscoverState() ?? {};
    const merged = { ...current, ...patch };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
  } catch {
    // localStorage 满或不可用时静默降级
  }
}

/**
 * 清除社区页面状态（调试/重置用）
 */
export function clearDiscoverState(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // 静默
  }
}
