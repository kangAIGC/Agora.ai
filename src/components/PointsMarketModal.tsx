"use client";

import { useState, useEffect } from "react";
import { X, Coins, ShoppingCart, Sparkles, Clock, ChevronRight, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { POINTS_PACKAGES, addPoints, getPointsBalance, getServiceCosts, getTransactions, type PointsTransaction } from "@/lib/points-store";

interface PointsMarketModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBalanceChange: (newBalance: number) => void;
}

type TabType = "packages" | "pricing" | "history";

export default function PointsMarketModal({ isOpen, onClose, onBalanceChange }: PointsMarketModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>("packages");
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState<PointsTransaction[]>([]);
  const [purchaseTarget, setPurchaseTarget] = useState<string | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [detailTransaction, setDetailTransaction] = useState<PointsTransaction | null>(null);

  useEffect(() => {
    if (isOpen) updateBalance();
  }, [isOpen]);

  const updateBalance = () => {
    const bal = getPointsBalance();
    setBalance(bal);
    onBalanceChange(bal);
  };

  const handlePurchase = (packageId: string) => {
    const pkg = POINTS_PACKAGES.find((p) => p.id === packageId);
    if (!pkg) return;
    const totalPoints = pkg.points + (pkg.bonus || 0);
    setPurchaseTarget(packageId);

    setTimeout(() => {
      addPoints(totalPoints, `购买积分包：${pkg.name}（¥${pkg.price}）`, "purchase");
      updateBalance();
      setPurchaseTarget(null);
      toast.success(`成功购买 ${totalPoints} 积分！`);
    }, 800);
  };

  const handleViewDetail = (tx: PointsTransaction) => {
    setDetailTransaction(tx);
    setShowDetailModal(true);
  };

  const loadTransactions = () => {
    setTransactions(getTransactions().slice(0, 20));
  };

  useEffect(() => {
    if (activeTab === "history") loadTransactions();
  }, [activeTab]);

  if (!isOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
        onClick={onClose}
      >
        <div
          className="w-full max-w-4xl max-h-[85vh] overflow-hidden bg-[#0f0f0f] border border-white/10 rounded-2xl shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                <Coins className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-medium text-white">积分超市</h2>
                <p className="text-xs text-white/40">购买积分，解锁更多AI创作</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-500/10 border border-blue-500/20">
                <span className="text-sm text-white/50">余额</span>
                <span className="text-base font-medium text-blue-400">{balance.toLocaleString()}</span>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-lg text-white/50 hover:text-white hover:bg-white/5 transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-1 px-6 py-3 border-b border-white/5">
            {([
              { key: "packages" as TabType, label: "积分包", icon: ShoppingCart },
              { key: "pricing" as TabType, label: "服务定价", icon: Sparkles },
              { key: "history" as TabType, label: "交易记录", icon: Clock },
            ]).map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-all ${
                    activeTab === tab.key
                      ? "bg-blue-500/15 text-blue-400"
                      : "text-white/50 hover:text-white/70 hover:bg-white/5"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Content */}
          <div className="overflow-y-auto" style={{ maxHeight: "calc(85vh - 140px)" }}>
            {activeTab === "packages" && (
              <div className="p-6 space-y-5">
                {/* 积分包网格 */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {POINTS_PACKAGES.map((pkg) => (
                    <div
                      key={pkg.id}
                      className={`relative rounded-xl p-5 border transition-all ${
                        pkg.featured
                          ? "bg-blue-500/10 border-blue-500/30"
                          : "bg-white/5 border-white/10 hover:border-blue-500/20"
                      }`}
                    >
                      {pkg.tag && (
                        <div className="absolute -top-2 right-3 px-2 py-0.5 rounded text-[10px] font-medium bg-blue-500/20 text-blue-400 border border-blue-500/30">
                          {pkg.tag}
                        </div>
                      )}
                      <div className="mb-3">
                        <h3 className="text-base font-medium text-white">{pkg.name}</h3>
                        <p className="text-xs text-white/40 mt-0.5">{pkg.description}</p>
                      </div>
                      <div className="mb-3">
                        <div className="flex items-baseline gap-1">
                          <span className="text-xl font-semibold text-white">{pkg.points.toLocaleString()}</span>
                          <span className="text-xs text-white/40">积分</span>
                        </div>
                        {pkg.bonus && (
                          <div className="text-xs text-blue-400 mt-0.5">含赠送 {pkg.bonus.toLocaleString()}</div>
                        )}
                      </div>
                      <div className="mb-4 flex items-baseline gap-1">
                        <span className="text-lg font-medium text-white">¥{pkg.price}</span>
                        {pkg.originalPrice && (
                          <span className="text-xs text-white/30 line-through">¥{pkg.originalPrice}</span>
                        )}
                      </div>
                      <button
                        onClick={() => handlePurchase(pkg.id)}
                        disabled={purchaseTarget === pkg.id}
                        className={`w-full py-2 rounded-lg text-sm transition-all ${
                          purchaseTarget === pkg.id
                            ? "bg-white/20 text-white/50"
                            : pkg.featured
                            ? "bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:from-blue-600 hover:to-blue-700 font-medium"
                            : "bg-white/10 text-white hover:bg-blue-500/20 hover:text-blue-400"
                        }`}
                      >
                        {purchaseTarget === pkg.id ? "购买中..." : "购买"}
                      </button>
                    </div>
                  ))}
                </div>

                {/* 积分说明 */}
                <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4">
                  <h4 className="text-sm font-medium text-blue-400 mb-3">说明</h4>
                  <ul className="space-y-1.5 text-xs text-white/50">
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-blue-400/60 mt-px flex-shrink-0" />
                      <span>积分购买后立即到账，永久有效</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-blue-400/60 mt-px flex-shrink-0" />
                      <span>可用于设计、渲染、视频、网页等所有AI服务</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-blue-400/60 mt-px flex-shrink-0" />
                      <span>7天内可申请退款</span>
                    </li>
                  </ul>
                </div>
              </div>
            )}

            {activeTab === "pricing" && (
              <div className="p-6 space-y-4">
                <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4">
                  <h3 className="text-sm font-medium text-blue-400 mb-2">服务定价</h3>
                  <p className="text-xs text-white/50">
                    使用AI服务将根据类型扣除相应积分，积分不足时请及时充值。
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {getServiceCosts().map((service) => (
                    <div
                      key={service.id}
                      className="rounded-xl border border-white/10 p-5 hover:border-blue-500/30 hover:bg-blue-500/5 transition-all"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="text-base font-medium text-white">{service.name}</h4>
                          <p className="text-xs text-white/40 mt-0.5">{service.description}</p>
                        </div>
                      </div>
                      <div className="mt-4 flex items-baseline gap-1">
                        <span className="text-xl font-semibold text-blue-400">{service.points}</span>
                        <span className="text-xs text-white/40">积分/次</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === "history" && (
              <div className="p-6">
                {transactions.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16">
                    <Clock className="w-10 h-10 text-white/15 mb-3" />
                    <p className="text-sm text-white/40">暂无交易记录</p>
                  </div>
                ) : (
                  <div className="rounded-xl border border-white/10 overflow-hidden">
                    <div className="divide-y divide-white/5">
                      {transactions.map((tx) => (
                        <button
                          key={tx.id}
                          onClick={() => handleViewDetail(tx)}
                          className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-blue-500/5 transition-colors text-left"
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                                tx.type === "purchase"
                                  ? "bg-blue-500/15 text-blue-400"
                                  : "bg-white/5 text-white/50"
                              }`}
                            >
                              {tx.type === "purchase" ? (
                                <Coins className="w-4 h-4" />
                              ) : (
                                <Sparkles className="w-4 h-4" />
                              )}
                            </div>
                            <div>
                              <div className="text-sm text-white">{tx.description}</div>
                              <div className="text-xs text-white/35 mt-0.5">
                                {new Date(tx.createdAt).toLocaleString("zh-CN")}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <span
                              className={`text-sm font-medium ${
                                tx.amount > 0 ? "text-blue-400" : "text-white/50"
                              }`}
                            >
                              {tx.amount > 0 ? "+" : ""}{tx.amount}
                            </span>
                            <ChevronRight className="w-3.5 h-3.5 text-white/25" />
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 交易详情弹窗 */}
      {showDetailModal && detailTransaction && (
        <div
          className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setShowDetailModal(false)}
        >
          <div
            className="w-full max-w-sm bg-[#141414] border border-blue-500/20 rounded-2xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-medium text-white">交易详情</h3>
              <button
                onClick={() => setShowDetailModal(false)}
                className="p-1 rounded-lg text-white/40 hover:text-white hover:bg-white/5"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-4">
              <div className="text-center py-3 border-b border-blue-500/20">
                <div className="text-2xl font-semibold text-blue-400">
                  {detailTransaction.amount > 0 ? "+" : ""}
                  {detailTransaction.amount}
                </div>
                <div className="text-xs text-white/40 mt-1">{detailTransaction.description}</div>
              </div>
              <div className="space-y-2.5">
                <div className="flex justify-between text-xs">
                  <span className="text-white/40">类型</span>
                  <span className="text-white/70">
                    {detailTransaction.type === "purchase" ? "充值" : detailTransaction.type === "consume" ? "消费" : "其他"}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-white/40">时间</span>
                  <span className="text-white/70">
                    {new Date(detailTransaction.createdAt).toLocaleString("zh-CN")}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-white/40">余额</span>
                  <span className="text-blue-400">{detailTransaction.balance.toLocaleString()} 积分</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-white/40">单号</span>
                  <span className="text-white/40 font-mono">{detailTransaction.id}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
