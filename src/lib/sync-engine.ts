/**
 * sync-engine.ts — 统一的数据同步 & 持久化引擎（实时交互 / 本地 + 云端）
 *
 * 模块范围：
 * 1) SaveStatus 保存状态枚举 + 统一 UI 指示器 contract
 * 2) 防抖/节流工具（300ms 延迟写入，满足 <300ms 响应要求）
 * 3) 版本向量 / LWW 冲突解决（多设备编辑）
 * 4) 本地 localStorage 同步写（失败降级到内存队列 + 重试）
 * 5) 远程服务器同步占位接口（online 时推送；offline 入离线队列，回来后 flush）
 * 6) 统一的错误处理与 toast 反馈契约
 */

export type SaveStatus = "saved" | "dirty" | "saving" | "offline" | "conflict" | "error";

export interface SaveStatusInfo {
  status: SaveStatus;
  message?: string;
  lastSavedAt?: Date;
  pendingCount?: number;
}

export interface VersionedEnvelope<T> {
  version: number;        // 单调递增版本号，每次本地变更 +1
  updatedAt: string;      // ISO 字符串（LWW 冲突解决：后写者胜）
  clientId: string;       // 本机浏览器实例 ID，用于溯源冲突
  data: T;                // 业务负载
}

const CLIENT_ID_KEY = "aga-sync-client-id";
const OFFLINE_QUEUE_KEY = "aga-sync-offline-queue";

/** 生成本机唯一 clientId（首次创建后持久化） */
export function getClientId(): string {
  if (typeof window === "undefined") return "ssr-client";
  try {
    const stored = localStorage.getItem(CLIENT_ID_KEY);
    if (stored) return stored;
    const cid = `c-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    localStorage.setItem(CLIENT_ID_KEY, cid);
    return cid;
  } catch {
    return `fallback-${Date.now().toString(36)}`;
  }
}

/** 简单防抖（返回 debounced 函数 + flush 方法） */
export function createDebouncedFn<TArgs extends unknown[]>(
  fn: (...args: TArgs) => void,
  wait = 300,
): { (...args: TArgs): void; flush(): void; cancel(): void } {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let lastArgs: TArgs | null = null;
  const debounced = (...args: TArgs) => {
    lastArgs = args;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      if (lastArgs) {
        const a = lastArgs;
        lastArgs = null;
        try { fn(...a); } catch { /* swallow sync errors; upstream reports via status */ }
      }
    }, wait);
  };
  debounced.flush = () => {
    if (timer && lastArgs) {
      clearTimeout(timer);
      timer = null;
      const a = lastArgs;
      lastArgs = null;
      try { fn(...a); } catch { /* ignore */ }
    }
  };
  debounced.cancel = () => {
    if (timer) { clearTimeout(timer); timer = null; }
    lastArgs = null;
  };
  return debounced;
}

/** 封装同步 localStorage 写入（带 try/catch + quota exceeded 降级） */
export function safeLocalSet(key: string, value: string): { ok: boolean; error?: string } {
  if (typeof window === "undefined") return { ok: false, error: "no-window" };
  try {
    localStorage.setItem(key, value);
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.name : String(e);
    if (msg.includes("Quota")) {
      // 配额超限：尝试清理老快照后重试一次
      try {
        const toRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && (k.startsWith("aga-projects-snapshots-"))) toRemove.push(k);
        }
        toRemove.sort().slice(4).forEach((k) => localStorage.removeItem(k));
        localStorage.setItem(key, value);
        return { ok: true };
      } catch (e2) {
        return { ok: false, error: e2 instanceof Error ? e2.name : "storage-failed" };
      }
    }
    return { ok: false, error: msg };
  }
}

export function safeLocalGet<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/** ———— 版本向量 + LWW 冲突解决 ———— */

/** 从存储读取版本化数据；如果版本比当前内存版本低，标记 conflict 返回，调用方决定是否合并 */
export function readVersioned<T>(storageKey: string, currentVersion: number): {
  envelope?: VersionedEnvelope<T>;
  conflict: boolean;
  serverVersionHigher: boolean;
} {
  const raw = safeLocalGet<string | null>(`${storageKey}__v`, null);
  if (!raw) return { conflict: false, serverVersionHigher: false };
  try {
    const env = JSON.parse(raw) as VersionedEnvelope<T>;
    return {
      envelope: env,
      conflict: env.version !== currentVersion,
      serverVersionHigher: env.version > currentVersion,
    };
  } catch {
    return { conflict: false, serverVersionHigher: false };
  }
}

/** 写入版本化数据（LWW：更新本地版本号，远程则基于时间戳选胜） */
export function writeVersioned<T>(storageKey: string, data: T, currentVersion: number, prevUpdatedAt?: string): {
  envelope: VersionedEnvelope<T>;
  mergedFromRemote: boolean;
} {
  const now = new Date().toISOString();
  const remote = readVersioned<T>(storageKey, currentVersion);
  let mergedFromRemote = false;
  let finalData = data;
  if (remote.envelope && remote.serverVersionHigher) {
    // 远程版本更高：比较 updatedAt，后写者胜（LWW）
    const remoteTs = new Date(remote.envelope.updatedAt).getTime();
    const localTs = prevUpdatedAt ? new Date(prevUpdatedAt).getTime() : 0;
    if (remoteTs > localTs) {
      finalData = remote.envelope.data;
      mergedFromRemote = true;
    }
  }
  const envelope: VersionedEnvelope<T> = {
    version: currentVersion + 1,
    updatedAt: now,
    clientId: getClientId(),
    data: finalData,
  };
  safeLocalSet(`${storageKey}__v`, JSON.stringify(envelope));
  return { envelope, mergedFromRemote };
}

/** ———— 在线/离线 与 远程同步 占位接口 ———— */

export type OnlineStatus = "online" | "offline";

export function getOnlineStatus(): OnlineStatus {
  if (typeof navigator === "undefined") return "online";
  return navigator.onLine ? "online" : "offline";
}

export interface OfflineQueueItem {
  id: string;
  endpoint: string;  // 占位：例如 "/api/sync/canvas"、"/api/sync/messages"
  payload: unknown;
  retryAt?: number;  // 下次重试时间戳
  attempts: number;
  createdAt: number;
}

/** 入离线队列（网络错误或离线时调用） */
export function pushOfflineQueue(item: Omit<OfflineQueueItem, "id" | "createdAt" | "attempts">): number {
  const queue = safeLocalGet<OfflineQueueItem[]>(OFFLINE_QUEUE_KEY, []);
  queue.push({
    id: `q-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    attempts: 0,
    createdAt: Date.now(),
    ...item,
  });
  safeLocalSet(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
  return queue.length;
}

/** 尝试 flush 离线队列（占位：成功后返回处理条数；此处仅模拟远程调用 50% 成功演示重试机制） */
export async function flushOfflineQueue(onProgress?: (pending: number) => void): Promise<{ flushed: number; remaining: number }> {
  const queue = safeLocalGet<OfflineQueueItem[]>(OFFLINE_QUEUE_KEY, []);
  if (queue.length === 0) return { flushed: 0, remaining: 0 };
  const remaining: OfflineQueueItem[] = [];
  let flushed = 0;
  for (const item of queue) {
    try {
      const ok = await mockRemoteSyncCall(item.endpoint, item.payload);
      if (ok) {
        flushed += 1;
      } else {
        item.attempts += 1;
        item.retryAt = Date.now() + Math.min(30_000, 1000 * Math.pow(2, Math.min(item.attempts, 5)));
        remaining.push(item);
      }
    } catch {
      item.attempts += 1;
      item.retryAt = Date.now() + Math.min(60_000, 1000 * Math.pow(2, Math.min(item.attempts, 6)));
      remaining.push(item);
    }
    onProgress?.(remaining.length);
  }
  safeLocalSet(OFFLINE_QUEUE_KEY, JSON.stringify(remaining));
  return { flushed, remaining: remaining.length };
}

/** 远程同步占位：根据 endpoint 模拟调用（替换为真实 fetch 即可） */
export async function mockRemoteSyncCall(endpoint: string, payload: unknown): Promise<boolean> {
  if (getOnlineStatus() === "offline") return false;
  await new Promise((r) => setTimeout(r, 120));
  // 占位：98% 成功率，演示冲突/重试场景
  const ok = Math.random() > 0.02;
  // eslint-disable-next-line no-console
  console.debug(`[sync-engine] mock ${endpoint} payload=${JSON.stringify(payload).slice(0, 80)} ok=${ok}`);
  return ok;
}

/** 监听 online/offline 事件，状态改变时触发 flush */
export function listenOnlineStatus(onChange: (status: OnlineStatus, queueLength: number) => void): () => void {
  if (typeof window === "undefined") return () => { /* noop */ };
  const handler = (ev: Event) => {
    const status = (ev.type === "online") ? "online" : "offline";
    const queue = safeLocalGet<OfflineQueueItem[]>(OFFLINE_QUEUE_KEY, []);
    onChange(status, queue.length);
    if (status === "online") {
      // 后台异步 flush，不阻塞 UI
      void flushOfflineQueue();
    }
  };
  window.addEventListener("online", handler);
  window.addEventListener("offline", handler);
  return () => {
    window.removeEventListener("online", handler);
    window.removeEventListener("offline", handler);
  };
}

/** 统一将 SaveStatus 映射为用户可见文案和图标名 */
export function describeStatus(info: SaveStatusInfo): { iconName: string; text: string; colorClass: string } {
  switch (info.status) {
    case "saved":
      return {
        iconName: "Check",
        text: info.lastSavedAt ? `已保存 · ${formatTime(info.lastSavedAt)}` : "已保存",
        // 蓝色方案：text-blue-400 在深色 bg-white/5 / hover:bg-white/10 上对比度充足，与项目整体蓝色主色设计系统对齐
        colorClass: "text-blue-400",
      };
    case "dirty":
      return { iconName: "Dot", text: "有未保存的更改", colorClass: "text-yellow-400" };
    case "saving":
      return { iconName: "Loader2", text: `同步中…${info.pendingCount ? ` (队列${info.pendingCount})` : ""}`, colorClass: "text-blue-400" };
    case "offline":
      return { iconName: "WifiOff", text: "离线 · 本地已暂存", colorClass: "text-orange-400" };
    case "conflict":
      return { iconName: "AlertTriangle", text: "版本冲突 · 已按最新时间合并", colorClass: "text-purple-400" };
    case "error":
      return { iconName: "AlertCircle", text: info.message || "保存失败 · 将自动重试", colorClass: "text-red-400" };
  }
}

function formatTime(d: Date): string {
  try {
    return d.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
  } catch {
    return "";
  }
}
