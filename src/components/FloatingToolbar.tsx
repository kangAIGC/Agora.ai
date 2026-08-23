"use client";

import { useState, useRef, useEffect } from "react";
import {
  MousePointer2,
  Hand,
  Image as ImageIcon,
  Square,
  Circle,
  Triangle,
  Minus,
  PenTool,
  Type,
  ChevronDown,
} from "lucide-react";

export type ToolMode = "select" | "grab" | "image" | "shape" | "draw" | "text";
export type ShapeType = "rectangle" | "circle" | "triangle" | "line" | "arrow";
export type LineStyle = "solid" | "dashed";

export interface ToolConfig {
  shapeType: ShapeType;
  fillColor: string;
  borderColor: string;
  strokeWidth: number;
  lineColor: string;
  lineWidth: number;
  lineStyle: LineStyle;
  fontSize: number;
  fontFamily: string;
  textColor: string;
  textAlign: "left" | "center" | "right";
}

export const DEFAULT_CONFIG: ToolConfig = {
  shapeType: "rectangle",
  fillColor: "transparent",
  borderColor: "#ffffff",
  strokeWidth: 2,
  lineColor: "#ffffff",
  lineWidth: 3,
  lineStyle: "solid",
  fontSize: 16,
  fontFamily: "Inter, sans-serif",
  textColor: "#ffffff",
  textAlign: "left",
};

const COLORS = [
  "#ffffff",
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
  "#000000",
  "transparent",
];

const FONT_FAMILIES = [
  "Inter, sans-serif",
  "'Noto Sans SC', sans-serif",
  "'Noto Serif SC', serif",
  "'JetBrains Mono', monospace",
  "'Georgia', serif",
];

interface FloatingToolbarProps {
  activeTool: ToolMode;
  onToolChange: (tool: ToolMode) => void;
  config: ToolConfig;
  onConfigChange: (config: ToolConfig) => void;
  onImageUpload: () => void;
}

export default function FloatingToolbar({
  activeTool,
  onToolChange,
  config,
  onConfigChange,
  onImageUpload,
}: FloatingToolbarProps) {
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
      }
    };
    if (openMenu) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [openMenu]);

  const toggleMenu = (menu: string) => {
    setOpenMenu((prev) => (prev === menu ? null : menu));
  };

  const ToolButton = ({
    tool,
    icon,
    label,
    shortcut,
  }: {
    tool: ToolMode;
    icon: React.ReactNode;
    label: string;
    shortcut?: string;
  }) => (
    <button
      onClick={() => {
        if (tool === "image") {
          onImageUpload();
        } else {
          onToolChange(tool);
        }
        setOpenMenu(null);
      }}
      className={`relative group flex flex-col items-center justify-center w-10 h-10 rounded-lg transition-all ${
        activeTool === tool
          ? "bg-white/20 text-white"
          : "text-white/60 hover:text-white hover:bg-white/10"
      }`}
      title={`${label}${shortcut ? ` (${shortcut})` : ""}`}
    >
      {icon}
      <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 hidden group-hover:block bg-black/80 text-white text-xs px-2 py-0.5 rounded whitespace-nowrap z-50">
        {label}
        {shortcut && <span className="ml-1 text-white/40">{shortcut}</span>}
      </span>
    </button>
  );

  return (
    <div
      ref={menuRef}
      className="absolute top-4 left-1/2 -translate-x-1/2 z-40"
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className="flex items-center gap-0.5 bg-[#1a1a1a]/90 backdrop-blur-md border border-white/15 rounded-xl px-1.5 py-1.5 shadow-2xl">
        {/* 选择/抓取 */}
        <div className="flex items-center">
          <ToolButton tool="select" icon={<MousePointer2 className="w-5 h-5" />} label="选择" shortcut="V" />
          <ToolButton tool="grab" icon={<Hand className="w-5 h-5" />} label="抓取" shortcut="H" />
          <div className="w-px h-6 bg-white/15 mx-1" />
        </div>

        {/* 图片上传 */}
        <ToolButton tool="image" icon={<ImageIcon className="w-5 h-5" />} label="图片上传" shortcut="I" />

        {/* 图形 */}
        <div className="relative">
          <button
            onClick={() => {
              onToolChange("shape");
              toggleMenu("shape");
            }}
            className={`relative flex flex-col items-center justify-center w-10 h-10 rounded-lg transition-all ${
              activeTool === "shape"
                ? "bg-white/20 text-white"
                : "text-white/60 hover:text-white hover:bg-white/10"
            }`}
            title="图形"
          >
            {config.shapeType === "rectangle" && <Square className="w-5 h-5" />}
            {config.shapeType === "circle" && <Circle className="w-5 h-5" />}
            {config.shapeType === "triangle" && <Triangle className="w-5 h-5" />}
            {config.shapeType === "line" && <Minus className="w-5 h-5" />}
            {config.shapeType === "arrow" && (
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
            <ChevronDown className="w-3 h-3 absolute -bottom-0.5 -right-0.5 text-white/40" />
          </button>
          <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 hidden group-hover:block bg-black/80 text-white text-xs px-2 py-0.5 rounded whitespace-nowrap z-50">
            图形 (R)
          </span>

          {openMenu === "shape" && (
            <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-48 bg-[#1a1a1a] border border-white/15 rounded-xl shadow-2xl p-3 z-50">
              <p className="text-xs text-white/40 mb-2 font-medium">选择图形类型</p>
              <div className="grid grid-cols-5 gap-1.5 mb-3">
                {(["rectangle", "circle", "triangle", "line", "arrow"] as ShapeType[]).map((s) => (
                  <button
                    key={s}
                    onClick={() => {
                      onConfigChange({ ...config, shapeType: s });
                      onToolChange("shape");
                      setOpenMenu(null);
                    }}
                    className={`flex items-center justify-center w-8 h-8 rounded-lg transition-colors ${
                      config.shapeType === s
                        ? "bg-white/20 text-white"
                        : "text-white/60 hover:bg-white/10 hover:text-white"
                    }`}
                    title={s}
                  >
                    {s === "rectangle" && <Square className="w-4 h-4" />}
                    {s === "circle" && <Circle className="w-4 h-4" />}
                    {s === "triangle" && <Triangle className="w-4 h-4" />}
                    {s === "line" && <Minus className="w-4 h-4" />}
                    {s === "arrow" && (
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                        <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </button>
                ))}
              </div>

              <div className="border-t border-white/10 pt-2 mb-2">
                <p className="text-xs text-white/40 mb-1.5">填充颜色</p>
                <div className="flex gap-1">
                  {COLORS.map((c) => (
                    <button
                      key={c}
                      onClick={() => onConfigChange({ ...config, fillColor: c })}
                      className={`w-5 h-5 rounded border transition-transform hover:scale-110 ${
                        config.fillColor === c ? "border-white ring-2 ring-white/30" : "border-white/20"
                      }`}
                      style={{ backgroundColor: c === "transparent" ? "transparent" : c }}
                      title={c}
                    />
                  ))}
                </div>
              </div>

              <div className="mb-2">
                <p className="text-xs text-white/40 mb-1.5">边框颜色</p>
                <div className="flex gap-1">
                  {COLORS.filter((c) => c !== "transparent").map((c) => (
                    <button
                      key={c}
                      onClick={() => onConfigChange({ ...config, borderColor: c })}
                      className={`w-5 h-5 rounded border transition-transform hover:scale-110 ${
                        config.borderColor === c ? "border-white ring-2 ring-white/30" : "border-white/20"
                      }`}
                      style={{ backgroundColor: c }}
                      title={c}
                    />
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between">
                <p className="text-xs text-white/40">线条粗细</p>
                <div className="flex gap-1">
                  {[1, 2, 3, 5].map((w) => (
                    <button
                      key={w}
                      onClick={() => onConfigChange({ ...config, strokeWidth: w })}
                      className={`px-2 py-0.5 text-xs rounded transition-colors ${
                        config.strokeWidth === w
                          ? "bg-white/20 text-white"
                          : "text-white/60 hover:bg-white/10"
                      }`}
                    >
                      {w}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 手绘 */}
        <div className="relative">
          <button
            onClick={() => {
              onToolChange("draw");
              toggleMenu("draw");
            }}
            className={`relative flex flex-col items-center justify-center w-10 h-10 rounded-lg transition-all ${
              activeTool === "draw"
                ? "bg-white/20 text-white"
                : "text-white/60 hover:text-white hover:bg-white/10"
            }`}
            title="手绘"
          >
            <PenTool className="w-5 h-5" />
            <ChevronDown className="w-3 h-3 absolute -bottom-0.5 -right-0.5 text-white/40" />
          </button>
          <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 hidden group-hover:block bg-black/80 text-white text-xs px-2 py-0.5 rounded whitespace-nowrap z-50">
            手绘 (D)
          </span>

          {openMenu === "draw" && (
            <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-44 bg-[#1a1a1a] border border-white/15 rounded-xl shadow-2xl p-3 z-50">
              <p className="text-xs text-white/40 mb-2 font-medium">手绘设置</p>

              <div className="mb-2">
                <p className="text-xs text-white/40 mb-1.5">线条颜色</p>
                <div className="flex gap-1">
                  {COLORS.filter((c) => c !== "transparent").map((c) => (
                    <button
                      key={c}
                      onClick={() => onConfigChange({ ...config, lineColor: c })}
                      className={`w-5 h-5 rounded border transition-transform hover:scale-110 ${
                        config.lineColor === c ? "border-white ring-2 ring-white/30" : "border-white/20"
                      }`}
                      style={{ backgroundColor: c }}
                      title={c}
                    />
                  ))}
                </div>
              </div>

              <div className="mb-2">
                <p className="text-xs text-white/40 mb-1.5">线条粗细</p>
                <div className="flex gap-1">
                  {[2, 3, 5, 8, 12].map((w) => (
                    <button
                      key={w}
                      onClick={() => onConfigChange({ ...config, lineWidth: w })}
                      className={`px-2 py-0.5 text-xs rounded transition-colors ${
                        config.lineWidth === w
                          ? "bg-white/20 text-white"
                          : "text-white/60 hover:bg-white/10"
                      }`}
                    >
                      {w}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs text-white/40 mb-1.5">线条样式</p>
                <div className="flex gap-1">
                  {(["solid", "dashed"] as LineStyle[]).map((s) => (
                    <button
                      key={s}
                      onClick={() => onConfigChange({ ...config, lineStyle: s })}
                      className={`px-2 py-0.5 text-xs rounded transition-colors ${
                        config.lineStyle === s
                          ? "bg-white/20 text-white"
                          : "text-white/60 hover:bg-white/10"
                      }`}
                    >
                      {s === "solid" ? "实线" : "虚线"}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 文本 */}
        <div className="relative">
          <button
            onClick={() => {
              onToolChange("text");
              toggleMenu("text");
            }}
            className={`relative flex flex-col items-center justify-center w-10 h-10 rounded-lg transition-all ${
              activeTool === "text"
                ? "bg-white/20 text-white"
                : "text-white/60 hover:text-white hover:bg-white/10"
            }`}
            title="文本"
          >
            <Type className="w-5 h-5" />
            <ChevronDown className="w-3 h-3 absolute -bottom-0.5 -right-0.5 text-white/40" />
          </button>
          <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 hidden group-hover:block bg-black/80 text-white text-xs px-2 py-0.5 rounded whitespace-nowrap z-50">
            文本 (T)
          </span>

          {openMenu === "text" && (
            <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-56 bg-[#1a1a1a] border border-white/15 rounded-xl shadow-2xl p-3 z-50">
              <p className="text-xs text-white/40 mb-2 font-medium">文本设置</p>

              <div className="mb-2">
                <p className="text-xs text-white/40 mb-1.5">字体</p>
                <select
                  value={config.fontFamily}
                  onChange={(e) => onConfigChange({ ...config, fontFamily: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-white"
                >
                  {FONT_FAMILIES.map((f) => (
                    <option key={f} value={f} className="bg-[#1a1a1a]">
                      {f.split(",")[0].replace(/'/g, "")}
                    </option>
                  ))}
                </select>
              </div>

              <div className="mb-2">
                <p className="text-xs text-white/40 mb-1.5">字号</p>
                <div className="flex gap-1">
                  {[12, 14, 16, 20, 24, 32].map((s) => (
                    <button
                      key={s}
                      onClick={() => onConfigChange({ ...config, fontSize: s })}
                      className={`px-2 py-0.5 text-xs rounded transition-colors ${
                        config.fontSize === s
                          ? "bg-white/20 text-white"
                          : "text-white/60 hover:bg-white/10"
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mb-2">
                <p className="text-xs text-white/40 mb-1.5">文字颜色</p>
                <div className="flex gap-1">
                  {COLORS.filter((c) => c !== "transparent").map((c) => (
                    <button
                      key={c}
                      onClick={() => onConfigChange({ ...config, textColor: c })}
                      className={`w-5 h-5 rounded border transition-transform hover:scale-110 ${
                        config.textColor === c ? "border-white ring-2 ring-white/30" : "border-white/20"
                      }`}
                      style={{ backgroundColor: c }}
                      title={c}
                    />
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs text-white/40 mb-1.5">对齐方式</p>
                <div className="flex gap-1">
                  {(["left", "center", "right"] as const).map((a) => (
                    <button
                      key={a}
                      onClick={() => onConfigChange({ ...config, textAlign: a })}
                      className={`px-2 py-0.5 text-xs rounded transition-colors ${
                        config.textAlign === a
                          ? "bg-white/20 text-white"
                          : "text-white/60 hover:bg-white/10"
                      }`}
                    >
                      {a === "left" ? "左对齐" : a === "center" ? "居中" : "右对齐"}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Tool label */}
      {activeTool !== "select" && activeTool !== "grab" && (
        <div className="mt-2 text-center">
          <span className="bg-black/60 text-white/70 text-xs px-2 py-0.5 rounded-full">
            {activeTool === "image" && "点击画布放置图片"}
            {activeTool === "shape" && "拖拽画布绘制图形"}
            {activeTool === "draw" && "按住鼠标在画布上绘制"}
            {activeTool === "text" && "点击画布添加文本"}
          </span>
        </div>
      )}
    </div>
  );
}
