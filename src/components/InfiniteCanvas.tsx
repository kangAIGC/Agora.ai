"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import {
  ChevronDown,
  Image as ImageIcon,
  FileText,
  Play,
  Trash2,
  Maximize2,
  Square,
  Circle,
  Triangle,
  Minus,
  PenTool,
  Type,
  Globe,
  ExternalLink,
  Download,
} from "lucide-react";
import FloatingToolbar, {
  type ToolMode,
  type ToolConfig,
  type ShapeType,
  DEFAULT_CONFIG,
} from "./FloatingToolbar";
import { asset } from "@/lib/asset";
import { toast } from "sonner";

export interface CanvasItem {
  id: string;
  type: "text" | "image" | "video" | "file" | "shape" | "drawing" | "html";
  content: string;
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
  /** 连接源项 id：表示此项由 connectionFrom 指向的项生成。支持单个或多个源。 */
  connectionFrom?: string | string[];
  /** 每条连线的颜色（与 connectionFrom 数组一一对应；若为单个则统一色） */
  connectionColors?: string[];
  meta?: {
    name?: string;
    fileType?: string;
    shapeType?: ShapeType;
    fillColor?: string;
    borderColor?: string;
    strokeWidth?: number;
    points?: { x: number; y: number }[];
    lineColor?: string;
    lineWidth?: number;
    lineStyle?: "solid" | "dashed";
    fontSize?: number;
    fontFamily?: string;
    textColor?: string;
    textAlign?: "left" | "center" | "right";
    editing?: boolean;
    /** 文件拖放来源 id（UploadedFile.id / GeneratedFile.id），用于堆叠错开 */
    sourceId?: string;
    /** 拖放来源分区 */
    sourceType?: "text" | "image" | "generated";
  };
}

interface InfiniteCanvasProps {
  items: CanvasItem[];
  onItemsChange: (items: CanvasItem[]) => void;
  onPreviewImage: (url: string, name?: string) => void;
  onPreviewVideo: (url: string, name: string) => void;
  onDownloadFile: (item: CanvasItem) => void;
  onPreviewFile: (item: CanvasItem) => void;
  /** 当前项目 ID，用于持久化画布视口状态 */
  projectId?: string;
}

const MIN_SCALE = 0.25;
const MAX_SCALE = 4;
const GRID_SIZE = 20;

function intersects(
  item: { x: number; y: number; width: number; height: number },
  rect: { x: number; y: number; width: number; height: number },
) {
  return (
    item.x < rect.x + rect.width &&
    item.x + item.width > rect.x &&
    item.y < rect.y + rect.height &&
    item.y + item.height > rect.y
  );
}

export default function InfiniteCanvas({
  items,
  onItemsChange,
  onPreviewImage,
  onPreviewVideo,
  onDownloadFile,
  onPreviewFile,
  projectId,
}: InfiniteCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const VIEWPORT_STORAGE_KEY = projectId ? `aga-canvas-viewport-${projectId}` : null;

  const [scale, setScale] = useState<number>(() => {
    if (typeof window === "undefined" || !VIEWPORT_STORAGE_KEY) return 1;
    try {
      const stored = localStorage.getItem(VIEWPORT_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && typeof parsed.scale === "number") {
          return Math.min(MAX_SCALE, Math.max(MIN_SCALE, parsed.scale));
        }
      }
    } catch {
      /* ignore */
    }
    return 1;
  });
  const [offset, setOffset] = useState<{ x: number; y: number }>(() => {
    if (typeof window === "undefined" || !VIEWPORT_STORAGE_KEY) return { x: 0, y: 0 };
    try {
      const stored = localStorage.getItem(VIEWPORT_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        // 兼容两种存储格式：{ scale, offset: { x, y } } 或 { x, y }
        const off = parsed?.offset ?? parsed;
        if (off && typeof off.x === "number" && typeof off.y === "number") {
          return { x: off.x, y: off.y };
        }
      }
    } catch {
      /* ignore */
    }
    return { x: 0, y: 0 };
  });
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef({ x: 0, y: 0, offsetX: 0, offsetY: 0 });

  /**
   * 计算所有 items 的边界框，并调整 scale/offset 使其尽量可见
   * 策略：
   *  - 若内容能完整放入视口，则按 fit 计算缩放并居中
   *  - 否则保持 scale=1，仅居中到内容中心（避免缩放过小看不清）
   */
  const fitToContent = useCallback(
    (padding = 80) => {
      const container = containerRef.current;
      if (!container || items.length === 0) return;

      const containerRect = container.getBoundingClientRect();
      const viewportW = containerRect.width;
      const viewportH = containerRect.height;
      if (viewportW === 0 || viewportH === 0) return;

      // 计算所有 items 的边界框
      let minX = Infinity,
        minY = Infinity,
        maxX = -Infinity,
        maxY = -Infinity;
      for (const item of items) {
        minX = Math.min(minX, item.x);
        minY = Math.min(minY, item.y);
        maxX = Math.max(maxX, item.x + item.width);
        maxY = Math.max(maxY, item.y + item.height);
      }
      if (minX === Infinity) return;

      const contentW = maxX - minX;
      const contentH = maxY - minY;
      if (contentW <= 0 || contentH <= 0) return;

      // 内容中心点（画布坐标）
      const contentCenterX = (minX + maxX) / 2;
      const contentCenterY = (minY + maxY) / 2;

      // 计算理想缩放比（让所有内容放入视口）
      const fitScaleX = (viewportW - padding * 2) / contentW;
      const fitScaleY = (viewportH - padding * 2) / contentH;
      const idealFitScale = Math.min(fitScaleX, fitScaleY, 1);

      // 若理想缩放比仍 >= 0.5，则采用 fit 策略；否则保持 1，仅居中
      const newScale = idealFitScale >= 0.5 ? idealFitScale : 1;

      // 让内容中心点对齐视口中心
      const newOffsetX = viewportW / 2 - contentCenterX * newScale;
      const newOffsetY = viewportH / 2 - contentCenterY * newScale;

      setScale(newScale);
      setOffset({ x: newOffsetX, y: newOffsetY });
    },
    [items],
  );

  // 视口恢复：当 VIEWPORT_STORAGE_KEY 变化（包括初始挂载与项目切换）时，
  // 从 localStorage 恢复该项目的视口状态；若无保存数据且有 items，则自动适配
  const lastRestoredKeyRef = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    // 仅在 key 真正变化时执行（防止 items 变化导致重复触发）
    if (lastRestoredKeyRef.current === VIEWPORT_STORAGE_KEY) return;
    lastRestoredKeyRef.current = VIEWPORT_STORAGE_KEY;

    if (!VIEWPORT_STORAGE_KEY) {
      setScale(1);
      setOffset({ x: 0, y: 0 });
      return;
    }
    try {
      const stored = localStorage.getItem(VIEWPORT_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        const off = parsed?.offset ?? parsed;
        if (parsed && typeof parsed.scale === "number" && off && typeof off.x === "number" && typeof off.y === "number") {
          setScale(parsed.scale);
          setOffset({ x: off.x, y: off.y });
          return;
        }
      }
    } catch {
      /* ignore */
    }
    // 无持久化视口：若有 items 则自动适配，否则用默认值
    if (items.length > 0) {
      // 延迟一帧以确保容器尺寸已计算（特别是初始挂载场景）
      requestAnimationFrame(() => fitToContent(80));
    } else {
      setScale(1);
      setOffset({ x: 0, y: 0 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [VIEWPORT_STORAGE_KEY]);

  // 持久化视口状态（scale + offset）到 localStorage
  // 注意：当 VIEWPORT_STORAGE_KEY 变化时跳过首次保存，
  // 避免在 restoration 完成前用旧值覆盖新项目已持久化的数据
  const lastSavedKeyRef = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    if (!VIEWPORT_STORAGE_KEY) return;
    if (lastSavedKeyRef.current !== VIEWPORT_STORAGE_KEY) {
      lastSavedKeyRef.current = VIEWPORT_STORAGE_KEY;
      return;
    }
    try {
      localStorage.setItem(
        VIEWPORT_STORAGE_KEY,
        JSON.stringify({ scale, offset }),
      );
    } catch {
      /* ignore */
    }
  }, [scale, offset, VIEWPORT_STORAGE_KEY]);

  const [activeTool, setActiveTool] = useState<ToolMode>("select");
  const [toolConfig, setToolConfig] = useState<ToolConfig>(DEFAULT_CONFIG);

  const [dragItemId, setDragItemId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [resizeItemId, setResizeItemId] = useState<string | null>(null);
  const [resizeStart, setResizeStart] = useState({
    x: 0,
    y: 0,
    width: 0,
    height: 0,
  });
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [maximizedId, setMaximizedId] = useState<string | null>(null);
  const nextZ = useRef(10);

  const [isDrawing, setIsDrawing] = useState(false);
  const drawStart = useRef({ x: 0, y: 0 });
  const drawPoints = useRef<{ x: number; y: number }[]>([]);
  const [previewShape, setPreviewShape] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const [previewDrawing, setPreviewDrawing] = useState<{
    points: { x: number; y: number }[];
  } | null>(null);

  const [pendingImageUrl, setPendingImageUrl] = useState<string | null>(null);

  // 框选状态
  const [isBoxSelecting, setIsBoxSelecting] = useState(false);
  const boxSelectStart = useRef<{ x: number; y: number } | null>(null);
  const boxSelectOriginalIds = useRef<Set<string>>(new Set());
  const [boxSelectEnd, setBoxSelectEnd] = useState<{ x: number; y: number } | null>(null);

  // 多元素拖拽状态
  const [isMultiDragging, setIsMultiDragging] = useState(false);
  const multiDragStart = useRef<{
    mouseX: number;
    mouseY: number;
    items: { id: string; x: number; y: number }[];
  }>({ mouseX: 0, mouseY: 0, items: [] });

  // ---- 连接交互状态 ----
  // 正在拖拽建立的连接（从源 handle 拉向目标）
  const [connecting, setConnecting] = useState<{
    sourceId: string;
    sourcePos: { x: number; y: number };
    currentPos: { x: number; y: number };
  } | null>(null);
  // 右键连线待删除（含确认弹层定位）
  const [pendingDeleteEdge, setPendingDeleteEdge] = useState<{
    sourceId: string;
    targetId: string;
    idx: number;
    screenX: number;
    screenY: number;
  } | null>(null);
  // 悬停的连线（用于加粗高亮）
  const [hoveredEdge, setHoveredEdge] = useState<string | null>(null);

  // ---- 拖放状态 ----
  const [isDragOver, setIsDragOver] = useState(false);
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);

  const screenToCanvas = (clientX: number, clientY: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: (clientX - rect.left - offset.x) / scale,
      y: (clientY - rect.top - offset.y) / scale,
    };
  };

  const handleWheel = useCallback(
    (e: WheelEvent) => {
      e.preventDefault();
      const delta = -e.deltaY * 0.001;
      setScale((prev) => {
        const newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, prev * (1 + delta)));
        return newScale;
      });
    },
    [],
  );

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, [handleWheel]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setActiveTool("select");
        setSelectedIds(new Set());
        setPendingImageUrl(null);
        setPreviewShape(null);
        setPreviewDrawing(null);
        setIsBoxSelecting(false);
        boxSelectStart.current = null;
        setBoxSelectEnd(null);
        drawPoints.current = [];
      }
      if ((e.key === "Delete" || e.key === "Backspace") && selectedIds.size > 0) {
        const active = document.activeElement;
        if (active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA")) return;
        const toDelete = new Set(selectedIds);
        const remaining = items.filter((i) => !toDelete.has(i.id));
        onItemsChange(cleanupDanglingConnections(remaining, toDelete));
        setSelectedIds(new Set());
        if (maximizedId && toDelete.has(maximizedId)) setMaximizedId(null);
      }
      if (e.key === "v" || e.key === "V") setActiveTool("select");
      if (e.key === "h" || e.key === "H") setActiveTool("grab");
      if (e.key === "r" || e.key === "R") {
        setToolConfig((c) => ({ ...c, shapeType: "rectangle" }));
        setActiveTool("shape");
      }
      if (e.key === "o" || e.key === "O") {
        setToolConfig((c) => ({ ...c, shapeType: "circle" }));
        setActiveTool("shape");
      }
      if (e.key === "l" || e.key === "L") {
        setToolConfig((c) => ({ ...c, shapeType: "line" }));
        setActiveTool("shape");
      }
      if (e.key === "a" || e.key === "A") {
        setToolConfig((c) => ({ ...c, shapeType: "arrow" }));
        setActiveTool("shape");
      }
      if (e.key === "d" || e.key === "D") setActiveTool("draw");
      if (e.key === "t" || e.key === "T") setActiveTool("text");
      if (e.key === "i" || e.key === "I") fileInputRef.current?.click();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedIds, items, maximizedId, onItemsChange]);

  const handleImageUpload = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPendingImageUrl(url);
    setActiveTool("image");
    e.target.value = "";
  };

  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const isCanvasBg = target.dataset?.canvasBg === "true" || target === e.currentTarget;

    // 正在拖拽建立连接时，不触发其它画布操作
    if (connecting) return;

    if (activeTool === "grab") {
      setIsPanning(true);
      setSelectedIds(new Set());
      panStart.current = { x: e.clientX, y: e.clientY, offsetX: offset.x, offsetY: offset.y };
      return;
    }

    if (activeTool === "select") {
      if (isCanvasBg) {
        // 框选模式：在空白处拖拽创建选择框
        if (!e.shiftKey) {
          setSelectedIds(new Set());
          boxSelectOriginalIds.current = new Set();
        } else {
          boxSelectOriginalIds.current = new Set(selectedIds);
        }
        const pos = screenToCanvas(e.clientX, e.clientY);
        boxSelectStart.current = pos;
        setBoxSelectEnd(pos);
        setIsBoxSelecting(true);
      }
      return;
    }

    if (activeTool === "image" && pendingImageUrl && isCanvasBg) {
      const pos = screenToCanvas(e.clientX, e.clientY);
      const newItem: CanvasItem = {
        id: `img-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        type: "image",
        content: pendingImageUrl,
        x: pos.x - 150,
        y: pos.y - 100,
        width: 300,
        height: 200,
        zIndex: nextZ.current++,
        meta: { name: "上传图片", fileType: "image" },
      };
      onItemsChange([...items, newItem]);
      setPendingImageUrl(null);
      setActiveTool("select");
      return;
    }

    if (activeTool === "shape" && isCanvasBg) {
      const pos = screenToCanvas(e.clientX, e.clientY);
      drawStart.current = pos;
      setIsDrawing(true);
      setPreviewShape({ x: pos.x, y: pos.y, width: 0, height: 0 });
      return;
    }

    if (activeTool === "draw" && isCanvasBg) {
      const pos = screenToCanvas(e.clientX, e.clientY);
      setIsDrawing(true);
      drawPoints.current = [pos];
      setPreviewDrawing({ points: [pos] });
      return;
    }

    if (activeTool === "text" && isCanvasBg) {
      const pos = screenToCanvas(e.clientX, e.clientY);
      const newItem: CanvasItem = {
        id: `txt-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        type: "text",
        content: "双击编辑文本",
        x: pos.x,
        y: pos.y,
        width: 220,
        height: 40,
        zIndex: nextZ.current++,
        meta: {
          name: "文本",
          fontSize: toolConfig.fontSize,
          fontFamily: toolConfig.fontFamily,
          textColor: toolConfig.textColor,
          textAlign: toolConfig.textAlign,
          editing: true,
        },
      };
      onItemsChange([...items, newItem]);
      setActiveTool("select");
      setSelectedIds(new Set([newItem.id]));
      return;
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent) => {
    // 拖拽建立连接：更新临时连线终点跟随鼠标
    if (connecting) {
      setConnecting({
        ...connecting,
        currentPos: screenToCanvas(e.clientX, e.clientY),
      });
      return;
    }

    // 拖放悬停反馈：更新预览位置
    if (isDragOver) {
      setDragPos(screenToCanvas(e.clientX, e.clientY));
    }

    if (isPanning) {
      const dx = e.clientX - panStart.current.x;
      const dy = e.clientY - panStart.current.y;
      setOffset({ x: panStart.current.offsetX + dx, y: panStart.current.offsetY + dy });
      return;
    }

    if (isBoxSelecting && boxSelectStart.current) {
      const pos = screenToCanvas(e.clientX, e.clientY);
      setBoxSelectEnd(pos);
      const rect = {
        x: Math.min(boxSelectStart.current.x, pos.x),
        y: Math.min(boxSelectStart.current.y, pos.y),
        width: Math.abs(pos.x - boxSelectStart.current.x),
        height: Math.abs(pos.y - boxSelectStart.current.y),
      };
      const inBox = new Set<string>();
      items.forEach((item) => {
        if (intersects(item, rect)) inBox.add(item.id);
      });
      if (boxSelectOriginalIds.current.size > 0) {
        const merged = new Set(boxSelectOriginalIds.current);
        inBox.forEach((id) => merged.add(id));
        setSelectedIds(merged);
      } else {
        setSelectedIds(inBox);
      }
      return;
    }

    if (isMultiDragging) {
      const dx = (e.clientX - multiDragStart.current.mouseX) / scale;
      const dy = (e.clientY - multiDragStart.current.mouseY) / scale;
      const startItems = multiDragStart.current.items;
      onItemsChange(
        items.map((item) => {
          const start = startItems.find((s) => s.id === item.id);
          return start ? { ...item, x: start.x + dx, y: start.y + dy } : item;
        }),
      );
      return;
    }

    if (dragItemId) {
      const canvasPos = screenToCanvas(e.clientX, e.clientY);
      onItemsChange(
        items.map((item) =>
          item.id === dragItemId
            ? { ...item, x: canvasPos.x - dragOffset.x, y: canvasPos.y - dragOffset.y }
            : item,
        ),
      );
      return;
    }

    if (resizeItemId) {
      const dx = (e.clientX - resizeStart.x) / scale;
      const dy = (e.clientY - resizeStart.y) / scale;
      onItemsChange(
        items.map((item) =>
          item.id === resizeItemId
            ? {
                ...item,
                width: Math.max(30, resizeStart.width + dx),
                height: Math.max(30, resizeStart.height + dy),
              }
            : item,
        ),
      );
      return;
    }

    if (isDrawing && activeTool === "shape") {
      const pos = screenToCanvas(e.clientX, e.clientY);
      setPreviewShape({
        x: Math.min(drawStart.current.x, pos.x),
        y: Math.min(drawStart.current.y, pos.y),
        width: Math.abs(pos.x - drawStart.current.x),
        height: Math.abs(pos.y - drawStart.current.y),
      });
      return;
    }

    if (isDrawing && activeTool === "draw") {
      const pos = screenToCanvas(e.clientX, e.clientY);
      const newPoints = [...drawPoints.current, pos];
      drawPoints.current = newPoints;
      setPreviewDrawing({ points: newPoints });
      return;
    }
  };

  const handleCanvasMouseUp = () => {
    // 连接拖拽结束：若未在目标 handle 上完成则取消
    if (connecting) {
      setConnecting(null);
      return;
    }

    if (isPanning) {
      setIsPanning(false);
      return;
    }

    if (isBoxSelecting) {
      setIsBoxSelecting(false);
      boxSelectStart.current = null;
      setBoxSelectEnd(null);
      return;
    }

    if (isMultiDragging) {
      setIsMultiDragging(false);
      return;
    }

    if (dragItemId) {
      setDragItemId(null);
      return;
    }

    if (resizeItemId) {
      setResizeItemId(null);
      return;
    }

    if (isDrawing && activeTool === "shape" && previewShape) {
      if (previewShape.width > 5 && previewShape.height > 5) {
        const newItem: CanvasItem = {
          id: `shp-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          type: "shape",
          content: "",
          x: previewShape.x,
          y: previewShape.y,
          width: previewShape.width,
          height: previewShape.height,
          zIndex: nextZ.current++,
          meta: {
            name: toolConfig.shapeType,
            shapeType: toolConfig.shapeType,
            fillColor: toolConfig.fillColor,
            borderColor: toolConfig.borderColor,
            strokeWidth: toolConfig.strokeWidth,
          },
        };
        onItemsChange([...items, newItem]);
      }
      setIsDrawing(false);
      setPreviewShape(null);
      return;
    }

    if (isDrawing && activeTool === "draw" && drawPoints.current.length > 1) {
      const xs = drawPoints.current.map((p) => p.x);
      const ys = drawPoints.current.map((p) => p.y);
      const minX = Math.min(...xs);
      const minY = Math.min(...ys);
      const maxX = Math.max(...xs);
      const maxY = Math.max(...ys);

      const newItem: CanvasItem = {
        id: `drw-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        type: "drawing",
        content: "",
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY,
        zIndex: nextZ.current++,
        meta: {
          name: "手绘",
          points: drawPoints.current,
          lineColor: toolConfig.lineColor,
          lineWidth: toolConfig.lineWidth,
          lineStyle: toolConfig.lineStyle,
        },
      };
      onItemsChange([...items, newItem]);
      setIsDrawing(false);
      drawPoints.current = [];
      setPreviewDrawing(null);
      return;
    }

    setIsDrawing(false);
    setPreviewShape(null);
    setPreviewDrawing(null);
    drawPoints.current = [];
  };

  const startDrag = (e: React.MouseEvent, item: CanvasItem) => {
    e.stopPropagation();

    // Shift+点击：追加/取消选择，不启动拖拽
    if (e.shiftKey) {
      const newIds = new Set(selectedIds);
      if (newIds.has(item.id)) {
        newIds.delete(item.id);
      } else {
        newIds.add(item.id);
      }
      setSelectedIds(newIds);
      return;
    }

    // 点击未选中的元素：仅选中此元素并启动单元素拖拽
    if (!selectedIds.has(item.id)) {
      setSelectedIds(new Set([item.id]));
      nextZ.current += 1;
      onItemsChange(items.map((i) => (i.id === item.id ? { ...i, zIndex: nextZ.current } : i)));
      setDragItemId(item.id);
      const canvasPos = screenToCanvas(e.clientX, e.clientY);
      setDragOffset({ x: canvasPos.x - item.x, y: canvasPos.y - item.y });
      return;
    }

    // 点击已选中的元素且有多选：启动多元素拖拽
    if (selectedIds.size > 1) {
      setIsMultiDragging(true);
      const selItems = items.filter((i) => selectedIds.has(i.id));
      multiDragStart.current = {
        mouseX: e.clientX,
        mouseY: e.clientY,
        items: selItems.map((i) => ({ id: i.id, x: i.x, y: i.y })),
      };
      return;
    }

    // 单元素已选中：启动单元素拖拽
    nextZ.current += 1;
    onItemsChange(items.map((i) => (i.id === item.id ? { ...i, zIndex: nextZ.current } : i)));
    setDragItemId(item.id);
    const canvasPos = screenToCanvas(e.clientX, e.clientY);
    setDragOffset({ x: canvasPos.x - item.x, y: canvasPos.y - item.y });
  };

  const startResize = (e: React.MouseEvent, item: CanvasItem) => {
    e.stopPropagation();
    setResizeItemId(item.id);
    setResizeStart({ x: e.clientX, y: e.clientY, width: item.width, height: item.height });
  };

  const deleteItem = (id: string) => {
    const remaining = items.filter((i) => i.id !== id);
    onItemsChange(cleanupDanglingConnections(remaining, new Set([id])));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    if (maximizedId === id) setMaximizedId(null);
  };

  // ---- 连接 / 拖放 辅助函数 ----

  // 连线轮转调色板
  const CONNECTION_COLORS = ["#60a5fa", "#a78bfa", "#4ade80", "#fbbf24", "#f472b6"];
  const pickConnectionColor = (idx: number) =>
    CONNECTION_COLORS[idx % CONNECTION_COLORS.length];

  // 标准化 connectionFrom 为数组
  const normalizeSources = (item: CanvasItem): string[] =>
    Array.isArray(item.connectionFrom)
      ? item.connectionFrom
      : item.connectionFrom
        ? [item.connectionFrom]
        : [];

  // 清理指向已删除节点 id 的悬空连接引用
  const cleanupDanglingConnections = (
    list: CanvasItem[],
    deletedIds: Set<string>,
  ): CanvasItem[] => {
    if (deletedIds.size === 0) return list;
    return list.map((i) => {
      if (!i.connectionFrom) return i;
      const sources = normalizeSources(i);
      const colors = i.connectionColors || [];
      const kept: { s: string; c: string }[] = [];
      sources.forEach((s, k) => {
        if (!deletedIds.has(s)) kept.push({ s, c: colors[k] || pickConnectionColor(k) });
      });
      if (kept.length === sources.length) return i; // 无变化
      if (kept.length === 0) {
        const { connectionFrom: _cf, connectionColors: _cc, ...rest } = i;
        return rest as CanvasItem;
      }
      const newSources = kept.map((k) => k.s);
      return {
        ...i,
        connectionFrom: newSources.length === 1 ? newSources[0] : newSources,
        connectionColors: kept.map((k) => k.c),
      };
    });
  };

  // 建立连接：source → target
  const addConnection = (sourceId: string, targetId: string) => {
    if (sourceId === targetId) {
      toast.warning("不能连接自身");
      return;
    }
    const target = items.find((i) => i.id === targetId);
    if (!target) return;
    const existing = normalizeSources(target);
    if (existing.includes(sourceId)) {
      toast.warning("该连接已存在");
      return;
    }
    const color = pickConnectionColor(existing.length);
    onItemsChange(
      items.map((i) =>
        i.id === targetId
          ? {
              ...i,
              connectionFrom: [...existing, sourceId],
              connectionColors: [...(i.connectionColors || []), color],
            }
          : i,
      ),
    );
    toast.success("已建立连接");
  };

  // 删除指定连接（target 的 connectionFrom 第 idx 项）
  const removeConnection = (edge: {
    sourceId: string;
    targetId: string;
    idx: number;
  }) => {
    onItemsChange(
      items.map((i) => {
        if (i.id !== edge.targetId) return i;
        const sources = normalizeSources(i);
        const colors = i.connectionColors || [];
        const newSources = sources.filter((_, k) => k !== edge.idx);
        const newColors = colors.filter((_, k) => k !== edge.idx);
        if (newSources.length === 0) {
          const { connectionFrom: _cf, connectionColors: _cc, ...rest } = i;
          return rest as CanvasItem;
        }
        return {
          ...i,
          connectionFrom:
            newSources.length === 1 ? newSources[0] : newSources,
          connectionColors: newColors.length === 0 ? undefined : newColors,
        };
      }),
    );
    toast.success("连接已删除");
  };

  // 计算连接线 SVG 路径 + 端点（方向自适应 + 同源偏移 + 简单穿越避让）
  const computeConnectionPath = (
    source: CanvasItem,
    target: CanvasItem,
    idx: number,
    allItems: CanvasItem[],
  ): { d: string; x1: number; y1: number; x2: number; y2: number } => {
    // 方向自适应：默认源右中→目标左中；源在目标右侧时改为源左中→目标右中
    const sourceOnRight = source.x + source.width / 2 > target.x + target.width / 2;
    let x1: number, y1: number, x2: number, y2: number;
    if (sourceOnRight) {
      x1 = source.x; // 源左中
      y1 = source.y + source.height / 2;
      x2 = target.x + target.width; // 目标右中
      y2 = target.y + target.height / 2;
    } else {
      x1 = source.x + source.width; // 源右中
      y1 = source.y + source.height / 2;
      x2 = target.x; // 目标左中
      y2 = target.y + target.height / 2;
    }
    // 同源/同目标偏移：多条边按 idx 错开 ±8px
    const offset = idx * 8 - (idx > 0 ? 4 : 0);
    y1 += offset;
    y2 += offset;
    // 贝塞尔控制点（水平 S 形），方向自适应时取反
    const dx = Math.max(40, Math.abs(x2 - x1) * 0.4);
    const cx1 = sourceOnRight ? x1 - dx : x1 + dx;
    const cx2 = sourceOnRight ? x2 + dx : x2 - dx;
    let d = `M ${x1} ${y1} C ${cx1} ${y1}, ${cx2} ${y2}, ${x2} ${y2}`;
    // 简单穿越避让：若贝塞尔中点落在其他节点 bbox 内，插入一个折点绕开
    const midX = (x1 + x2) / 2;
    const midY = (y1 + y2) / 2;
    const blocker = allItems.find(
      (it) =>
        it.id !== source.id &&
        it.id !== target.id &&
        midX > it.x &&
        midX < it.x + it.width &&
        midY > it.y &&
        midY < it.y + it.height,
    );
    if (blocker) {
      // 绕到 blocker 上方或下方
      const detourY = midY < blocker.y + blocker.height / 2 ? blocker.y - 20 : blocker.y + blocker.height + 20;
      d = `M ${x1} ${y1} C ${cx1} ${y1}, ${midX} ${detourY}, ${midX} ${detourY} S ${cx2} ${y2}, ${x2} ${y2}`;
    }
    return { d, x1, y1, x2, y2 };
  };

  // 计算节点右中点（连接源 handle 位置，画布坐标）
  const getNodeAnchor = (item: CanvasItem, side: "right" | "left") => ({
    x: side === "right" ? item.x + item.width : item.x,
    y: item.y + item.height / 2,
  });

  // ---- 拖放：处理 drop ----
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    setDragPos(null);
    const raw = e.dataTransfer.getData("application/json");
    if (!raw) return;
    let specs: Array<{
      id: string;
      name: string;
      url: string;
      fileType: string;
      sourceType: string;
    }>;
    try {
      specs = JSON.parse(raw);
    } catch {
      return;
    }
    if (!Array.isArray(specs) || specs.length === 0) return;
    const dropPos = screenToCanvas(e.clientX, e.clientY);
    const newItems: CanvasItem[] = specs.map((spec, idx) => {
      const isMedia = spec.fileType === "image" || spec.fileType === "video";
      const width = isMedia ? 320 : 260;
      const height = isMedia ? 240 : 200;
      // 重复文件错开偏移：统计画布已有同 sourceId 节点数
      const dupCount = items.filter((it) => it.meta?.sourceId === spec.id).length;
      const offX = (idx % 3) * 24 + dupCount * 30;
      const offY = Math.floor(idx / 3) * 24 + dupCount * 30;
      const typeMap: Record<string, CanvasItem["type"]> = {
        doc: "file",
        image: "image",
        video: "video",
        html: "html",
      };
      return {
        id: `canvas-${spec.id}-${Date.now()}-${idx}`,
        type: typeMap[spec.fileType] || "file",
        content: spec.url,
        x: dropPos.x - width / 2 + offX,
        y: dropPos.y - height / 2 + offY,
        width,
        height,
        zIndex: nextZ.current++,
        meta: {
          name: spec.name,
          fileType: spec.fileType,
          sourceId: spec.id,
          sourceType: spec.sourceType as "text" | "image" | "generated",
        },
      };
    });
    onItemsChange([...items, ...newItems]);
    setActiveTool("select");
    if (specs.some((s) => s.url.startsWith("blob:"))) {
      toast.info("部分文件为本地副本，刷新后可能失效，建议先在侧栏完成上传");
    } else {
      toast.success(`已添加 ${newItems.length} 个节点到画布`);
    }
  };

  const resetView = () => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
    // 同步清除持久化的视口，下次加载会执行 auto-fit
    if (VIEWPORT_STORAGE_KEY) {
      try {
        localStorage.removeItem(VIEWPORT_STORAGE_KEY);
      } catch {
        /* ignore */
      }
    }
  };

  // 适应内容：自动缩放并居中显示所有画布项
  const fitView = () => {
    fitToContent(80);
  };

  const cursorClass = (() => {
    if (activeTool === "grab") return "cursor-grab";
    if (activeTool === "select") return "cursor-default";
    if (activeTool === "image") return "cursor-crosshair";
    if (activeTool === "shape") return "cursor-crosshair";
    if (activeTool === "draw") return "cursor-crosshair";
    if (activeTool === "text") return "cursor-text";
    return "cursor-default";
  })();

  const getCanvasBgClickable = () => {
    if (activeTool === "grab" || activeTool === "select") return true;
    return true;
  };

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full overflow-hidden bg-[#0d0d0d] ${cursorClass} select-none`}
      style={{ cursor: activeTool === "grab" ? "grab" : undefined }}
      onMouseDown={handleCanvasMouseDown}
      onMouseMove={handleCanvasMouseMove}
      onMouseUp={handleCanvasMouseUp}
      onMouseLeave={handleCanvasMouseUp}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes("application/json")) {
          e.preventDefault();
          e.dataTransfer.dropEffect = "copy";
          if (!isDragOver) setIsDragOver(true);
          setDragPos(screenToCanvas(e.clientX, e.clientY));
        }
      }}
      onDragLeave={(e) => {
        // 仅当真正离开容器（不是进入子元素）时清空
        if (e.currentTarget === e.target) {
          setIsDragOver(false);
          setDragPos(null);
        }
      }}
      onDrop={handleDrop}
    >
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Floating Toolbar */}
      <FloatingToolbar
        activeTool={activeTool}
        onToolChange={setActiveTool}
        config={toolConfig}
        onConfigChange={setToolConfig}
        onImageUpload={handleImageUpload}
      />

      {/* Grid background */}
      <div
        data-canvas-bg={getCanvasBgClickable()}
        className="absolute inset-0"
        style={{
          backgroundImage: `radial-gradient(circle, rgba(255,255,255,0.08) 1px, transparent 1px)`,
          backgroundSize: `${GRID_SIZE * scale}px ${GRID_SIZE * scale}px`,
          backgroundPosition: `${offset.x}px ${offset.y}px`,
        }}
      />

      {/* Transformed content layer */}
      <div
        className="absolute top-0 left-0 pointer-events-none"
        style={{
          transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
          transformOrigin: "0 0",
        }}
      >
        {/* 连接线层：在有 connectionFrom 的项之间绘制亮色连线 */}
        <svg
          className="absolute top-0 left-0"
          style={{ overflow: "visible", width: "10000px", height: "10000px" }}
        >
          {items
            .filter((item) => item.connectionFrom)
            .flatMap((item) => {
              const sources: string[] = Array.isArray(item.connectionFrom)
                ? item.connectionFrom
                : item.connectionFrom
                  ? [item.connectionFrom]
                  : [];
              return sources.map((srcId, idx) => {
                const source = items.find((i) => i.id === srcId);
                if (!source) return null;
                const { d, x1, y1, x2, y2 } = computeConnectionPath(source, item, idx, items);
                const color = item.connectionColors?.[idx] || pickConnectionColor(idx);
                const edgeKey = `conn-${item.id}-${idx}`;
                const isHovered = hoveredEdge === edgeKey;
                return (
                  <g
                    key={edgeKey}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setPendingDeleteEdge({
                        sourceId: srcId,
                        targetId: item.id,
                        idx,
                        screenX: e.clientX,
                        screenY: e.clientY,
                      });
                    }}
                    onMouseEnter={() => setHoveredEdge(edgeKey)}
                    onMouseLeave={() => setHoveredEdge((cur) => (cur === edgeKey ? null : cur))}
                  >
                    {/* 不可见宽命中带，便于右键命中 */}
                    <path
                      d={d}
                      fill="none"
                      stroke="transparent"
                      strokeWidth={14}
                      style={{ pointerEvents: "stroke", cursor: "context-menu" }}
                    />
                    {/* 可见细线 */}
                    <path
                      d={d}
                      fill="none"
                      stroke={color}
                      strokeWidth={isHovered ? 3.5 : 2.5}
                      strokeLinecap="round"
                      style={{ pointerEvents: "none", filter: isHovered ? "drop-shadow(0 0 4px rgba(96,165,250,0.5))" : undefined }}
                    />
                    {/* 目标端圆点 */}
                    <circle cx={x2} cy={y2} r={4} fill={color} style={{ pointerEvents: "none" }} />
                    {/* 源端圆点 */}
                    <circle cx={x1} cy={y1} r={4} fill={color} style={{ pointerEvents: "none" }} />
                  </g>
                );
              });
            })}
          {/* 临时连接线（拖拽建立连接时） */}
          {connecting && (
            <path
              d={`M ${connecting.sourcePos.x} ${connecting.sourcePos.y} C ${connecting.sourcePos.x + 40} ${connecting.sourcePos.y}, ${connecting.currentPos.x - 40} ${connecting.currentPos.y}, ${connecting.currentPos.x} ${connecting.currentPos.y}`}
              fill="none"
              stroke="#60a5fa"
              strokeWidth={2.5}
              strokeDasharray="6 4"
              strokeLinecap="round"
              style={{ pointerEvents: "none" }}
            />
          )}
        </svg>
        {/* Items */}
        {items.map((item) => (
          <CanvasItemCard
            key={item.id}
            item={item}
            selected={selectedIds.has(item.id)}
            maximized={maximizedId === item.id}
            onStartDrag={(e) => startDrag(e, item)}
            onStartResize={(e) => startResize(e, item)}
            onSelect={() => {
              if (activeTool === "select") {
                setSelectedIds(new Set([item.id]));
              }
            }}
            onDelete={() => deleteItem(item.id)}
            onMaximize={() => setMaximizedId(maximizedId === item.id ? null : item.id)}
            onPreviewImage={onPreviewImage}
            onPreviewVideo={onPreviewVideo}
            onDownloadFile={onDownloadFile}
            onPreviewFile={onPreviewFile}
            onTextEdit={(content) => {
              onItemsChange(
                items.map((i) =>
                  i.id === item.id
                    ? {
                        ...i,
                        content,
                        meta: { ...i.meta, editing: false },
                      }
                    : i,
                ),
              );
            }}
            onStartConnection={(e) => {
              e.stopPropagation();
              const anchor = getNodeAnchor(item, "right");
              setConnecting({
                sourceId: item.id,
                sourcePos: anchor,
                currentPos: anchor,
              });
            }}
            onCompleteConnection={(e) => {
              e.stopPropagation();
              if (connecting) {
                addConnection(connecting.sourceId, item.id);
                setConnecting(null);
              }
            }}
          />
        ))}

        {/* 框选矩形 */}
        {isBoxSelecting && boxSelectStart.current && boxSelectEnd && (
          <div
            className="absolute pointer-events-none border border-blue-400/80 bg-blue-400/10 rounded-sm"
            style={{
              left: Math.min(boxSelectStart.current.x, boxSelectEnd.x),
              top: Math.min(boxSelectStart.current.y, boxSelectEnd.y),
              width: Math.abs(boxSelectEnd.x - boxSelectStart.current.x),
              height: Math.abs(boxSelectEnd.y - boxSelectStart.current.y),
            }}
          />
        )}

        {/* 多选边界框 */}
        {selectedIds.size > 1 && !isBoxSelecting && !isMultiDragging && (() => {
          const selItems = items.filter((i) => selectedIds.has(i.id));
          if (selItems.length === 0) return null;
          const minX = Math.min(...selItems.map((i) => i.x));
          const minY = Math.min(...selItems.map((i) => i.y));
          const maxX = Math.max(...selItems.map((i) => i.x + i.width));
          const maxY = Math.max(...selItems.map((i) => i.y + i.height));
          return (
            <div
              className="absolute pointer-events-none border-2 border-blue-400/60 rounded"
              style={{
                left: minX - 4,
                top: minY - 4,
                width: maxX - minX + 8,
                height: maxY - minY + 8,
              }}
            >
              <div className="absolute -top-6 left-0 flex items-center gap-1 bg-blue-500/90 text-white text-xs px-2 py-0.5 rounded">
                {selItems.length} 个元素
              </div>
            </div>
          );
        })()}

        {/* Preview shape */}
        {previewShape && (
          <div
            className="absolute pointer-events-none border-2 border-dashed border-white/50"
            style={{
              left: previewShape.x,
              top: previewShape.y,
              width: previewShape.width,
              height: previewShape.height,
              backgroundColor: toolConfig.fillColor !== "transparent" ? `${toolConfig.fillColor}33` : "transparent",
            }}
          />
        )}

        {/* Preview drawing */}
        {previewDrawing && previewDrawing.points.length > 1 && (
          <svg
            className="absolute pointer-events-none"
            style={{
              left: Math.min(...previewDrawing.points.map((p) => p.x)),
              top: Math.min(...previewDrawing.points.map((p) => p.y)),
              overflow: "visible",
            }}
          >
            <polyline
              points={previewDrawing.points
                .map(
                  (p) =>
                    `${p.x - Math.min(...previewDrawing!.points.map((pp) => pp.x))},${
                      p.y - Math.min(...previewDrawing!.points.map((pp) => pp.y))
                    }`,
                )
                .join(" ")}
              fill="none"
              stroke={toolConfig.lineColor}
              strokeWidth={toolConfig.lineWidth}
              strokeDasharray={toolConfig.lineStyle === "dashed" ? "6 4" : undefined}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </div>

      {/* Zoom controls */}
      <div className="absolute bottom-4 left-4 flex items-center gap-1 bg-white/10 backdrop-blur-sm rounded-lg border border-white/10 z-30">
        <button
          onClick={() => setScale((s) => Math.max(MIN_SCALE, s - 0.1))}
          className="p-2 hover:bg-white/10 rounded-l-lg text-white/70 hover:text-white transition-colors"
        >
          −
        </button>
        <span className="px-2 text-xs text-white/60 min-w-[40px] text-center">
          {Math.round(scale * 100)}%
        </span>
        <button
          onClick={() => setScale((s) => Math.min(MAX_SCALE, s + 0.1))}
          className="p-2 hover:bg-white/10 text-white/70 hover:text-white transition-colors"
        >
          +
        </button>
        <div className="w-px h-4 bg-white/20 mx-0.5" />
        <button
          onClick={fitView}
          className="p-2 hover:bg-white/10 text-white/70 hover:text-white transition-colors"
          title="适应内容（自动缩放并居中显示所有节点）"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
        <button
          onClick={resetView}
          className="p-2 hover:bg-white/10 rounded-r-lg text-white/70 hover:text-white transition-colors"
          title="重置视图（1:1 还原至原点）"
        >
          <span className="text-xs font-medium">1:1</span>
        </button>
      </div>

      {/* Tool hint */}
      <div className="absolute bottom-4 right-4 bg-white/5 backdrop-blur-sm rounded-lg px-3 py-1.5 text-xs text-white/40 border border-white/10 z-30">
        {activeTool === "select" && "拖拽空白处框选 · Shift追加选择 · 拖拽元素移动 · Delete删除 · Esc取消"}
        {activeTool === "grab" && "抓取模式：拖拽平移画布 · 滚轮缩放"}
        {activeTool === "image" && "点击画布放置图片 · Esc取消"}
        {activeTool === "shape" && "在画布上拖拽绘制图形 · Esc取消"}
        {activeTool === "draw" && "按住鼠标在画布上自由绘制 · Esc取消"}
        {activeTool === "text" && "点击画布添加文本框 · Esc取消"}
      </div>

      {/* 多选删除按钮 */}
      {selectedIds.size > 1 && !isBoxSelecting && (
        <button
          onClick={() => {
            const toDelete = new Set(selectedIds);
            const remaining = items.filter((i) => !toDelete.has(i.id));
            onItemsChange(cleanupDanglingConnections(remaining, toDelete));
            setSelectedIds(new Set());
            if (maximizedId && toDelete.has(maximizedId)) setMaximizedId(null);
          }}
          className="absolute top-4 right-4 flex items-center gap-1.5 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 rounded-lg px-3 py-1.5 text-xs text-red-400 hover:text-red-300 transition-all z-30"
        >
          <Trash2 className="w-3.5 h-3.5" />
          删除选中 ({selectedIds.size})
        </button>
      )}

      {/* Empty state */}
      {items.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center text-white/20">
            <ImageIcon className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm">画布为空 · 使用上方工具栏创建内容</p>
          </div>
        </div>
      )}

      {/* 拖放悬停遮罩 */}
      {isDragOver && (
        <div className="absolute inset-0 bg-blue-500/5 border-2 border-dashed border-blue-400/40 rounded-lg pointer-events-none transition-all duration-300 z-40" />
      )}

      {/* 拖放跟随预览卡片 */}
      {isDragOver && dragPos && (
        <div
          className="absolute pointer-events-none z-50 flex items-center gap-1.5 px-2.5 py-1.5 bg-blue-500/20 border border-blue-400/50 rounded-lg backdrop-blur-sm"
          style={{
            left: dragPos.x * scale + offset.x + 12,
            top: dragPos.y * scale + offset.y + 12,
          }}
        >
          <Download className="w-3.5 h-3.5 text-blue-300" />
          <span className="text-xs text-blue-200">松开以添加到画布</span>
        </div>
      )}

      {/* 连接删除确认弹层 */}
      {pendingDeleteEdge && (
        <>
          {/* 半透明遮罩，点击空白处取消 */}
          <div
            className="absolute inset-0 z-50"
            onClick={() => setPendingDeleteEdge(null)}
          />
          <div
            className="absolute z-50 bg-[#1a1a1a] border border-white/15 rounded-lg shadow-2xl p-3 text-xs"
            style={{
              left: pendingDeleteEdge.screenX - (containerRef.current?.getBoundingClientRect().left ?? 0),
              top: pendingDeleteEdge.screenY - (containerRef.current?.getBoundingClientRect().top ?? 0),
              minWidth: 140,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-white/80 mb-3 flex items-center gap-1.5">
              <Trash2 className="w-3.5 h-3.5 text-red-400" />
              删除此连接？
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  removeConnection(pendingDeleteEdge);
                  setPendingDeleteEdge(null);
                }}
                className="flex-1 px-2 py-1.5 bg-red-500/80 hover:bg-red-500 rounded text-white transition-colors"
              >
                删除
              </button>
              <button
                onClick={() => setPendingDeleteEdge(null)}
                className="flex-1 px-2 py-1.5 bg-white/10 hover:bg-white/20 rounded text-white/70 transition-colors"
              >
                取消
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

interface CanvasItemCardProps {
  item: CanvasItem;
  selected: boolean;
  maximized: boolean;
  onStartDrag: (e: React.MouseEvent) => void;
  onStartResize: (e: React.MouseEvent) => void;
  onSelect: () => void;
  onDelete: () => void;
  onMaximize: () => void;
  onPreviewImage: (url: string, name?: string) => void;
  onPreviewVideo: (url: string, name: string) => void;
  onDownloadFile: (item: CanvasItem) => void;
  onPreviewFile: (item: CanvasItem) => void;
  onTextEdit: (content: string) => void;
  /** 源 handle（右侧）按下：开始拖拽建立连接 */
  onStartConnection?: (e: React.MouseEvent) => void;
  /** 目标 handle（左侧）释放：完成连接 */
  onCompleteConnection?: (e: React.MouseEvent) => void;
}

function CanvasItemCard({
  item,
  selected,
  maximized,
  onStartDrag,
  onStartResize,
  onSelect,
  onDelete,
  onMaximize,
  onPreviewImage,
  onPreviewVideo,
  onDownloadFile,
  onPreviewFile,
  onTextEdit,
  onStartConnection,
  onCompleteConnection,
}: CanvasItemCardProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [editingText, setEditingText] = useState(item.meta?.editing || false);
  const [editContent, setEditContent] = useState(item.content);
  const effectiveWidth = maximized ? 600 : item.width;
  const effectiveHeight = maximized ? 400 : item.height;

  const renderShape = () => {
    const shapeType = item.meta?.shapeType || "rectangle";
    const fill = item.meta?.fillColor || "transparent";
    const border = item.meta?.borderColor || "#ffffff";
    const stroke = item.meta?.strokeWidth || 2;

    const commonProps = {
      fill: fill === "transparent" ? "none" : fill,
      stroke: border,
      strokeWidth: stroke,
      strokeDasharray: undefined as string | undefined,
    };

    if (shapeType === "rectangle") {
      return (
        <svg width="100%" height="100%" viewBox={`0 0 ${item.width} ${item.height}`} preserveAspectRatio="none">
          <rect x={stroke / 2} y={stroke / 2} width={item.width - stroke} height={item.height - stroke} {...commonProps} rx={4} />
        </svg>
      );
    }
    if (shapeType === "circle") {
      return (
        <svg width="100%" height="100%" viewBox={`0 0 ${item.width} ${item.height}`} preserveAspectRatio="none">
          <ellipse cx={item.width / 2} cy={item.height / 2} rx={item.width / 2 - stroke / 2} ry={item.height / 2 - stroke / 2} {...commonProps} />
        </svg>
      );
    }
    if (shapeType === "triangle") {
      const points = `${item.width / 2},${stroke} ${stroke},${item.height - stroke} ${item.width - stroke},${item.height - stroke}`;
      return (
        <svg width="100%" height="100%" viewBox={`0 0 ${item.width} ${item.height}`} preserveAspectRatio="none">
          <polygon points={points} {...commonProps} />
        </svg>
      );
    }
    if (shapeType === "line") {
      return (
        <svg width="100%" height="100%" viewBox={`0 0 ${item.width} ${item.height}`} preserveAspectRatio="none">
          <line x1={stroke} y1={item.height / 2} x2={item.width - stroke} y2={item.height / 2} {...commonProps} />
        </svg>
      );
    }
    if (shapeType === "arrow") {
      const midY = item.height / 2;
      const endX = item.width - stroke;
      const arrowSize = Math.min(item.height / 3, 15);
      const path = `M${stroke},${midY} L${endX - arrowSize},${midY} M${endX - arrowSize},${midY - arrowSize / 2} L${endX},${midY} L${endX - arrowSize},${midY + arrowSize / 2}`;
      return (
        <svg width="100%" height="100%" viewBox={`0 0 ${item.width} ${item.height}`} preserveAspectRatio="none">
          <path d={path} fill="none" stroke={border} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    }
    return null;
  };

  const renderDrawing = () => {
    const points = item.meta?.points || [];
    if (points.length < 2) return null;

    const xs = points.map((p) => p.x);
    const ys = points.map((p) => p.y);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);

    const lineColor = item.meta?.lineColor || "#ffffff";
    const lineWidth = item.meta?.lineWidth || 3;
    const lineStyle = item.meta?.lineStyle || "solid";

    return (
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${item.width} ${item.height}`}
        preserveAspectRatio="none"
      >
        <polyline
          points={points
            .map((p) => `${p.x - minX},${p.y - minY}`)
            .join(" ")}
          fill="none"
          stroke={lineColor}
          strokeWidth={lineWidth}
          strokeDasharray={lineStyle === "dashed" ? "6 4" : undefined}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  };

  const renderContent = () => {
    if (item.type === "image") {
      return (
        <div className="relative w-full h-full group bg-black/20">
          <img
            src={asset(item.content)}
            alt={item.meta?.name || ""}
            className="w-full h-full object-contain cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              onPreviewImage(item.content, item.meta?.name);
            }}
          />
          {/* 悬浮工具栏 */}
          <div className="absolute bottom-0 left-0 right-0 flex items-center justify-center gap-2 p-2 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onPreviewImage(item.content, item.meta?.name);
              }}
              className="px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-xs text-white transition-colors backdrop-blur-sm"
            >
              预览
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDownloadFile(item);
              }}
              className="px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-xs text-white transition-colors backdrop-blur-sm"
            >
              下载
            </button>
          </div>
          {/* 文件名标签 */}
          {item.meta?.name && (
            <div className="absolute top-0 left-0 right-0 px-2 py-1 bg-gradient-to-b from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
              <p className="text-xs text-white truncate">{item.meta.name}</p>
            </div>
          )}
        </div>
      );
    }
    if (item.type === "video") {
      return (
        <div className="relative w-full h-full group">
          <video
            src={asset(item.content)}
            controls
            className="w-full h-full object-cover"
            onClick={(e) => e.stopPropagation()}
          />
          {/* 悬浮工具栏 */}
          <div className="absolute bottom-0 left-0 right-0 flex items-center justify-center gap-2 p-2 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onPreviewVideo(item.content, item.meta?.name || "视频");
              }}
              className="px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-xs text-white transition-colors backdrop-blur-sm"
            >
              预览
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDownloadFile(item);
              }}
              className="px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-xs text-white transition-colors backdrop-blur-sm"
            >
              下载
            </button>
          </div>
          {/* 文件名标签 */}
          {item.meta?.name && (
            <div className="absolute top-0 left-0 right-0 px-2 py-1 bg-gradient-to-b from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
              <p className="text-xs text-white truncate">{item.meta.name}</p>
            </div>
          )}
        </div>
      );
    }
    if (item.type === "html") {
      return (
        <div className="relative w-full h-full group bg-[#1a1a1a] rounded-lg overflow-hidden flex flex-col">
          {/* 顶部工具栏：文件名 + 操作按钮 */}
          <div className="flex items-center justify-between px-2 py-1.5 bg-slate-900 border-b border-white/10 flex-shrink-0">
            <div className="flex items-center gap-1.5 min-w-0">
              <Globe className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
              <span className="text-[11px] text-white/80 truncate max-w-[200px]">
                {item.meta?.name || "网页文件"}
              </span>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  window.open(asset(item.content), "_blank");
                }}
                className="p-1 rounded hover:bg-white/10 text-white/60 hover:text-white transition-colors"
                title="在新标签页打开"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDownloadFile(item);
                }}
                className="p-1 rounded hover:bg-white/10 text-white/60 hover:text-white transition-colors"
                title="下载"
              >
                <Download className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          {/* iframe 实时预览 */}
          <div className="flex-1 overflow-hidden bg-white relative">
            <iframe
              src={asset(item.content)}
              title={item.meta?.name || "网页预览"}
              className="w-full h-full border-0"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
            />
            {/* 加载失败时的回退提示 */}
            <div
              className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-slate-800 text-white/60 text-xs p-4 text-center pointer-events-none"
              style={{ display: "none" }}
            >
              <Globe className="w-8 h-8 text-amber-500" />
              <span>网页预览加载失败</span>
            </div>
          </div>
        </div>
      );
    }
    if (item.type === "file") {
      return (
        <div className="flex flex-col items-center justify-center h-full p-4 gap-3 bg-white/5">
          <div className="w-20 h-20 rounded-2xl bg-blue-500/20 flex items-center justify-center">
            <FileText className="w-10 h-10 text-blue-400" />
          </div>
          <p className="text-sm font-medium text-white truncate max-w-[200px] text-center">{item.meta?.name}</p>
          <div className="flex items-center gap-2 mt-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onPreviewFile(item);
              }}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-xs text-white transition-colors"
            >
              预览
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDownloadFile(item);
              }}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-xs text-white transition-colors"
            >
              下载
            </button>
          </div>
        </div>
      );
    }
    if (item.type === "shape") {
      return (
        <div className="w-full h-full bg-white/5" style={{ padding: 2 }}>
          {renderShape()}
        </div>
      );
    }
    if (item.type === "drawing") {
      return (
        <div className="w-full h-full bg-transparent" style={{ padding: 2 }}>
          {renderDrawing()}
        </div>
      );
    }
    // text
    if (editingText) {
      return (
        <textarea
          autoFocus
          value={editContent}
          onChange={(e) => setEditContent(e.target.value)}
          onMouseDown={(e) => e.stopPropagation()}
          onBlur={() => {
            setEditingText(false);
            onTextEdit(editContent);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setEditingText(false);
              onTextEdit(editContent);
            }
          }}
          className="w-full h-full bg-transparent border-0 outline-none resize-none p-4 text-sm text-white/90 leading-relaxed"
          style={{
            fontFamily: item.meta?.fontFamily,
            fontSize: item.meta?.fontSize,
            color: item.meta?.textColor,
            textAlign: item.meta?.textAlign,
          }}
        />
      );
    }
    return (
      <div
        className="p-4 text-sm text-white/90 leading-relaxed overflow-auto h-full cursor-text"
        style={{
          fontFamily: item.meta?.fontFamily,
          fontSize: item.meta?.fontSize,
          color: item.meta?.textColor,
          textAlign: item.meta?.textAlign,
        }}
        onDoubleClick={(e) => {
          e.stopPropagation();
          setEditContent(item.content);
          setEditingText(true);
        }}
      >
        {item.content.split("\n").map((line, i) => (
          <p key={i} className="mb-1">
            {line}
          </p>
        ))}
      </div>
    );
  };

  const getTypeIcon = () => {
    switch (item.type) {
      case "image":
        return <ImageIcon className="w-3.5 h-3.5 text-green-400" />;
      case "video":
        return <Play className="w-3.5 h-3.5 text-purple-400" />;
      case "file":
        return <FileText className="w-3.5 h-3.5 text-blue-400" />;
      case "shape":
        if (item.meta?.shapeType === "circle") return <Circle className="w-3.5 h-3.5 text-yellow-400" />;
        if (item.meta?.shapeType === "triangle") return <Triangle className="w-3.5 h-3.5 text-orange-400" />;
        if (item.meta?.shapeType === "line") return <Minus className="w-3.5 h-3.5 text-cyan-400" />;
        if (item.meta?.shapeType === "arrow")
          return (
            <svg className="w-3.5 h-3.5 text-pink-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          );
        return <Square className="w-3.5 h-3.5 text-indigo-400" />;
      case "drawing":
        return <PenTool className="w-3.5 h-3.5 text-emerald-400" />;
      case "text":
        return <Type className="w-3.5 h-3.5 text-white/60" />;
      default:
        return null;
    }
  };

  const getTypeName = () => {
    if (item.type === "shape") {
      const map: Record<string, string> = {
        rectangle: "矩形",
        circle: "圆形",
        triangle: "三角形",
        line: "直线",
        arrow: "箭头",
      };
      return map[item.meta?.shapeType || "rectangle"] || "图形";
    }
    if (item.type === "drawing") return "手绘";
    return item.meta?.name || item.type.toUpperCase();
  };

  const isShapeOrDrawing = item.type === "shape" || item.type === "drawing";

  return (
    <div
      className={`absolute group bg-[#1e1e1e] rounded-lg border transition-colors pointer-events-auto ${
        selected ? "border-white/40 shadow-lg shadow-white/5" : "border-white/10"
      } ${maximized ? "z-50" : ""}`}
      style={{
        left: maximized ? item.x + (item.width - effectiveWidth) / 2 : item.x,
        top: maximized ? item.y + (item.height - effectiveHeight) / 2 : item.y,
        width: effectiveWidth,
        height: effectiveHeight,
        zIndex: maximized ? 50 : item.zIndex,
      }}
      onMouseDown={(e) => {
        if (editingText) {
          e.stopPropagation();
        } else {
          onStartDrag(e);
        }
      }}
    >
      {/* Header bar */}
      {!isShapeOrDrawing && (
        <div
          className="flex items-center justify-between px-2 py-1.5 bg-white/5 rounded-t-lg cursor-move border-b border-white/5"
          onMouseDown={onStartDrag}
        >
          <div className="flex items-center gap-1.5">
            {getTypeIcon()}
            <span className="text-xs text-white/60 truncate max-w-[120px]">
              {getTypeName()}
            </span>
          </div>
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setCollapsed(!collapsed);
              }}
              className="p-1 hover:bg-white/10 rounded"
            >
              <ChevronDown
                className={`w-3 h-3 text-white/50 transition-transform ${collapsed ? "-rotate-90" : ""}`}
              />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onMaximize();
              }}
              className="p-1 hover:bg-white/10 rounded"
            >
              <Maximize2 className="w-3 h-3 text-white/50" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              className="p-1 hover:bg-red-500/20 rounded"
            >
              <Trash2 className="w-3 h-3 text-white/50 hover:text-red-400" />
            </button>
          </div>
        </div>
      )}

      {/* Shape/Drawing items get minimal header */}
      {isShapeOrDrawing && (
        <div
          className="absolute -top-7 left-0 right-0 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity z-10"
          onMouseDown={(e) => {
            e.stopPropagation();
            onStartDrag(e);
          }}
        >
          <div className="flex items-center gap-1.5 bg-[#1a1a1a]/90 backdrop-blur-sm px-2 py-1 rounded border border-white/10">
            {getTypeIcon()}
            <span className="text-xs text-white/60">{getTypeName()}</span>
          </div>
          <div className="flex items-center gap-0.5 bg-[#1a1a1a]/90 backdrop-blur-sm px-1 py-1 rounded border border-white/10">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              className="p-1 hover:bg-red-500/20 rounded"
            >
              <Trash2 className="w-3 h-3 text-white/50 hover:text-red-400" />
            </button>
          </div>
        </div>
      )}

      {/* Content */}
      {!collapsed && (
        <div
          className="overflow-hidden"
          style={{
            height: isShapeOrDrawing ? effectiveHeight : effectiveHeight - 32,
          }}
        >
          {renderContent()}
        </div>
      )}

      {/* Resize handle */}
      {!maximized && (
        <div
          className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize opacity-0 group-hover:opacity-100 transition-opacity"
          onMouseDown={onStartResize}
        >
          <div className="absolute bottom-1 right-1 w-2.5 h-2.5 border-r-2 border-b-2 border-white/40 rounded-br-sm" />
        </div>
      )}

      {/* 连接手柄：悬停节点时显示 */}
      {onStartConnection && (
        <div
          title="拖拽建立连接"
          onMouseDown={onStartConnection}
          className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-3 h-3 rounded-full bg-blue-400 border-2 border-[#1e1e1e] opacity-0 group-hover:opacity-100 hover:scale-150 transition-all cursor-crosshair z-20"
        />
      )}
      {onCompleteConnection && (
        <div
          title="拖到此处完成连接"
          onMouseUp={onCompleteConnection}
          className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-white/60 border-2 border-[#1e1e1e] opacity-0 group-hover:opacity-100 hover:scale-150 hover:bg-white transition-all cursor-cell z-20"
        />
      )}
    </div>
  );
}
