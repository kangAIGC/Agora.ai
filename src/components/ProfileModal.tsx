"use client";

import { useState } from "react";
import { X, User, Github, Facebook, Twitter } from "lucide-react";

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ProfileModal({ isOpen, onClose }: ProfileModalProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nickname, setNickname] = useState("");
  const [rememberMe, setRememberMe] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // 模拟登录/注册
    console.log(isLogin ? "登录" : "注册", { email, password, nickname });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* 背景遮罩 */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* 模态框内容 */}
      <div className="relative w-full max-w-md rounded-2xl border border-white/10 bg-black p-8 shadow-2xl">
        {/* 关闭按钮 */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-white/60 transition-colors hover:text-white"
        >
          <X className="h-5 w-5" />
        </button>

        {/* 头像 */}
        <div className="mb-6 flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full border border-white/20 bg-white/10">
            <User className="h-8 w-8 text-white" />
          </div>
        </div>

        {/* 标题 */}
        <h2 className="mb-2 text-center text-2xl font-bold text-white">
          {isLogin ? "欢迎回来" : "创建账户"}
        </h2>
        <p className="mb-8 text-center text-sm text-white/60">
          {isLogin ? "登录您的 ArchCreator.ai 账户" : "注册 ArchCreator.ai 账户"}
        </p>

        {/* 表单 */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <div>
              <label className="mb-2 block text-sm font-medium text-white/80">
                昵称
              </label>
              <input
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="请输入昵称"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder-white/40 outline-none transition-colors focus:border-white/30"
              />
            </div>
          )}

          <div>
            <label className="mb-2 block text-sm font-medium text-white/80">
              邮箱
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="请输入邮箱"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder-white/40 outline-none transition-colors focus:border-white/30"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-white/80">
              密码
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="请输入密码"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder-white/40 outline-none transition-colors focus:border-white/30"
            />
          </div>

          {isLogin && (
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm text-white/60">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="rounded border-white/20 bg-white/5"
                />
                记住我
              </label>
              <button type="button" className="text-sm text-white/60 hover:text-white">
                忘记密码？
              </button>
            </div>
          )}

          <button
            type="submit"
            className="w-full rounded-xl bg-white py-3 text-lg font-bold text-black transition-all hover:bg-white/90 hover:shadow-lg hover:shadow-white/25"
          >
            {isLogin ? "登录" : "注册"}
          </button>
        </form>

        {/* 切换登录/注册 */}
        <div className="mt-6 text-center text-sm text-white/60">
          {isLogin ? "还没有账户？" : "已有账户？"}
          <button
            onClick={() => setIsLogin(!isLogin)}
            className="ml-2 text-white/60 hover:text-white"
          >
            {isLogin ? "立即注册" : "立即登录"}
          </button>
        </div>

        {/* 分隔线 */}
        <div className="my-6 flex items-center gap-4">
          <div className="h-px flex-1 bg-white/10" />
          <span className="text-sm text-white/40">其他登录方式</span>
          <div className="h-px flex-1 bg-white/10" />
        </div>

        {/* 第三方登录 */}
        <div className="flex justify-center gap-4">
          <button className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/60 transition-colors hover:bg-white/10 hover:text-white">
            <Facebook className="h-5 w-5" />
          </button>
          <button className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/60 transition-colors hover:bg-white/10 hover:text-white">
            <Github className="h-5 w-5" />
          </button>
          <button className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/60 transition-colors hover:bg-white/10 hover:text-white">
            <Twitter className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
