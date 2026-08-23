"use client";

const POINTS_BALANCE_KEY = "aga-points-balance";
const POINTS_TRANSACTIONS_KEY = "aga-points-transactions";
const POINTS_SPENDING_KEY = "aga-points-spending";

export interface PointsTransaction {
  id: string;
  type: "purchase" | "consume" | "refund" | "bonus";
  amount: number;
  balance: number;
  description: string;
  createdAt: number;
}

export interface ServiceCost {
  id: string;
  name: string;
  description: string;
  points: number;
  category: "design" | "image" | "video" | "webpage";
}

const DEFAULT_SERVICE_COSTS: ServiceCost[] = [
  { id: "ai-design", name: "AI设计", description: "概念方案生成", points: 30, category: "design" },
  { id: "ai-image", name: "AI图像", description: "效果图渲染", points: 80, category: "image" },
  { id: "ai-video", name: "AI视频", description: "视频生成", points: 200, category: "video" },
  { id: "ai-webpage", name: "AI网页", description: "网页生成", points: 50, category: "webpage" },
];

export function getPointsBalance(): number {
  try {
    const val = localStorage.getItem(POINTS_BALANCE_KEY);
    return val ? parseInt(val, 10) : 2000;
  } catch {
    return 2000;
  }
}

export function setPointsBalance(balance: number): void {
  localStorage.setItem(POINTS_BALANCE_KEY, balance.toString());
}

export function getTransactions(): PointsTransaction[] {
  try {
    const raw = localStorage.getItem(POINTS_TRANSACTIONS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function setTransactions(transactions: PointsTransaction[]): void {
  localStorage.setItem(POINTS_TRANSACTIONS_KEY, JSON.stringify(transactions));
}

export function addTransaction(transaction: Omit<PointsTransaction, "id" | "balance" | "createdAt">): PointsTransaction {
  const balance = getPointsBalance();
  const newTransaction: PointsTransaction = {
    ...transaction,
    id: `tx-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    balance: balance + transaction.amount,
    createdAt: Date.now(),
  };
  const transactions = getTransactions();
  transactions.unshift(newTransaction);
  setTransactions(transactions.slice(0, 100));
  setPointsBalance(newTransaction.balance);
  return newTransaction;
}

export function deductPoints(amount: number, description: string): { success: boolean; transaction?: PointsTransaction } {
  const balance = getPointsBalance();
  if (balance < amount) {
    return { success: false };
  }
  const transaction = addTransaction({
    type: "consume",
    amount: -amount,
    description,
  });
  return { success: true, transaction };
}

export function addPoints(amount: number, description: string, type: PointsTransaction["type"] = "purchase"): PointsTransaction {
  return addTransaction({
    type,
    amount,
    description,
  });
}

export function getServiceCosts(): ServiceCost[] {
  return DEFAULT_SERVICE_COSTS;
}

export function getServiceCostByCategory(category: ServiceCost["category"]): ServiceCost[] {
  return DEFAULT_SERVICE_COSTS.filter((s) => s.category === category);
}

export interface PointsPackage {
  id: string;
  name: string;
  points: number;
  price: number;
  originalPrice?: number;
  bonus?: number;
  tag?: string;
  description: string;
  memberLevel?: "basic" | "pro" | "ultimate";
  weeklyLimit?: number;
  validDays?: number;
  featured?: boolean;
}

export const POINTS_PACKAGES: PointsPackage[] = [
  {
    id: "starter",
    name: "入门包",
    points: 500,
    price: 9.9,
    originalPrice: 15,
    description: "新手推荐",
  },
  {
    id: "basic",
    name: "基础包",
    points: 1500,
    price: 29,
    originalPrice: 45,
    description: "日常使用",
  },
  {
    id: "popular",
    name: "热门包",
    points: 5000,
    price: 99,
    originalPrice: 150,
    bonus: 500,
    tag: "热门",
    description: "最受欢迎",
    featured: true,
  },
  {
    id: "pro",
    name: "专业包",
    points: 12000,
    price: 199,
    originalPrice: 300,
    bonus: 2000,
    description: "专业用户",
  },
  {
    id: "team",
    name: "团队包",
    points: 30000,
    price: 499,
    originalPrice: 600,
    bonus: 5000,
    tag: "推荐",
    description: "团队协作",
  },
  {
    id: "ultimate",
    name: "至尊包",
    points: 80000,
    price: 1299,
    originalPrice: 1500,
    bonus: 20000,
    description: "无限创作",
  },
];
