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
const STATIC_BY_NAME: Record<string, string> = {
  // 建筑（景德镇）
  "景德镇陶瓷文创园设计任务书.doc": "/mock-arch/景德镇陶瓷文创园设计任务书.doc",
  "ske-1.jpeg": "/mock-arch/ske-1.jpeg",
  "ske-2.jpeg": "/mock-arch/ske-2.jpeg",
  "ske-3.jpeg": "/mock-arch/ske-3.jpeg",
  "ske-4.jpeg": "/mock-arch/ske-4.jpeg",
  // 电商（绿发晶）
  "商品图底图.jpg": "/mock-dianshang/商品图底图.jpg",
  "模特.png": "/mock-dianshang/模特.png",
  "img模特.png": "/mock-dianshang/img模特.png",
  // 漫剧（神骨）
  "创意.doc": "/mock-manju/创意.doc",
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
  if (name && STATIC_BY_NAME[name]) return STATIC_BY_NAME[name];
  // 没有命中 name 映射时，按扩展名 + 项目上下文兜底（调用方额外传 hint 时的兼容）
  // 此处保持 undefined，由调用方保留原值
  return undefined;
}

function migrateFileRefs(f: MigratedUploadFile): MigratedUploadFile {
  if (!f || typeof f !== "object") return f;
  const out: MigratedUploadFile = { ...f };
  const name = typeof f.name === "string" ? f.name : undefined;
  const resolved = resolveStaticPath(name, typeof f.url === "string" ? f.url : undefined);
  if (resolved) {
    if (looksLikeUploadsPath(out.url)) out.url = resolved;
    if (looksLikeUploadsPath(out.previewUrl)) out.previewUrl = resolved;
  }
  return out;
}

function migrateCanvasItem(item: MigratedCanvasItem): MigratedCanvasItem {
  if (!item || typeof item !== "object") return item;
  const out: MigratedCanvasItem = { ...item };
  const name =
    (item.meta && typeof item.meta === "object" && typeof (item.meta as { name?: string }).name === "string"
      ? (item.meta as { name?: string }).name
      : undefined);
  const resolved = name ? resolveStaticPath(name, undefined) : undefined;
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
