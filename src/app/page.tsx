"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

// 首页背景视频循环（单一事实来源，顺序即播放顺序，循环往复）
// 当前循环：bg3.mp4 → 3.mp4 → bg3.mp4 → ...
const BG_VIDEO_SOURCES = ["/bg3.mp4", "/3.mp4"] as const;

const features = [
  {
    title: "AI DESIGN",
    description: "基于任务书生成概念策划方案",
    href: "/design",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
      </svg>
    ),
  },
  {
    title: "AI IMAGE",
    description: "基于策划方案生成效果图",
    href: "/render",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
      </svg>
    ),
  },
  {
    title: "AI VIDEO",
    description: "基于效果图生成漫游视频",
    href: "/video",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125M3.375 19.5h1.5C5.496 19.5 6 18.996 6 18.375m-3.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-1.5A1.125 1.125 0 0118 18.375M20.625 4.5H3.375m17.25 0c.621 0 1.125.504 1.125 1.125M20.625 4.5h-1.5C18.504 4.5 18 5.004 18 5.625m3.75 0v1.5c0 .621-.504 1.125-1.125 1.125M3.375 4.5c-.621 0-1.125.504-1.125 1.125M3.375 4.5h1.5C5.496 4.5 6 5.004 6 5.625m-3.75 0v1.5c0 .621.504 1.125 1.125 1.125m0 0h1.5m-1.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m1.5-3.75C5.496 8.25 6 7.746 6 7.125v-1.5M4.875 8.25C5.496 8.25 6 8.754 6 9.375v1.5m0-5.25v5.25m0-5.25C6 5.004 6.504 4.5 7.125 4.5h9.75c.621 0 1.125.504 1.125 1.125m1.125 2.625h1.5m-1.5 0A1.125 1.125 0 0118 7.125v-1.5m1.125 2.625c-.621 0-1.125.504-1.125 1.125v1.5m2.625-2.625c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125M18 5.625v5.25M7.125 12h9.75m-9.75 0A1.125 1.125 0 016 10.875M7.125 12C6.504 12 6 12.504 6 13.125m0-2.25C6 11.496 5.496 12 4.875 12M18 10.875c0 .621-.504 1.125-1.125 1.125M18 10.875c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125m-12 5.25v-5.25m0 5.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125m-12 0v-1.5c0-.621-.504-1.125-1.125-1.125M18 18.375v-5.25m0 5.25v-1.5c0-.621.504-1.125 1.125-1.125M18 13.125v1.5c0 .621.504 1.125 1.125 1.125M18 13.125c0-.621.504-1.125 1.125-1.125M6 13.125v1.5c0 .621-.504 1.125-1.125 1.125M6 13.125C6 12.504 5.496 12 4.875 12m-1.5 0h1.5m-1.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125M19.125 12h1.5m0 0c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h1.5m14.25 0h1.5" />
      </svg>
    ),
  },
  {
    title: "AI HTML",
    description: "统合策划方案、效果图与漫游视频生成网页文件",
    href: "/html",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5m.75-9l3-3 2.148 2.148A12.061 12.061 0 0116.5 7.605" />
      </svg>
    ),
  },
];

// 共享样式：双缓冲视频层统一样式，避免重复
const VIDEO_LAYER_CLASS =
  "absolute inset-0 w-full h-full object-cover transition-opacity duration-1500 ease-in-out will-change-transform";

export default function Home() {
  // 双缓冲视频槽：index 0 / index 1 两个 video 元素
  const slotRefs = useRef<[HTMLVideoElement | null, HTMLVideoElement | null]>([null, null]);
  // 当前哪个槽正在显示（active），另一个处于隐藏缓冲态
  const [activeSlot, setActiveSlot] = useState<0 | 1>(0);
  // 当前 activeSlot 上播放的 BG_VIDEO_SOURCES 索引（驱动循环）
  const sourceIndexRef = useRef(0);
  // 切换中互斥锁，防止 onTimeUpdate / onEnded / onerror 多重触发
  const switchingRef = useRef(false);

  const [isTransitioning, setIsTransitioning] = useState(false);
  const router = useRouter();

  // 挂载后启动第一段视频（HMR 重建后也要手动 play 一次，避免自动播放策略不启动）
  useEffect(() => {
    const first = slotRefs.current[0];
    if (!first) return;
    // 初始化第一段源
    first.src = BG_VIDEO_SOURCES[0];
    first.load();
    const p = first.play();
    if (p) p.catch((err) => console.warn("[BG Video] initial play failed:", err));
  }, []);

  // 切到下一段：按 BG_VIDEO_SOURCES 顺序循环，同时在另一个 slot 缓冲新视频并交叉淡入淡出
  const goNextSlot = (() => {
    const impl = (reason: "ended" | "timeupdate" | "error" | "manual") => {
      if (switchingRef.current) return;
      switchingRef.current = true;

      const prevIndex = sourceIndexRef.current;
      const nextIndex = (prevIndex + 1) % BG_VIDEO_SOURCES.length;
      const nextSlot: 0 | 1 = activeSlot === 0 ? 1 : 0;
      const oldVideo = slotRefs.current[activeSlot];
      const nextVideo = slotRefs.current[nextSlot];

      // error 场景：在 Console 留痕，便于以后替换视频
      if (reason === "error") {
        const badSrc = oldVideo?.currentSrc || BG_VIDEO_SOURCES[prevIndex];
        const code = oldVideo?.error?.code ?? 0;
        console.warn(
          `[BG Video] 视频异常（MediaError.code=${code}），自动跳过：${badSrc}，下一段：${BG_VIDEO_SOURCES[nextIndex]}`
        );
      }

      // 装载并启动下一段视频
      if (nextVideo) {
        nextVideo.src = BG_VIDEO_SOURCES[nextIndex];
        nextVideo.load();
        nextVideo.currentTime = 0;
        const p = nextVideo.play();
        if (p)
          p.catch((err) => {
            console.warn("[BG Video] next play failed:", err);
            // play 也失败时，再进入 error 兜底继续跳下一个，避免卡死
            setTimeout(() => {
              switchingRef.current = false;
              impl("error");
            }, 120);
          });
      }

      // 推进索引 & 交换 activeSlot → 触发 opacity 过渡
      sourceIndexRef.current = nextIndex;
      setActiveSlot(nextSlot);

      // 过渡完成后：暂停旧视频 + 释放旧资源（避免持续解码占用）
      window.setTimeout(() => {
        if (oldVideo) {
          try {
            oldVideo.pause();
            oldVideo.removeAttribute("src");
            // 触发一次 load 以释放对旧源的持握
            oldVideo.load();
          } catch {
            /* 忽略释放阶段的异常 */
          }
          oldVideo.currentTime = 0;
        }
        switchingRef.current = false;
      }, 1800);
    };
    return impl;
  })();

  // 兜底：当前 active 视频距离结尾 0.5s 就开始切（部分浏览器 onEnded 不触发）
  const handleTimeUpdate = (slot: 0 | 1) => {
    if (slot !== activeSlot || switchingRef.current) return;
    const v = slotRefs.current[slot];
    if (!v) return;
    const { currentTime, duration } = v;
    if (Number.isFinite(duration) && duration > 0 && currentTime >= duration - 0.5) {
      goNextSlot("timeupdate");
    }
  };

  // 错误兜底：视频解码失败 / 源损坏 / 编码不兼容 → 立刻跳到下一段，避免整段卡住
  const handleVideoError = () => {
    goNextSlot("error");
  };

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-black">
      {/* 视频背景（双缓冲两层 video，不使用 <source> 子元素，直接通过 .src 切换以获得可控的 load/error） */}
      <div className="absolute inset-0 w-full h-full">
        <video
          ref={(el) => {
            slotRefs.current[0] = el;
          }}
          className={`${VIDEO_LAYER_CLASS} ${
            activeSlot === 0 ? "opacity-100" : "opacity-0 pointer-events-none"
          }`}
          muted
          playsInline
          preload="auto"
          onEnded={() => goNextSlot("ended")}
          onTimeUpdate={() => handleTimeUpdate(0)}
          onError={handleVideoError}
        />
        <video
          ref={(el) => {
            slotRefs.current[1] = el;
          }}
          className={`${VIDEO_LAYER_CLASS} ${
            activeSlot === 1 ? "opacity-100" : "opacity-0 pointer-events-none"
          }`}
          muted
          playsInline
          preload="auto"
          onEnded={() => goNextSlot("ended")}
          onTimeUpdate={() => handleTimeUpdate(1)}
          onError={handleVideoError}
        />
        {/* 黑色遮罩（保证文案可读性） */}
        <div className="absolute inset-0 bg-black/60" />
      </div>

      {/* 内容层 */}
      <div className="relative z-10 min-h-screen flex flex-col">
        {/* 主内容区 - 与检索页聊天框位置一致 */}
        <div
          className={`flex-1 flex flex-col items-center justify-between px-8 pt-[320px] pb-8 transition-opacity duration-500 ${
            isTransitioning ? "opacity-0" : "opacity-100"
          }`}
        >
          {/* 标题区域 - 放在上半部分 */}
          <div className="text-center w-full">
            <h1 className="text-5xl md:text-7xl font-bold text-center mb-3 tracking-tight leading-tight">
              <span className="block text-white">让Agent持续推进</span>
              <span className="block text-blue-500">从创意走向内容交付</span>
            </h1>
            <p className="text-xs md:text-sm text-white/30 text-center mb-4 tracking-[0.2em] uppercase">
              Universal AIGC One-Stop Content Delivery Platform
            </p>
            <p className="text-base text-white/60 text-center leading-relaxed">
              面向多领域的通用 AIGC 一站式内容交付平台
              <br />
              提供从文案创作、资产图渲染、视频生成到网页制作的全流程智能创作服务
            </p>
          </div>

          {/* 智能体对话框 - 固定在底部 */}
          <div
            className={`w-full max-w-5xl transition-opacity duration-500 ${
              isTransitioning ? "opacity-0" : "opacity-100"
            }`}
          >
            <div className="relative bg-white/10 backdrop-blur-md rounded-2xl shadow-2xl border border-white/20 p-4">
              {/* 输入提示区 - 可点击跳转 */}
              <div
                className="flex items-center px-6 py-4 bg-white/5 rounded-xl mb-4 cursor-pointer hover:bg-white/20 transition-all duration-300"
                onClick={() => {
                  setIsTransitioning(true);
                  window.setTimeout(() => {
                    router.push("/chat?project=proj-pinned-blank");
                  }, 500);
                }}
              >
                <svg
                  className="w-5 h-5 text-white/50 mr-3 flex-shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                  />
                </svg>
                <span className="text-white/50 text-lg flex-1">Ask Agora anything...</span>
                <button className="p-2 bg-white text-black rounded-full hover:bg-white/90 transition-colors flex-shrink-0">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                </button>
              </div>

              {/* 四张功能卡片 - 有hover交互，不可点击跳转 */}
              <div className="grid grid-cols-4 gap-3">
                {features.map((feature) => (
                  <div
                    key={feature.title}
                    className="group relative bg-white/10 rounded-xl p-3 hover:bg-white/20 transition-all duration-300"
                  >
                    <div className="flex items-center gap-2">
                      <div className="text-white/80 group-hover:text-white transition-colors flex-shrink-0">
                        {feature.icon}
                      </div>
                      <span className="text-sm font-bold text-white whitespace-nowrap">{feature.title}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 页面过渡遮罩 */}
      {isTransitioning && (
        <div className="fixed inset-0 bg-black z-50 animate-fadeIn" />
      )}
    </div>
  );
}
