# ArchDesign.ai 本地部署指南

> AGA - 通用 AIGC 一站式内容交付平台（建筑 / 电商 / 漫剧 三域工作流）

---

## 一、环境要求

| 组件 | 最低版本 | 推荐版本 | 说明 |
|------|----------|----------|------|
| **Node.js** | 20.x LTS | 20.x / 22.x LTS | 必须支持 ES Modules |
| **pnpm** | ≥ 9.0.0 | 最新版 | 本项目强制使用 pnpm（`only-allow pnpm`） |
| **操作系统** | Windows 10+ / macOS 12+ / Ubuntu 20.04+ | — | Windows 建议使用 PowerShell 7+，并安装 Git Bash |
| **内存** | 4 GB | 8 GB+ | 构建 Next.js 时需要较大内存 |
| **磁盘** | 5 GB | 10 GB+ | 包含 node_modules 与构建产物 |

### 1.1 安装 pnpm（如未安装）

```bash
# 使用 npm 全局安装
npm install -g pnpm@9

# 或使用 corepack（Node.js 16.10+ 自带）
corepack enable
corepack prepare pnpm@9.0.0 --activate

# 验证
pnpm --version
```

### 1.2 Windows 特别提示

本项目的构建脚本（`scripts/*.sh`）使用 **bash** 编写。Windows 用户需要有 bash 环境：

- **方式 A（推荐）**：安装 [Git for Windows](https://git-scm.com/download/win)，安装时勾选 *"Git Bash Here"* 和 *"Use Git from the Windows Command Prompt"*
- **方式 B**：启用 WSL（Windows Subsystem for Linux）
- **方式 C**：直接使用本仓库提供的 PowerShell 脚本（见下文 `start.ps1` / `build.ps1`），无需 Git Bash

---

## 二、目录结构

```
project1/
├── src/                      # 源代码
│   ├── app/                  # Next.js App Router（页面 / API）
│   ├── components/           # React 组件（InfiniteCanvas、WorkCard 等）
│   ├── lib/                  # 工具库、状态管理
│   ├── hooks/                # 自定义 Hooks
│   └── server.ts             # HTTP 服务器入口（自定义 Next 服务器）
├── public/                   # 静态资源
│   ├── mock-arch/            # 建筑域 Mock 素材（草图 / 效果图 / 视频 / HTML）
│   ├── mock-dianshang/       # 电商域 Mock 素材
│   ├── mock-manju/           # 漫剧域 Mock 素材
│   └── uploads/              # 上传文件缓存
├── scripts/                  # 部署脚本（bash）
│   ├── dev.sh                # 开发模式
│   ├── build.sh              # 依赖安装 + Next 构建 + server 打包
│   ├── start.sh              # 生产模式（读取 dist/server.js）
│   └── prepare.sh            # 仅安装依赖
├── build.ps1                 # Windows 一键构建脚本（无需 bash）
├── start.ps1                 # Windows 一键启动脚本
├── DEPLOY.md                 # 本文件
├── package.json
├── pnpm-lock.yaml
├── tsconfig.json
└── next.config.ts
```

---

## 三、方式一：生产模式部署（推荐）

生产模式会预构建所有页面，启动速度快、运行稳定。

### 3.1 首次部署（全流程）

#### 步骤 1：安装依赖

```bash
cd <项目根目录>
pnpm install
```

若 pnpm install 报错，请参考 [常见问题 Q1](#q1-pnpm-install-失败)。

#### 步骤 2：执行构建

**Windows（PowerShell，推荐）：**

```powershell
# 进入项目目录后执行
.\build.ps1
```

**Linux / macOS / Git Bash：**

```bash
pnpm run build
```

构建过程：
1. 安装依赖（若未安装）
2. `next build` 预渲染所有页面 → `.next/`
3. `tsup src/server.ts` 打包自定义服务器 → `dist/server.js`

构建成功后应看到：
```
Build completed successfully!
```

#### 步骤 3：启动服务

**Windows（PowerShell）：**

```powershell
.\start.ps1
# 可指定端口： .\start.ps1 -Port 8080
```

**Linux / macOS / Git Bash：**

```bash
pnpm run start
# 或指定端口： DEPLOY_RUN_PORT=8080 pnpm run start
```

启动成功后控制台输出：
```
Starting HTTP service on port 5000 for deploy...
> Server listening at http://localhost:5000 as PROD
```

#### 步骤 4：浏览器访问

打开浏览器访问：**http://localhost:5000**

页面导航：
| 路径 | 页面 |
|------|------|
| `/` | 首页 |
| `/chat` | **工作台（核心画布工作流）** |
| `/discover` | 社区 |
| `/profile` | 个人中心 |
| `/membership` | 会员充值 |

---

## 四、方式二：开发模式（带热更新）

适合修改代码、调试场景。

```bash
# Windows PowerShell 也可以直接调用：
pnpm run dev

# 或指定端口：
#   bash:   DEPLOY_RUN_PORT=8080 pnpm run dev
#   PowerShell:  $env:DEPLOY_RUN_PORT=8080; pnpm run dev
```

控制台输出：
```
Clearing port 5000 before start.
Port 5000 is free.
Starting HTTP service on port 5000 for dev...
> Server listening at http://localhost:5000 as development
```

访问：**http://localhost:5000**

> 开发模式修改 `src/**` 下的文件会自动热更新（HMR），无需重启。

---

## 五、项目演示工作流（建议按顺序体验）

### 5.1 《神骨》漫剧 项目

1. 打开 `/chat` → 左侧点击 **《神骨》漫剧** 项目
2. **AI 设计**：发送"生成prompt" → 生成 创意.doc → 剧本.doc
3. **AI 图像**：发送"生成prompt" → 生成 人物/场景/道具.doc（三列垂直排列）
   再发送"生成图像" → 9 张图片按 3×3 网格展示
   - 第 1 行：苏挽 → 萧珩 → 玄青上人（人物）
   - 第 2 行：诛仙台 → 青云大殿 → 灭门旧夜（场景）
   - 第 3 行：墨玉牌 → 墨断剑红绳 → 半块碎玉（物品）
4. **AI 视频**：发送"生成prompt" → 分镜稿.doc → 再发送"生成视频" → 视频0-30s.mp4
5. **AI 网页**：自动填充"生成网页" → 发送 → html.html（画布中 iframe 实时预览）
6. 鼠标悬停在左侧项目名「《神骨》漫剧」上 → 点击左侧的 💾 保存按钮 → 导出工作流 JSON

### 5.2 景德镇陶瓷文创园 项目

1. 点击项目 → **AI 设计** → 生成 任务书 → 策划报告 → 参考图prompt
2. **AI 图像**：上传 ske-1~4.jpeg 4 张草图 → 发送 → 生成 mock-01~04 效果图（4 张单列垂直排布）
3. **AI 视频**：自动填充"生成视频" → 发送 → 生成 mock-v1~v4 4 个视频
4. **AI 网页**：自动填充"生成网页" → 发送 → 生成「流水为脉 · 坊巷成园.html」（关联 4 个视频）

### 5.3 绿发晶白水晶拼色树叶吊坠手链 项目

1. 上传 商品图底图.jpg + 模特.png → **AI 设计** 生成 商品简介 → 图片prompt
2. **AI 图像** 发送 → 生成 img1~img4 效果图（与模特图成列）
3. **AI 视频** → 视频prompt → 1.mp4
4. **AI 网页** → 绿发晶白水晶拼色树叶吊坠手链.html

---

## 六、Mock 资源与离线能力

本项目所有外部 AI 服务（Dify / ComfyUI / Seedance / 千问）在**未配置环境变量**时自动回退到本地 Mock 数据，确保离线可用。

Mock 资源目录：
```
public/
├── mock-arch/       # 建筑域
│   ├── ske-1.jpeg ~ ske-4.jpeg        # 4 张草图
│   ├── mock-01.png ~ mock-04.png      # 4 张效果图
│   ├── mock-v1.mp4 ~ mock-v4.mp4      # 4 段视频
│   └── 流水为脉 · 坊巷成园.html        # 生成的展示网页
├── mock-dianshang/  # 电商域
│   ├── img1~4.png   模特.png  商品图底图.jpg
│   ├── 1.mp4 / video1~4.mp4
│   └── 绿发晶白水晶拼色树叶吊坠手链.html
└── mock-manju/      # 漫剧域
    ├── 人物/场景/道具/剧本/分镜稿/创意.doc
    ├── 苏挽/萧珩/玄青上人.png  诛仙台/青云大殿/灭门旧夜.png  墨玉牌/墨断剑红绳/半块碎玉.png
    ├── 视频0-30s.mp4
    └── html.html
```

如需接入真实 AI 服务，复制 `.env.example` → `.env.local`，填入对应 API Key（可选操作）。

---

## 七、常见问题 FAQ

### Q1. `pnpm install` 失败

**报错：`ERR_PNPM_PREINSTALL_HOOK_FAILED` / `Only pnpm is allowed`**
- 原因：本项目 `package.json` 设置了 `"preinstall": "npx only-allow pnpm"`，禁止 npm / yarn
- 解决：严格使用 pnpm
  ```bash
  pnpm install
  ```

**报错：`ETIMEDOUT` 网络超时**
- 切换国内源：
  ```bash
  pnpm config set registry https://registry.npmmirror.com
  pnpm install
  ```

### Q2. Windows 运行 `pnpm run build` 报错 `bash: command not found`

- 原因：本项目默认脚本是 bash（`scripts/*.sh`）
- 解决 A：安装 Git Bash（并添加到 PATH）
- 解决 B（推荐）：直接使用 PowerShell 脚本
  ```powershell
  .\build.ps1
  .\start.ps1
  ```

### Q3. 端口 5000 被占用

**报错：`Port 5000 in use by PIDs: xxx`** 或启动无响应

- 手动清理端口（Windows PowerShell）：
  ```powershell
  # 查找占用 5000 的进程
  netstat -ano | findstr :5000
  # 结束对应 PID（假设为 12345）
  taskkill /F /PID 12345
  ```
- 或改用其他端口：
  ```powershell
  # 生产模式：
  .\start.ps1 -Port 8080
  # 开发模式：
  $env:DEPLOY_RUN_PORT=8080; pnpm run dev
  ```

### Q4. 构建后页面 404 / 500

1. 确认 `.next/` 与 `dist/server.js` 是否存在（若不存在，重新 `.\build.ps1`）
2. 确认工作目录在项目根目录（`start.ps1` 会自动切换）
3. 检查控制台是否有 `NODE_ENV` 相关错误；若在开发模式，确保使用 `pnpm run dev` 而非 `pnpm run start`

### Q5. 画布中图片 / 视频 / 文档 404（资源路径错误）

本项目所有资源均为相对路径，由 Next 内置静态服务器托管 `public/` 目录。
- 检查 `public/` 下对应目录是否有文件（如 `mock-manju/苏挽.png`）
- 若文件缺失，可从备份还原或直接用任意图片/视频重命名占位
- 浏览器开发者工具 → Network 面板，查看 404 的具体 URL，核对 `public/` 下对应路径

### Q6. 工作流保存后，刷新页面数据丢失

工作流数据存在浏览器 `localStorage`（键：`aga-projects` / `aga-files-by-project` 等），**不会跨设备同步**。
- 保存工作流：悬停左侧项目名 → 点击 💾 按钮，下载 JSON 备份
- 导入恢复：侧边栏 数据管理 → 导入恢复

### Q7. TypeScript / ESLint 报错但页面能跑

若仅要部署运行，类型检查失败不影响构建产物。可跳过校验直接运行：
```bash
pnpm next build
```

若要修复类型错误，执行 `pnpm ts-check` 查看错误列表，按行修复。

### Q8. Windows 下 PowerShell 执行策略禁止脚本

```
无法加载文件 ...build.ps1，因为在此系统上禁止运行脚本。
```

解决（**临时**，仅对当前 PowerShell 窗口有效）：
```powershell
Set-ExecutionPolicy -Scope Process Bypass -Force
.\build.ps1
```

若要永久解除（管理员 PowerShell）：
```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned -Force
```

---

## 八、一键部署摘要（3 条命令跑起来）

### Windows PowerShell（最快）

```powershell
cd "D:\AI PROJECT\project1：AGA\project1"
Set-ExecutionPolicy -Scope Process Bypass -Force    # 首次运行若报策略错误则执行
pnpm install
.\build.ps1
.\start.ps1
```
打开浏览器：**http://localhost:5000**

### Linux / macOS / Git Bash

```bash
cd <项目根目录>
pnpm install
pnpm run build
pnpm run start
```
打开浏览器：**http://localhost:5000**

---

## 九、验证清单

部署完成后可按以下清单自检：

- [ ] 首页 `/` 正常加载，Logo「AGA」可见
- [ ] 工作台 `/chat` 左侧项目列表显示 3 个默认项目
- [ ] 进入项目后画布可见 创意.doc / 剧本.doc 等节点，可拖动
- [ ] 点击 AI 设计 → 发送「生成prompt」→ 生成对应文档并出现在画布上
- [ ] AI 图像生成后图片显示正确（漫剧为 3×3 网格、景德镇为 4 行单列）
- [ ] AI 视频生成后视频节点可播放
- [ ] AI 网页节点在画布中 iframe 内嵌预览
- [ ] 悬停左侧项目名 → 出现保存按钮，点击后能下载 JSON
- [ ] 所有按钮 / 对话框 / Toast 提示正常响应
- [ ] 端口访问无 404 / 500（静态资源 200/304）

如遇清单外问题，优先检查浏览器控制台（F12）与 Node 进程控制台错误日志，并参考 FAQ。
