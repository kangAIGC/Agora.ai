# AGENTS.md - ArchDesign.ai

## 项目概览
ArchDesign.ai 是一个 AI 嵌入式建筑方案智能体平台，提供从概念方案策划、效果图渲染、视频生成到汇报 PPT 制作的一站式 AI 生成服务。

### 技术栈
- **Framework**: Next.js 16 (App Router)
- **Core**: React 19
- **Language**: TypeScript 5
- **UI**: shadcn/ui (Radix UI)
- **Styling**: Tailwind CSS 4

## 目录结构
```
src/
├── app/
│   ├── page.tsx              # 首页 - 四大模块入口
│   ├── layout.tsx            # 根布局 (Header + ProjectProvider)
│   ├── globals.css           # 全局样式
│   ├── design/page.tsx       # AI DESIGN 页面
│   ├── render/page.tsx       # AI RENDER 页面
│   ├── video/page.tsx        # AI VIDEO 页面
│   ├── ppt/page.tsx          # AI PPT 页面
│   ├── material/page.tsx     # 素材库页面
│   ├── profile/page.tsx      # 个人中心页面
│   ├── membership/page.tsx   # 会员充值页面
│   └── api/
│       ├── upload/route.ts   # 文件上传 API
│       ├── design/route.ts   # Dify API 集成 (概念方案生成)
│       ├── render/route.ts   # ComfyUI API 集成 (效果图渲染)
│       ├── video/route.ts    # Seedance API 集成 (视频生成)
│       └── ppt/route.ts      # 千问 API 集成 (PPT生成)
├── components/
│   ├── Header.tsx            # 全局导航头
│   └── ui/                   # shadcn/ui 组件库
├── lib/
│   ├── project-store.tsx     # 全局状态管理 (React Context)
│   └── utils.ts              # 工具函数
└── hooks/
    └── use-mobile.ts         # 响应式 Hook
```

## 构建和测试命令
```bash
pnpm install          # 安装依赖
pnpm dev              # 开发环境 (HMR)
pnpm build            # 生产构建
pnpm start            # 生产启动
pnpm ts-check         # TypeScript 类型检查
pnpm lint --quiet     # ESLint 检查
```

## 页面路由
| 路径 | 页面 | 说明 |
|------|------|------|
| `/` | 首页 | 四大模块卡片入口 |
| `/design` | AI DESIGN | 上传 docx → 调用 Dify → 生成3套概念方案 |
| `/render` | AI RENDER | 上传草图 → 调用 ComfyUI → 生成效果图 |
| `/video` | AI VIDEO | 选择效果图 → 调用 Seedance → 生成视频 |
| `/ppt` | AI PPT | 自动导入前阶段素材 → 调用千问 → 生成PPT |
| `/material` | 素材库 | 管理生成的素材 |
| `/profile` | 个人中心 | 账户信息 |
| `/membership` | 会员充值 | 订阅方案 |

## API 接口
| 端点 | 方法 | 功能 | 外部服务 |
|------|------|------|----------|
| `/api/upload` | POST | 文件上传 | 本地存储 |
| `/api/design` | POST | 生成概念方案 | Dify |
| `/api/render` | POST | 生成效果图 | ComfyUI |
| `/api/video` | POST | 生成视频 | Seedance |
| `/api/ppt` | POST | 生成PPT | 千问(Qwen) |

## 环境变量配置
| 变量名 | 说明 | 示例 |
|--------|------|------|
| `DIFY_API_URL` | Dify 服务地址 | `https://api.dify.ai` |
| `DIFY_API_KEY` | Dify API 密钥 | `app-xxx` |
| `COMFYUI_API_URL` | ComfyUI 服务地址 | `http://localhost:8188` |
| `SEEDANCE_API_URL` | Seedance 服务地址 | `https://api.seedance.com` |
| `SEEDANCE_API_KEY` | Seedance API 密钥 | `sk-xxx` |
| `QWEN_API_URL` | 千问 API 地址 | `https://dashscope.aliyuncs.com` |
| `QWEN_API_KEY` | 千问 API 密钥 | `sk-xxx` |

所有 API 在未配置环境变量时会返回模拟数据，确保前端可正常预览。

## 状态管理
使用 React Context (`ProjectProvider`) 在页面间共享数据：
- `designSchemes`: 概念方案列表
- `renderImages`: 效果图列表
- `videos`: 视频列表
- `uploadedDoc`: 上传的任务书
- `uploadedSketch`: 上传的草图

## 设计规范
详见 `DESIGN.md`。核心要点：
- 白色背景 + 蓝色渐变按钮
- ArchDesign(黑色) .ai(蓝色) 品牌标识
- 卡片圆角 16px，按钮胶囊形
- 点击左上角 ArchDesign.ai 回到首页

## 代码规范
- 仅使用 pnpm 管理依赖
- TypeScript strict 模式
- 禁止隐式 any
- 客户端组件使用 "use client" 指令
- 动态数据使用 useEffect + useState 避免 Hydration 错误
