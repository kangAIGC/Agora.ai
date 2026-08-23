"use client";

import type { Domain, ContentType } from "@/components/WorkCard";

const DB_NAME = "aga-ugc";
const DB_VERSION = 1;
const WORKS_STORE = "works";
const FILES_STORE = "files";

/**
 * 作品所属模块范围
 * - community: 社区/发现页作品
 * - profile: 个人主页作品
 */
export type WorkScope = "community" | "profile";

/**
 * 持久化存储的作品元数据（不含文件内容）
 * 文件 Blob 单独存在 FILES_STORE 中，key = workId
 */
export interface StoredWork {
  id: string;
  title: string;
  domain: Domain;
  contentType: ContentType;
  author: { name: string; avatar?: string };
  likes: number;
  liked?: boolean;
  favorited?: boolean;
  favoriteCount?: number;
  commentCount?: number;
  fileType: string;
  createdAt: number;
  previewUrl?: string;
  scope?: WorkScope;
  /**
   * 历史遗留字段：早期用于阻止永久作品被删除。
   * 当前实现下所有作品均允许用户主动删除，此字段仅作向后兼容保留，
   * 不再产生任何阻止删除的副作用。新数据可不再写入此字段。
   */
  permanent?: boolean;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("IndexedDB 不可用"));
  }
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(WORKS_STORE)) {
        db.createObjectStore(WORKS_STORE, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(FILES_STORE)) {
        db.createObjectStore(FILES_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return dbPromise;
}

/**
 * 保存作品元数据 + 文件 Blob（事务写入）
 * 同时监听 onabort，捕获大文件写入被中止的情况
 */
export async function saveWork(work: StoredWork, blob: Blob): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([WORKS_STORE, FILES_STORE], "readwrite");
    tx.objectStore(WORKS_STORE).put(work);
    tx.objectStore(FILES_STORE).put(blob, work.id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error("写入事务出错"));
    tx.onabort = () => reject(tx.error || new Error("写入事务被中止（可能文件过大或存储空间不足）"));
  });
}

/**
 * 更新作品元数据（不动文件）
 */
export async function updateWork(work: StoredWork): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(WORKS_STORE, "readwrite");
    tx.objectStore(WORKS_STORE).put(work);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * 获取所有作品元数据
 */
export async function getAllWorks(): Promise<StoredWork[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(WORKS_STORE, "readonly");
    const request = tx.objectStore(WORKS_STORE).getAll();
    request.onsuccess = () => resolve(request.result as StoredWork[]);
    request.onerror = () => reject(request.error);
  });
}

/**
 * 按 scope 获取作品元数据（隔离社区/个人数据）
 * 无 scope 的旧数据默认归为 community（向后兼容）
 */
export async function getWorksByScope(scope: WorkScope): Promise<StoredWork[]> {
  const all = await getAllWorks();
  return all.filter((w) => {
    if (w.scope === scope) return true;
    // 向后兼容：没有 scope 的旧数据归为 community
    if (!w.scope && scope === "community") return true;
    return false;
  });
}

/**
 * 获取指定作品的文件 Blob
 */
export async function getFileBlob(id: string): Promise<Blob | undefined> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(FILES_STORE, "readonly");
    const request = tx.objectStore(FILES_STORE).get(id);
    request.onsuccess = () => resolve(request.result as Blob | undefined);
    request.onerror = () => reject(request.error);
  });
}

/**
 * 批量获取文件 Blob（单事务，减少开销）
 */
export async function getFileBlobs(ids: string[]): Promise<Map<string, Blob>> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(FILES_STORE, "readonly");
    const store = tx.objectStore(FILES_STORE);
    const result = new Map<string, Blob>();
    let pending = ids.length;
    if (pending === 0) {
      resolve(result);
      return;
    }
    ids.forEach((id) => {
      const req = store.get(id);
      req.onsuccess = () => {
        if (req.result) result.set(id, req.result as Blob);
        pending--;
        if (pending === 0) resolve(result);
      };
      req.onerror = () => {
        pending--;
        if (pending === 0) resolve(result);
      };
    });
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * 删除作品元数据 + 文件 Blob
 * 所有作品（含历史遗留的 permanent 标记作品）均允许用户主动删除，
 * 删除后不可恢复；如需恢复默认作品集，由调用方触发 force seed 重建。
 */
export async function deleteWork(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([WORKS_STORE, FILES_STORE], "readwrite");
    tx.objectStore(WORKS_STORE).delete(id);
    tx.objectStore(FILES_STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ============ 已删除的 Mock 作品 id 列表 ============
// Mock 数据无法从源数组删除，故持久化"已删除 id"集合，加载时过滤
const DELETED_MOCK_KEY = "__deleted_mock_ids__";

export async function getDeletedMockIds(): Promise<string[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(FILES_STORE, "readonly");
    const req = tx.objectStore(FILES_STORE).get(DELETED_MOCK_KEY);
    req.onsuccess = () => resolve((req.result as string[]) || []);
    req.onerror = () => reject(req.error);
  });
}

export async function addDeletedMockId(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(FILES_STORE, "readwrite");
    const store = tx.objectStore(FILES_STORE);
    const getReq = store.get(DELETED_MOCK_KEY);
    getReq.onsuccess = () => {
      const current = (getReq.result as string[]) || [];
      if (!current.includes(id)) {
        store.put([...current, id], DELETED_MOCK_KEY);
      }
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * 清空已删除 Mock 作品 id 记录
 * 配合 force seed 用于"恢复默认作品集"操作：清空记录后，
 * 下次加载会重新展示所有默认作品，相当于把用户主动删除的默认内容恢复回来。
 */
export async function clearDeletedMockIds(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(FILES_STORE, "readwrite");
    tx.objectStore(FILES_STORE).delete(DELETED_MOCK_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * 批量 seed Mock 作品到 IndexedDB（无文件 blob，仅元数据 + previewUrl）
 * 用于首次访问时初始化展示数据
 */
export async function seedWorks(works: StoredWork[]): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(WORKS_STORE, "readwrite");
    const store = tx.objectStore(WORKS_STORE);
    works.forEach((w) => store.put(w));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * 批量 seed Mock 点赞记录到 localStorage
 */
export function seedLikedWorks(works: StoredWork[]): void {
  const key = "aga-profile-liked-works";
  const existing = localStorage.getItem(key);
  if (!existing) {
    const simplified = works.map((w) => ({
      id: w.id,
      title: w.title,
      preview: w.previewUrl,
      domain: w.domain,
      contentType: w.contentType,
      author: w.author,
      likes: w.likes,
      liked: true,
    }));
    localStorage.setItem(key, JSON.stringify(simplified));
  }
}
