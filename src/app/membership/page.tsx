"use client";

import { useState } from "react";
import { Crown, Check, Zap, Star, Gem } from "lucide-react";

const plans = [
  {
    id: "monthly",
    name: "月卡会员",
    price: 29,
    originalPrice: 59,
    period: "月",
    icon: Zap,
    color: "from-blue-500 to-cyan-500",
    features: [
      "每月 50 次 AI 生成额度",
      "高清效果图下载",
      "优先排队生成",
      "基础素材库访问",
      "邮件技术支持",
    ],
  },
  {
    id: "quarterly",
    name: "季卡会员",
    price: 69,
    originalPrice: 177,
    period: "季",
    icon: Star,
    color: "from-purple-500 to-pink-500",
    popular: true,
    features: [
      "每月 150 次 AI 生成额度",
      "4K 超清效果图下载",
      "优先排队生成",
      "完整素材库访问",
      "专属客服支持",
      "免费使用新功能",
    ],
  },
  {
    id: "yearly",
    name: "年卡会员",
    price: 199,
    originalPrice: 708,
    period: "年",
    icon: Gem,
    color: "from-amber-500 to-orange-500",
    features: [
      "每月 500 次 AI 生成额度",
      "4K 超清效果图下载",
      "最高优先级生成",
      "完整素材库访问",
      "1对1 专属客服",
      "免费使用所有新功能",
      "线下活动优先参与",
      "定制专属模板",
    ],
  },
];

export default function MembershipPage() {
  const [selectedPlan, setSelectedPlan] = useState("quarterly");

  return (
    <div className="min-h-screen bg-black py-12">
      <div className="mx-auto max-w-6xl px-6">
        {/* 页面标题 */}
        <div className="mb-12 text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-4 py-2">
            <Crown className="h-5 w-5 text-amber-500" />
            <span className="text-sm font-medium text-amber-500">会员专属权益</span>
          </div>
          <h1 className="mb-4 text-4xl font-bold text-white">
            升级 VIP，解锁全部功能
          </h1>
          <p className="text-lg text-white/60">
            选择适合您的会员方案，享受更强大的 AI 建筑设计能力
          </p>
        </div>

        {/* 会员方案卡片 */}
        <div className="mb-12 grid gap-6 md:grid-cols-3">
          {plans.map((plan) => {
            const Icon = plan.icon;
            const isSelected = selectedPlan === plan.id;
            return (
              <div
                key={plan.id}
                onClick={() => setSelectedPlan(plan.id)}
                className={`relative cursor-pointer rounded-2xl border p-6 transition-all ${
                  isSelected
                    ? "border-white/30 bg-white/10"
                    : "border-white/10 bg-white/5 hover:border-white/20"
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 px-4 py-1 text-xs font-medium text-white">
                    最受欢迎
                  </div>
                )}

                <div className="mb-4 flex items-center justify-between">
                  <div className={`rounded-xl bg-gradient-to-r ${plan.color} p-3`}>
                    <Icon className="h-6 w-6 text-white" />
                  </div>
                  {isSelected && (
                    <div className="rounded-full bg-white p-1">
                      <Check className="h-4 w-4 text-black" />
                    </div>
                  )}
                </div>

                <h3 className="mb-2 text-xl font-bold text-white">{plan.name}</h3>
                
                <div className="mb-4 flex items-baseline gap-2">
                  <span className="text-4xl font-bold text-white">¥{plan.price}</span>
                  <span className="text-lg text-white/50 line-through">¥{plan.originalPrice}</span>
                  <span className="text-sm text-white/60">/{plan.period}</span>
                </div>

                <div className="mb-4 rounded-lg bg-white/5 p-3">
                  <div className="text-center">
                    <span className="text-sm text-white/60">节省 </span>
                    <span className="font-bold text-amber-500">
                      ¥{plan.originalPrice - plan.price}
                    </span>
                    <span className="text-sm text-white/60">
                      ({Math.round((1 - plan.price / plan.originalPrice) * 100)}% off)
                    </span>
                  </div>
                </div>

                <ul className="space-y-3">
                  {plan.features.map((feature, index) => (
                    <li key={index} className="flex items-start gap-3">
                      <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-500" />
                      <span className="text-sm text-white/80">{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>

        {/* 支付方式 */}
        <div className="mx-auto max-w-2xl rounded-2xl border border-white/10 bg-white/5 p-8">
          <h3 className="mb-6 text-center text-xl font-bold text-white">
            选择支付方式
          </h3>
          
          <div className="mb-6 grid grid-cols-3 gap-4">
            <button className="flex items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/5 py-3 text-white transition-colors hover:bg-white/10">
              <div className="h-6 w-6 rounded-full bg-green-500"></div>
              <span>微信支付</span>
            </button>
            <button className="flex items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/5 py-3 text-white transition-colors hover:bg-white/10">
              <div className="h-6 w-6 rounded-full bg-blue-500"></div>
              <span>支付宝</span>
            </button>
            <button className="flex items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/5 py-3 text-white transition-colors hover:bg-white/10">
              <div className="h-6 w-6 rounded-full bg-purple-500"></div>
              <span>Apple Pay</span>
            </button>
          </div>

          <button className="w-full rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 py-4 text-lg font-bold text-white transition-all hover:from-amber-600 hover:to-orange-600">
            立即开通 ¥{plans.find(p => p.id === selectedPlan)?.price}/
            {plans.find(p => p.id === selectedPlan)?.period}
          </button>

          <p className="mt-4 text-center text-sm text-white/50">
            开通即表示同意《会员服务协议》和《自动续费协议》
          </p>
        </div>

        {/* 常见问题 */}
        <div className="mt-12 mx-auto max-w-2xl">
          <h3 className="mb-6 text-center text-xl font-bold text-white">常见问题</h3>
          <div className="space-y-4">
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <h4 className="mb-2 font-medium text-white">会员权益何时生效？</h4>
              <p className="text-sm text-white/60">支付成功后立即生效，会员权益即时解锁。</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <h4 className="mb-2 font-medium text-white">可以退款吗？</h4>
              <p className="text-sm text-white/60">开通后 7 天内未使用会员权益可申请全额退款。</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <h4 className="mb-2 font-medium text-white">会员到期后数据会丢失吗？</h4>
              <p className="text-sm text-white/60">不会。您的所有生成记录和素材都会永久保存。</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
