"use client";

import { useState } from "react";
import { Check, X, Crown } from "lucide-react";

interface MembershipModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const plans = [
  {
    id: "monthly",
    name: "月卡",
    duration: "1个月",
    price: 29,
    originalPrice: 39,
    discount: null,
    recommended: false,
    features: [
      "无限次智能检索",
      "规范条文全文溯源",
      "图集截图高清下载",
      "优先客服响应",
    ],
  },
  {
    id: "quarterly",
    name: "季卡",
    duration: "3个月",
    price: 69,
    originalPrice: 117,
    discount: "省40%",
    recommended: false,
    features: [
      "月卡全部权益",
      "案例素材库访问",
      "批量导出检索结果",
      "专属检索策略调优",
    ],
  },
  {
    id: "yearly",
    name: "年卡",
    duration: "12个月",
    price: 199,
    originalPrice: 348,
    discount: "省40%",
    recommended: true,
    features: [
      "季卡全部权益",
      "新规范实时更新推送",
      "团队协作（5人）",
      "API 接口调用额度",
    ],
  },
];

export default function MembershipModal({ isOpen, onClose }: MembershipModalProps) {
  const [selectedPlan, setSelectedPlan] = useState("yearly");

  if (!isOpen) return null;

  const selectedPlanData = plans.find((p) => p.id === selectedPlan);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* 背景遮罩 */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* 模态框内容 */}
      <div className="relative w-full max-w-3xl rounded-2xl border border-white/10 bg-black p-8 shadow-2xl">
        {/* 关闭按钮 */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-2 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
        >
          <X className="h-5 w-5" />
        </button>

        {/* 标题 */}
        <div className="mb-8 text-center">
          <div className="mb-2 flex items-center justify-center gap-2">
            <Crown className="h-6 w-6 text-white" />
            <h2 className="text-2xl font-bold text-white">升级 VIP，解锁全部能力</h2>
          </div>
          <p className="text-sm text-white/60">
            选择适合您的订阅方案，随时可取消
          </p>
        </div>

        {/* 套餐选择 */}
        <div className="mb-8 grid grid-cols-3 gap-4">
          {plans.map((plan) => (
            <button
              key={plan.id}
              onClick={() => setSelectedPlan(plan.id)}
              className={`relative rounded-xl border p-5 text-left transition-all ${
                selectedPlan === plan.id
                  ? "border-white bg-white/20"
                  : "border-white/10 bg-white/5 hover:border-white/30 hover:bg-white/10"
              }`}
            >
              {/* 推荐标签 */}
              {plan.recommended && (
                <div className="absolute -right-2 -top-2 rounded-full bg-white px-3 py-1 text-xs font-medium text-black">
                  超值推荐
                </div>
              )}

              {/* 折扣标签 */}
              {plan.discount && (
                <div className="absolute -right-2 -top-2 rounded-full bg-white px-3 py-1 text-xs font-medium text-black">
                  {plan.discount}
                </div>
              )}

              {/* 套餐名称 */}
              <div className="mb-1 text-sm font-medium text-white/80">
                {plan.name}
              </div>
              <div className="mb-3 text-xs text-white/50">{plan.duration}</div>

              {/* 价格 */}
              <div className="mb-4 flex items-baseline gap-2">
                <span className="text-3xl font-bold text-white">
                  ¥{plan.price}
                </span>
                <span className="text-sm text-white/40 line-through">
                  ¥{plan.originalPrice}
                </span>
              </div>

              {/* 权益列表 */}
              <ul className="space-y-2">
                {plan.features.map((feature, index) => (
                  <li key={index} className="flex items-start gap-2 text-sm text-white/70">
                    <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-white" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </button>
          ))}
        </div>

        {/* 充值按钮 */}
        <button className="w-full rounded-xl bg-white py-4 text-lg font-bold text-black transition-all hover:bg-white/90 hover:shadow-lg hover:shadow-white/25">
          立即充值 ¥{selectedPlanData?.price}
        </button>

        {/* 支付方式 */}
        <div className="mt-4 text-center text-xs text-white/40">
          支持微信支付 · 支付宝 · 对公转账
        </div>
      </div>
    </div>
  );
}
