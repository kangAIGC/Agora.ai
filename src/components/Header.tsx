"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { Home, Compass, Bot, Crown, User, Coins, LogIn } from "lucide-react";
import MembershipModal from "./MembershipModal";
import { ProfileModal } from "./ProfileModal";
import PointsMarketModal from "./PointsMarketModal";
import { getPointsBalance } from "@/lib/points-store";

const navItems = [
  { label: "首页", href: "/", icon: Home },
  { label: "工作台", href: "/chat?project=proj-pinned-blank", icon: Bot },
  { label: "社区", href: "/discover", icon: Compass },
  { label: "个人", href: "/profile", icon: User },
];

export default function Header() {
  const pathname = usePathname();
  const [showMembership, setShowMembership] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showPointsMarket, setShowPointsMarket] = useState(false);
  const [pointsBalance, setPointsBalance] = useState(0);

  useEffect(() => {
    setPointsBalance(getPointsBalance());
  }, []);

  const handleBalanceChange = (newBalance: number) => {
    setPointsBalance(newBalance);
  };

  return (
    <>
      {/*
        固定顶栏（fixed top-0 left-0 right-0）+ backdrop-blur
        保证滚动/窗口缩放时定位稳定，跨浏览器兼容（使用标准 fixed + flex 布局，
        不依赖 position: absolute 的数值偏移，避免在不同内核豆包/Chromium/Edge 下错位）
      */}
      <header
        className={`fixed top-0 left-0 right-0 z-50 ${
          pathname === "/"
            ? "bg-transparent border-b border-white/20"
            : "bg-black border-b border-white/10"
        } backdrop-blur-md`}
      >
        {/*
          内部容器使用 w-full + justify-between 实现左右两端"卡死"对齐：
          - 左侧 flex-none 容器：固定在最左
          - 右侧 flex-none 容器：固定在最右
          中间无多余自动宽度子项，避免 flex 子项挤压导致左右偏移
        */}
        <div className="w-full h-16 px-4 sm:px-6 lg:px-8 flex items-center justify-between max-w-[1600px] mx-auto box-border">
          {/* ========== 左侧：标题 + 首页 + 工作台 + 社区 + 个人（严格顺序） ========== */}
          <div className="flex-none flex items-center gap-4 md:gap-6 lg:gap-8 overflow-hidden min-w-0">
            {/* 品牌标题（最左第一个） */}
            <Link
              href="/"
              className="flex-none text-lg sm:text-xl font-bold tracking-tight flex items-center gap-1.5 sm:gap-2 text-white whitespace-nowrap"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/mock-arch/Image-3.png"
                alt="Agora.ai"
                className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg object-cover flex-none"
              />
              <span>Agora</span>
              <span className="text-blue-500">.ai</span>
            </Link>

            {/* 导航：首页 → 工作台 → 社区 → 个人（顺序固定） */}
            {/* 小屏（<sm）仅图标；sm+ 图标+文字，确保小屏内容不溢出、顺序仍一致 */}
            <nav className="flex-none flex items-center gap-0.5 sm:gap-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                // 提取 href 的 pathname 部分（去掉 query string），用于 active 判断
                const itemPath = item.href.split("?")[0];
                const isActive =
                  pathname === itemPath ||
                  (itemPath !== "/" && pathname.startsWith(itemPath));
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex-none inline-flex items-center gap-0 sm:gap-1.5 px-2 sm:px-3 py-2 rounded-lg transition-all text-sm font-medium whitespace-nowrap ${
                      isActive
                        ? "bg-white/10 text-white"
                        : "text-white/60 hover:text-white hover:bg-white/5"
                    }`}
                  >
                    <Icon className="w-4 h-4 flex-none" />
                    <span className="hidden sm:inline">{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* ========== 右侧：积分 → 会员 → 登录（严格顺序 · 样式与左侧导航一致） ========== */}
          <div className="flex-none flex items-center gap-1 sm:gap-1 overflow-hidden min-w-0">
            {/* 1) 积分（右 1） */}
            <button
              type="button"
              onClick={() => setShowPointsMarket(true)}
              className="flex-none inline-flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-2 rounded-lg transition-all text-sm font-medium whitespace-nowrap text-white/60 hover:text-white hover:bg-white/5"
              title="积分超市"
            >
              <Coins className="w-4 h-4 flex-none" />
              <span className="hidden sm:inline">积分</span>
              <span className="text-xs sm:text-sm font-semibold whitespace-nowrap tabular-nums text-white/80">
                {pointsBalance.toLocaleString()}
              </span>
            </button>

            {/* 2) 会员（右 2） */}
            <button
              type="button"
              onClick={() => setShowMembership(true)}
              className="flex-none inline-flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-2 rounded-lg transition-all text-sm font-medium whitespace-nowrap text-white/60 hover:text-white hover:bg-white/5"
              title="会员充值"
            >
              <Crown className="w-4 h-4 flex-none" />
              <span className="hidden sm:inline">会员</span>
            </button>

            {/* 3) 登录（右 3） */}
            <button
              type="button"
              onClick={() => setShowProfile(true)}
              className="flex-none inline-flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-2 rounded-lg transition-all text-sm font-medium whitespace-nowrap text-white/60 hover:text-white hover:bg-white/5"
              title="登录 / 账户"
            >
              <LogIn className="w-4 h-4 flex-none" />
              <span className="hidden sm:inline">登录</span>
            </button>
          </div>
        </div>
      </header>

      <MembershipModal
        isOpen={showMembership}
        onClose={() => setShowMembership(false)}
      />
      <ProfileModal
        isOpen={showProfile}
        onClose={() => setShowProfile(false)}
      />
      <PointsMarketModal
        isOpen={showPointsMarket}
        onClose={() => setShowPointsMarket(false)}
        onBalanceChange={handleBalanceChange}
      />
    </>
  );
}
