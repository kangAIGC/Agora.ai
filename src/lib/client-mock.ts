/**
 * 客户端 Mock 模块 - 用于静态导出（GitHub Pages / Cloudflare Pages）
 *
 * 替代所有 /api/* 服务端路由，在浏览器端模拟相同的响应行为：
 * 1. Dify SSE 流式响应（design/image/video/html）- 用 async generator 模拟
 * 2. 文件上传 - 返回 Blob URL 用于本地预览
 * 3. Dify 文件上传 - 返回 mock 的 upload_file_id
 * 4. 工作台状态读写 - 使用 localStorage 持久化
 * 5. doc2pdf - 静态模式下不支持，返回提示
 */

import { asset } from "@/lib/asset";

// ============ 类型定义 ============

export interface MockFile {
  name: string;
  url: string;
  type: "doc" | "image" | "video" | "html";
}

export type MockSSEEvent =
  | { type: "chunk"; content: string }
  | { type: "files"; files: MockFile[] }
  | { type: "content_replace"; content: string }
  | { type: "done" }
  | { type: "error"; message: string };

// ============ 工具函数 ============

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

const randomId = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

// ============ Dify SSE Mock 流 ============

/**
 * AI 设计 Mock - 对应 /api/dify/design
 * 模拟行为：输出文字块 → 输出策划报告文件 → done
 */
export async function* mockDifyDesign(
  _message: string,
  _fileId: string
): AsyncGenerator<MockSSEEvent> {
  const chunks = [
    "正在分析任务书内容...",
    "\n\n基于您的需求，我整理了以下概念方案要点：",
    "\n\n**项目定位**：以陶瓷文化为核心的文创产业园",
    "\n\n**功能分区**：包含展示区、体验区、创作区、配套服务区",
    "\n\n**空间策略**：保留工业遗存肌理，植入现代功能",
  ];

  for (const chunk of chunks) {
    await sleep(400 + Math.random() * 400);
    yield { type: "chunk", content: chunk };
  }

  yield {
    type: "files",
    files: [{ name: "策划报告", url: "/mock/mock-策划报告.doc", type: "doc" }],
  };

  yield {
    type: "chunk",
    content: "\n\n✅ 策划报告已生成，可在右侧「生成文件」区域查看。",
  };

  yield { type: "done" };
}

/**
 * AI 图像 Mock - 对应 /api/dify/image
 * 模拟行为：等待 15 秒 → 输出 4 张 mock 图片 → done
 */
export async function* mockDifyImage(
  _message: string
): AsyncGenerator<MockSSEEvent> {
  await sleep(15000);

  yield {
    type: "files",
    files: [
      { name: "mock-01.png", url: "/mock/mock-01.png", type: "image" },
      { name: "mock-02.png", url: "/mock/mock-02.png", type: "image" },
      { name: "mock-03.png", url: "/mock/mock-03.png", type: "image" },
      { name: "mock-04.png", url: "/mock/mock-04.png", type: "image" },
    ],
  };

  yield { type: "done" };
}

/**
 * AI 视频 Mock - 对应 /api/dify/video
 * 模拟行为：等待 20 秒 → 输出 4 个 mock 视频 → done
 */
export async function* mockDifyVideo(
  _message: string
): AsyncGenerator<MockSSEEvent> {
  await sleep(20000);

  yield {
    type: "files",
    files: [
      { name: "mock-v1.mp4", url: "/mock/mock-v1.mp4", type: "video" },
      { name: "mock-v2.mp4", url: "/mock/mock-v2.mp4", type: "video" },
      { name: "mock-v3.mp4", url: "/mock/mock-v3.mp4", type: "video" },
      { name: "mock-v4.mp4", url: "/mock/mock-v4.mp4", type: "video" },
    ],
  };

  yield { type: "done" };
}

/**
 * AI 网页 Mock - 对应 /api/dify/html
 * 模拟行为：等待 20 秒 → 输出 mock HTML → done
 */
export async function* mockDifyHtml(
  _message: string
): AsyncGenerator<MockSSEEvent> {
  await sleep(20000);

  yield {
    type: "files",
    files: [
      {
        name: "概念方案汇报文件",
        url: "/mock/mock-html.html",
        type: "html",
      },
    ],
  };

  yield { type: "done" };
}

/**
 * 根据 mode 选择对应的 mock 流
 */
export function getMockStream(
  mode: "design" | "image" | "video" | "html",
  params: { message: string; fileId?: string }
): AsyncGenerator<MockSSEEvent> {
  switch (mode) {
    case "design":
      return mockDifyDesign(params.message, params.fileId || "");
    case "image":
      return mockDifyImage(params.message);
    case "video":
      return mockDifyVideo(params.message);
    case "html":
      return mockDifyHtml(params.message);
  }
}

// ============ 文件上传 Mock ============

/**
 * 文件上传 Mock - 对应 /api/upload
 * 静态模式下无法写入服务端磁盘，使用 Blob URL 实现本地预览
 * doc/docx 不再生成 PDF（静态模式无 Word COM）
 */
export async function mockUploadFile(
  file: File
): Promise<{ url: string; filename: string }> {
  // 使用 Blob URL 实现本地预览
  const blobUrl = URL.createObjectURL(file);
  const ext = file.name.split(".").pop() || "bin";
  const filename = `${randomId()}.${ext}`;
  return { url: blobUrl, filename };
}

/**
 * Dify 文件上传 Mock - 对应 /api/dify/upload
 * 返回模拟的 upload_file_id
 */
export async function mockDifyUpload(
  _file: File
): Promise<{ upload_file_id: string; name: string }> {
  // 模拟网络延迟
  await sleep(500 + Math.random() * 500);
  return {
    upload_file_id: `mock-${randomId()}`,
    name: _file.name,
  };
}

// ============ doc2pdf Mock ============

/**
 * doc2pdf Mock - 对应 /api/doc2pdf
 * 静态模式下无法调用 Word COM，返回 null 表示 PDF 预览不可用
 * 调用方应判断返回值并提示用户
 */
export async function mockDoc2Pdf(
  _file: File
): Promise<{ available: false; reason: string }> {
  return {
    available: false,
    reason: "静态托管模式下不支持自动 PDF 转换，请使用本地 Word 打开预览",
  };
}

// ============ 工作台状态 Mock ============

const WORKSPACE_STATE_KEY = "aga-workspace-state";

interface WorkspaceStatePayload {
  projects: unknown;
  currentProjectId: string | null;
  filesByProject: unknown;
  fileVersions?: Record<string, unknown>;
  savedAt?: string;
}

/**
 * 读取工作台状态 - 对应 GET /api/workspace/state
 * 静态模式下从 localStorage 读取
 * 如果 localStorage 无数据，则尝试 fetch 静态种子文件
 */
export async function mockGetWorkspaceState(): Promise<{
  source: "server" | "seed" | "empty";
  data: unknown | null;
}> {
  // 1. 优先从 localStorage 读取用户最近保存的状态
  try {
    const stored = localStorage.getItem(WORKSPACE_STATE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as WorkspaceStatePayload;
      if (parsed && parsed.projects) {
        return { source: "server", data: parsed };
      }
    }
  } catch {
    /* ignore */
  }

  // 2. 尝试加载静态种子文件
  try {
    const res = await fetch(asset("/workspace-default.json"), { cache: "no-store" });
    if (res.ok) {
      const seed = await res.json();
      return { source: "seed", data: seed };
    }
  } catch {
    /* ignore */
  }

  // 3. 无任何状态
  return { source: "empty", data: null };
}

/**
 * 保存工作台状态 - 对应 POST /api/workspace/state
 * 静态模式下写入 localStorage
 */
export async function mockSaveWorkspaceState(
  data: WorkspaceStatePayload
): Promise<{ ok: true; savedAt: string; size: number }> {
  const payload: WorkspaceStatePayload = {
    projects: data.projects,
    currentProjectId: data.currentProjectId || null,
    filesByProject: data.filesByProject,
    fileVersions: data.fileVersions || {},
    savedAt: new Date().toISOString(),
  };
  const json = JSON.stringify(payload);
  try {
    localStorage.setItem(WORKSPACE_STATE_KEY, json);
  } catch (e) {
    // localStorage 配额超限时尝试清理旧数据后重试
    console.warn("[mockSaveWorkspaceState] localStorage 写入失败:", e);
    throw new Error("浏览器存储空间不足，请清理后重试");
  }
  return {
    ok: true,
    savedAt: payload.savedAt!,
    size: json.length,
  };
}
