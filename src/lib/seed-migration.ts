"use client";

/**
 * 示例项目输入端资源迁移（兼容老用户 localStorage 中残留的 /uploads/<uuid>.ext 404 路径）
 *
 * 修复两个问题：
 * 1. workspace-default.json 里示例项目的输入端文件 url/previewUrl/canvas content 曾指向
 *    /uploads/<uuid>.jpeg|.jpg|.png|.doc，但这些 UUID 路径在部署环境不存在（404）。
 * 2. 景德镇项目 ID 曾用时间戳 proj-1787396780970，统一为 proj-default-1，方便 URL 参数切换。
 */

export type MigratedUploadFile = {
  name?: string;
  url?: string;
  previewUrl?: string;
  type?: string;
  [k: string]: unknown;
};

export type MigratedCanvasItem = {
  type?: string;
  content?: string;
  meta?: { name?: string; fileType?: string; [k: string]: unknown };
  [k: string]: unknown;
};

export type MigratedMessage = {
  files?: MigratedUploadFile[];
  [k: string]: unknown;
};

export type MigratedFilesByProject = Record<
  string,
  {
    generated?: MigratedUploadFile[];
    text?: MigratedUploadFile[];
    image?: MigratedUploadFile[];
    canvas?: MigratedCanvasItem[];
    [k: string]: unknown;
  }
>;

export type MigratedConversation = {
  id?: string;
  [k: string]: unknown;
};

export type MigratedProject = {
  id: string;
  name?: string;
  conversations?: MigratedConversation[];
  messagesByConversation?: Record<string, MigratedMessage[]>;
  activeConversationId?: string | null;
  [k: string]: unknown;
};

export type MigratedWorkspacePayload = {
  projects?: MigratedProject[];
  currentProjectId?: string | null;
  filesByProject?: MigratedFilesByProject;
  fileVersions?: Record<string, unknown>;
  [k: string]: unknown;
};

// 文件名 -> 静态 mock 路径映射。优先按 name 精确匹配，避免 UUID 混乱。
// 注意：画布节点 meta.name 可能使用别名（如"草图1"），不是原始文件名 ske-1.jpeg；此处都列出来。
const STATIC_BY_NAME: Record<string, string> = {
  // 建筑（景德镇）
  "景德镇陶瓷文创园设计任务书.doc": "/mock-arch/景德镇陶瓷文创园设计任务书.doc",
  "ske-1.jpeg": "/mock-arch/ske-1.jpeg",
  "ske-2.jpeg": "/mock-arch/ske-2.jpeg",
  "ske-3.jpeg": "/mock-arch/ske-3.jpeg",
  "ske-4.jpeg": "/mock-arch/ske-4.jpeg",
  "草图1": "/mock-arch/ske-1.jpeg",
  "草图2": "/mock-arch/ske-2.jpeg",
  "草图3": "/mock-arch/ske-3.jpeg",
  "草图4": "/mock-arch/ske-4.jpeg",
  // 电商（绿发晶）
  "商品图底图.jpg": "/mock-dianshang/商品图底图.jpg",
  "商品图底图": "/mock-dianshang/商品图底图.jpg",
  "模特.png": "/mock-dianshang/模特.png",
  "模特": "/mock-dianshang/模特.png",
  "img模特.png": "/mock-dianshang/img模特.png",
  // 漫剧（神骨）
  "创意.doc": "/mock-manju/创意.doc",
};

// 兜底：按 uploads UUID（完整文件名）精确映射。
// 即使 meta.name 无法命中（例：画布节点叫"草图1"但 content 是 uploads UUID），也能根据 UUID 定位静态资源。
const STATIC_BY_UPLOADS: Record<string, string> = {
  "/uploads/9b601a61-eb6d-4a28-bc15-42f497f55767.doc": "/mock-arch/景德镇陶瓷文创园设计任务书.doc",
  "/uploads/92066011-79eb-485a-983c-c3906188ab67.jpeg": "/mock-arch/ske-1.jpeg",
  "/uploads/78602b84-f23d-4b3f-94eb-b59ebd6d83f8.jpeg": "/mock-arch/ske-2.jpeg",
  "/uploads/6ded11c9-f19b-4b2a-92ff-7ea0bdeff6e6.jpeg": "/mock-arch/ske-3.jpeg",
  "/uploads/aadc972f-db3e-407e-a7e8-f5560e5f2310.jpeg": "/mock-arch/ske-4.jpeg",
  "/uploads/8c5657d7-3d0d-4c98-b28e-480c397ee4ca.jpg": "/mock-dianshang/商品图底图.jpg",
  "/uploads/0503ac0e-89df-4693-9c05-95ce12947fc4.png": "/mock-dianshang/模特.png",
  "/uploads/7e587c87-0b79-4c8d-9b4f-5a6375fdcc26.doc": "/mock-manju/创意.doc",
};

// 旧项目 ID -> 标准项目 ID 映射
const PROJECT_ID_RENAME: Record<string, string> = {
  "proj-1787396780970": "proj-default-1",
};

const UPLOADS_RE = /^\/uploads\/[a-f0-9-]+\.(jpeg|jpg|png|doc|docx|pdf)$/i;

function looksLikeUploadsPath(p: unknown): p is string {
  return typeof p === "string" && UPLOADS_RE.test(p);
}

function resolveStaticPath(name: string | undefined, fallbackUrl: string | undefined): string | undefined {
  // 1. 按文件名 / 别名匹配（覆盖：sketch 别名、商品图底图、模特 等）
  if (name && STATIC_BY_NAME[name]) return STATIC_BY_NAME[name];
  // 2. 按完整 uploads UUID 路径兜底（画布节点 meta.name = "草图1" 时，只能靠 UUID 定位）
  if (typeof fallbackUrl === "string" && STATIC_BY_UPLOADS[fallbackUrl]) return STATIC_BY_UPLOADS[fallbackUrl];
  return undefined;
}

function migrateFileRefs(f: MigratedUploadFile): MigratedUploadFile {
  if (!f || typeof f !== "object") return f;
  const out: MigratedUploadFile = { ...f };
  const name = typeof f.name === "string" ? f.name : undefined;
  const urlRaw = typeof f.url === "string" ? f.url : undefined;
  const prevRaw = typeof f.previewUrl === "string" ? f.previewUrl : undefined;
  const resolved = resolveStaticPath(name, urlRaw) ?? resolveStaticPath(name, prevRaw);
  if (resolved) {
    if (looksLikeUploadsPath(out.url)) out.url = resolved;
    if (looksLikeUploadsPath(out.previewUrl)) out.previewUrl = resolved;
  }
  // 兜底：如果 url / previewUrl 仍看起来像 uploads UUID，尝试直接查 UUID 表（不依赖 name）
  if (looksLikeUploadsPath(out.url) && STATIC_BY_UPLOADS[out.url]) out.url = STATIC_BY_UPLOADS[out.url];
  if (looksLikeUploadsPath(out.previewUrl) && STATIC_BY_UPLOADS[out.previewUrl]) out.previewUrl = STATIC_BY_UPLOADS[out.previewUrl];
  return out;
}

function migrateCanvasItem(item: MigratedCanvasItem): MigratedCanvasItem {
  if (!item || typeof item !== "object") return item;
  const out: MigratedCanvasItem = { ...item };
  const name =
    (item.meta && typeof item.meta === "object" && typeof (item.meta as { name?: string }).name === "string"
      ? (item.meta as { name?: string }).name
      : undefined);
  let resolved = name ? resolveStaticPath(name, undefined) : undefined;
  if (!resolved && looksLikeUploadsPath(out.content) && STATIC_BY_UPLOADS[out.content]) {
    resolved = STATIC_BY_UPLOADS[out.content];
  }
  if (resolved && looksLikeUploadsPath(out.content)) out.content = resolved;
  return out;
}

function migrateMessagesByConversation(
  mb: Record<string, MigratedMessage[]> | undefined,
): Record<string, MigratedMessage[]> | undefined {
  if (!mb) return mb;
  const out: Record<string, MigratedMessage[]> = {};
  for (const [cid, msgs] of Object.entries(mb)) {
    out[cid] = Array.isArray(msgs)
      ? msgs.map((m) => {
          if (!m || typeof m !== "object") return m;
          if (!Array.isArray(m.files)) return m;
          return { ...m, files: m.files.map(migrateFileRefs) };
        })
      : msgs;
  }
  return out;
}

export function migrateFilesByProject(raw: MigratedFilesByProject | undefined): MigratedFilesByProject | undefined {
  if (!raw || typeof raw !== "object") return raw;
  const out: MigratedFilesByProject = {};
  for (const [pid, val] of Object.entries(raw)) {
    if (!val || typeof val !== "object") {
      out[pid] = val as never;
      continue;
    }
    const newPid = PROJECT_ID_RENAME[pid] ?? pid;
    out[newPid] = {
      ...val,
      generated: Array.isArray(val.generated) ? val.generated.map(migrateFileRefs) : val.generated,
      text: Array.isArray(val.text) ? val.text.map(migrateFileRefs) : val.text,
      image: Array.isArray(val.image) ? val.image.map(migrateFileRefs) : val.image,
      canvas: Array.isArray(val.canvas) ? val.canvas.map(migrateCanvasItem) : val.canvas,
    };
  }
  return out;
}

export function migrateProjects(raw: MigratedProject[] | undefined): MigratedProject[] | undefined {
  if (!Array.isArray(raw)) return raw;
  const seen = new Set<string>();
  const out: MigratedProject[] = [];
  for (const p of raw) {
    if (!p || typeof p !== "object") continue;
    const newId = PROJECT_ID_RENAME[p.id] ?? p.id;
    if (seen.has(newId)) continue;
    seen.add(newId);
    out.push({
      ...p,
      id: newId,
      messagesByConversation: migrateMessagesByConversation(p.messagesByConversation),
    });
  }
  return out;
}

export function migrateWorkspacePayload<T extends MigratedWorkspacePayload>(raw: T | undefined | null): T | null {
  if (!raw || typeof raw !== "object") return raw as T | null;
  const migratedProjects = migrateProjects(raw.projects);
  const migratedFiles = migrateFilesByProject(raw.filesByProject);
  let currentProjectId: string | null | undefined = raw.currentProjectId ?? undefined;
  if (typeof currentProjectId === "string" && PROJECT_ID_RENAME[currentProjectId]) {
    currentProjectId = PROJECT_ID_RENAME[currentProjectId];
  }
  // 若 filesByProject 旧 key 存在而 projects 中已改名，projects 也能对应上（上面同时改名了）
  return {
    ...(raw as object),
    projects: migratedProjects as never,
    filesByProject: migratedFiles as never,
    currentProjectId: currentProjectId as never,
  } as unknown as T;
}
