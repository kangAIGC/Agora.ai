"use client";

import { useEffect, useState } from "react";
import {
  Check,
  Dot,
  Loader2,
  WifiOff,
  AlertTriangle,
  AlertCircle,
} from "lucide-react";
import type { SaveStatusInfo } from "@/lib/sync-engine";
import { describeStatus, getOnlineStatus, listenOnlineStatus, flushOfflineQueue } from "@/lib/sync-engine";
import { toast } from "sonner";

interface SaveStatusIndicatorProps {
  info: SaveStatusInfo;
  className?: string;
  onManualSync?: () => Promise<void> | void;
}

const ICON_MAP = { Check, Dot, Loader2, WifiOff, AlertTriangle, AlertCircle } as const;

export default function SaveStatusIndicator({ info, className = "", onManualSync }: SaveStatusIndicatorProps) {
  // ⚠️ 修复 hydration 不匹配：SSR/CSR 初始状态必须一致
  // 服务端无 navigator，统一初始值为 "online"，在 useEffect 中读取真实状态
  const [online, setOnline] = useState<"online" | "offline">("online");
  const [queueLen, setQueueLen] = useState<number>(0);
  const [isSyncing, setIsSyncing] = useState(false);

  // 客户端挂载后读取真实网络状态，避免 SSR/CSR 不一致
  useEffect(() => {
    setOnline(getOnlineStatus());
    return listenOnlineStatus((status, len) => {
      setOnline(status);
      setQueueLen(len);
      if (status === "online") {
        toast.info("网络已恢复，正在同步离线队列…");
      } else {
        toast.warning("网络已断开，更改将自动保留在本地");
      }
    });
  }, []);

  const display: SaveStatusInfo =
    online === "offline" && info.status !== "error"
      ? { ...info, status: "offline", pendingCount: queueLen || info.pendingCount }
      : info;

  const { iconName, text, colorClass } = describeStatus(display);
  const IconComp = ICON_MAP[iconName as keyof typeof ICON_MAP] || Check;

  const handleClick = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    try {
      if (onManualSync) await onManualSync();
      // 同时 flush 离线队列
      const res = await flushOfflineQueue();
      setQueueLen(res.remaining);
      toast.success(res.remaining === 0
        ? `同步完成（${res.flushed} 条已推送）`
        : `已推送 ${res.flushed} 条，剩 ${res.remaining} 条稍后重试`);
    } catch (e) {
      toast.error("同步失败：" + (e instanceof Error ? e.message : "未知错误"));
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <button
      onClick={handleClick}
      title={`${text} · 点击立即同步${onManualSync ? "（离线队列共" + queueLen + "条）" : ""}`}
      className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs transition-colors hover:bg-white/10 ${colorClass} ${className}`}
    >
      <IconComp className={`w-3.5 h-3.5 ${iconName === "Loader2" || isSyncing ? "animate-spin" : ""}`} />
      <span className="whitespace-nowrap max-w-[160px] truncate">{text}</span>
    </button>
  );
}
