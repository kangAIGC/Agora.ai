"use client";

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";
import type { Message, Conversation } from "./types";
import { migrateWorkspacePayload, type MigratedProject, type MigratedFilesByProject } from "./seed-migration";

export interface DesignScheme {
  id: string;
  name: string;
  projectAnalysis: string;
  caseAnalysis: string;
  swotAnalysis: string;
  renderPrompt: string;
}

export interface RenderImage {
  id: string;
  url: string;
  schemeId?: string;
}

export interface VideoItem {
  id: string;
  coverUrl: string;
  videoUrl?: string;
  duration: string;
  ratio: string;
}

export interface PPTSlide {
  id: string;
  title: string;
  imageUrl: string;
}

export interface Project {
  id: string;
  name: string;
  conversations: Conversation[];
  messagesByConversation: Record<string, Message[]>;
  activeConversationId: string;
  createdAt: Date;
  pinned?: boolean;
}

interface ProjectState {
  projects: Project[];
  currentProjectId: string | null;
  currentProject: Project | null;
  designSchemes: DesignScheme[];
  renderImages: RenderImage[];
  videos: VideoItem[];
  pptSlides: PPTSlide[];
  uploadedDoc: { name: string; url: string } | null;
  uploadedSketch: { name: string; url: string } | null;
  setDesignSchemes: (schemes: DesignScheme[]) => void;
  setRenderImages: (images: RenderImage[]) => void;
  setVideos: (videos: VideoItem[]) => void;
  setPPTSlides: (slides: PPTSlide[]) => void;
  setUploadedDoc: (doc: { name: string; url: string } | null) => void;
  setUploadedSketch: (sketch: { name: string; url: string } | null) => void;
  createProject: (name: string) => Project;
  switchProject: (projectId: string) => void;
  renameProject: (projectId: string, name: string) => void;
  deleteProject: (projectId: string) => void;
  addConversation: (projectId: string, title?: string) => void;
  switchConversation: (projectId: string, conversationId: string) => void;
  deleteConversation: (projectId: string, conversationId: string) => void;
  setMessages: (projectId: string, conversationId: string, messages: Message[]) => void;
  resetAll: () => void;
  exportData: () => string;
  importData: (json: string) => boolean;
  listProjectSnapshots: () => string[];
  restoreProjectSnapshot: (snapKey: string) => boolean;
  getStorageInfo: () => { projectsCount: number; currentProjectId: string | null; storageAvailable: boolean };
  /** 手动将当前 projects + currentProjectId 同步到服务端，用于跨浏览器/设备持久化 */
  syncToServer: () => Promise<{ ok: boolean; error?: string }>;
}

const ProjectContext = createContext<ProjectState | null>(null);

const createDefaultProject = (): Project => ({
  id: "proj-default-1",
  name: "景德镇陶瓷文创园",
  conversations: [{ id: "conv-1", title: "新对话", timestamp: new Date(0) }],
  messagesByConversation: {
    "conv-1": [
      {
        id: "welcome",
        role: "assistant",
        content: "您好，我是 Agora Agent，您的AIGC设计助手，请告诉我您的实际需求。",
        timestamp: new Date(0),
      },
    ],
  },
  activeConversationId: "conv-1",
  createdAt: new Date(0),
});

// 创建带指定名称的默认项目（用于初始多个项目）
const createNamedProject = (name: string, idSuffix: string): Project => ({
  id: `proj-${idSuffix}`,
  name,
  conversations: [{ id: "conv-1", title: "新对话", timestamp: new Date(0) }],
  messagesByConversation: {
    "conv-1": [
      {
        id: "welcome",
        role: "assistant",
        content: "您好，我是 Agora Agent，您的AIGC设计助手，请告诉我您的实际需求。",
        timestamp: new Date(0),
      },
    ],
  },
  activeConversationId: "conv-1",
  createdAt: new Date(0),
});

// 创建固定的空白项目（始终可见、不可删除）
const PINNED_PROJECT_ID = "proj-pinned-blank";
const createPinnedProject = (): Project => ({
  id: PINNED_PROJECT_ID,
  name: "空白项目",
  conversations: [{ id: "conv-1", title: "新对话", timestamp: new Date(0) }],
  messagesByConversation: {
    "conv-1": [
      {
        id: "welcome-pinned",
        role: "assistant",
        content: "这是一个固定的空白项目，您可以在此自由创建画布工作流。",
        timestamp: new Date(0),
      },
    ],
  },
  activeConversationId: "conv-1",
  createdAt: new Date(0),
  pinned: true,
});

const STORAGE_KEY_PROJECTS = "aga-projects-data";
const STORAGE_KEY_CURRENT = "aga-current-project";
const STORAGE_KEY_SNAPSHOTS = "aga-projects-snapshots";
const MAX_SNAPSHOTS = 8;

// 序列化：将 Date 对象转为 ISO 字符串
function serializeProjects(projects: Project[]) {
  return JSON.stringify(projects, (key, value) => {
    if (value instanceof Date) return value.toISOString();
    return value;
  });
}

// 反序列化：将 ISO 字符串转回 Date
function deserializeProjects(json: string): Project[] {
  return JSON.parse(json, (key, value) => {
    if (typeof value === "string" && key === "timestamp" || key === "createdAt") {
      const parsed = new Date(value);
      if (!isNaN(parsed.getTime())) return parsed;
    }
    return value;
  });
}

/**
 * 同步写入 projects 到 localStorage（消除 useEffect 调度窗口，防止 HMR/刷新丢失）
 * 同时保留最近 N 个带时间戳的快照版本，便于用户恢复历史对话
 */
function persistProjectsSync(nextProjects: Project[]) {
  if (typeof window === "undefined") return;
  try {
    const serialized = serializeProjects(nextProjects);
    localStorage.setItem(STORAGE_KEY_PROJECTS, serialized);

    // 写入时间戳快照（保留最近 MAX_SNAPSHOTS 个）
    try {
      const ts = new Date().toISOString().replace(/[:.]/g, "-");
      const snapKey = `${STORAGE_KEY_SNAPSHOTS}-${ts}`;
      localStorage.setItem(snapKey, serialized);

      // 清理旧快照，只留最近 MAX_SNAPSHOTS 个
      const keys: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(STORAGE_KEY_SNAPSHOTS + "-")) keys.push(k);
      }
      keys.sort().reverse();
      keys.slice(MAX_SNAPSHOTS).forEach((oldKey) => {
        try { localStorage.removeItem(oldKey); } catch { /* ignore */ }
      });
    } catch {
      /* 快照失败不阻塞主流程 */
    }
  } catch {
    /* localStorage 满了就跳过主存储写入 */
  }
}

/** 列出所有可用的 projects 快照 key（最新在前） */
export function listProjectSnapshots(): string[] {
  if (typeof window === "undefined") return [];
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith(STORAGE_KEY_SNAPSHOTS + "-")) keys.push(k);
  }
  return keys.sort().reverse();
}

/** 根据快照 key 恢复 projects（成功返回 true）；不自动覆盖，返回反序列化后的数组供上层选择 */
export function loadProjectSnapshot(snapKey: string): Project[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(snapKey);
    if (!raw) return null;
    return deserializeProjects(raw);
  } catch {
    return null;
  }
}

/** 用快照直接回滚 projects（用于恢复入口） */
export function restoreProjectSnapshot(snapKey: string): boolean {
  const snap = loadProjectSnapshot(snapKey);
  if (!snap) return false;
  persistProjectsSync(snap);
  return true;
}

export function ProjectProvider({ children }: { children: ReactNode }) {
  const [projects, setProjects] = useState<Project[]>(() => {
    // ⚠️ 修复 hydration 不匹配：SSR/CSR 初始值必须完全一致
    // 不在初始化阶段读取 localStorage，统一使用默认项目
    // 客户端挂载后在 useEffect 中从 localStorage 恢复真实数据
    const defaults = [
      createDefaultProject(),
      createNamedProject("绿发晶白水晶拼色树叶吊坠手链", "default-2"),
      createNamedProject("《神骨》漫剧", "default-3"),
    ];
    return [...defaults, createPinnedProject()];
  });
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  // 标记是否已从服务端同步过初始状态（避免重复请求）
  const [serverSynced, setServerSynced] = useState(false);

  // 客户端挂载后从 localStorage 恢复项目数据
  // ⚠️ 修复 hydration 不匹配：不在 useState 初始化时读 localStorage，改在此处恢复
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_PROJECTS);
      if (stored) {
        const parsed = deserializeProjects(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // 确保固定项目始终存在
          if (!parsed.some((p) => p.pinned)) {
            parsed.push(createPinnedProject());
          }
          setProjects(parsed);
        }
      }
    } catch { /* ignore */ }
  }, []);

  // 客户端挂载后从 localStorage 恢复项目ID
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY_CURRENT);
    if (stored && projects.some((p) => p.id === stored)) {
      setCurrentProjectId(stored);
    } else if (projects.length > 0) {
      // 首次加载或存储的项目ID无效时，使用第一个项目
      setCurrentProjectId(projects[0].id);
      localStorage.setItem(STORAGE_KEY_CURRENT, projects[0].id);
    }
  }, [projects]);

  /**
   * 客户端挂载后从服务端 GET /api/workspace/state 加载默认状态
   * 优先级：服务端最新状态 > localStorage > 内置默认项目
   * 用于跨浏览器/设备同步：新浏览器/设备首次访问时，自动获取完整工作台状态
   */
  useEffect(() => {
    if (serverSynced) return;
    let cancelled = false;
    (async () => {
      try {
        // 静态模式：使用客户端 mock 替代服务端状态读取
        const { mockGetWorkspaceState } = await import("@/lib/client-mock");
        const json = await mockGetWorkspaceState();
        if (cancelled || !json || !json.data) return;
        const data = (migrateWorkspacePayload(json.data as never) ?? json.data) as {
          projects?: MigratedProject[];
          currentProjectId?: string | null;
          filesByProject?: MigratedFilesByProject;
          fileVersions?: Record<string, unknown>;
        };
        // 1. 还原 projects（含对话历史 messagesByConversation）
        if (Array.isArray(data.projects) && data.projects.length > 0) {
          const restored = deserializeProjects(JSON.stringify(data.projects));
          // 确保固定项目存在
          if (!restored.some((p) => p.pinned)) restored.push(createPinnedProject());
          setProjects(restored);
          // 同步刷入 localStorage，使后续读取一致
          persistProjectsSync(restored);
        }
        // 2. 还原 currentProjectId
        if (typeof data.currentProjectId === "string" && data.currentProjectId) {
          localStorage.setItem(STORAGE_KEY_CURRENT, data.currentProjectId);
          setCurrentProjectId(data.currentProjectId);
        }
        // 3. 还原 filesByProject + 版本号 → 通过自定义事件通知 chat 页面
        if (data.filesByProject && typeof data.filesByProject === "object") {
          localStorage.setItem("aga-files-by-project", JSON.stringify(data.filesByProject));
          if (data.fileVersions && typeof data.fileVersions === "object") {
            for (const [k, v] of Object.entries(data.fileVersions)) {
              try {
                localStorage.setItem(k, typeof v === "string" ? v : JSON.stringify(v));
              } catch { /* ignore */ }
            }
          }
          // 触发自定义事件，通知 chat/page.tsx 重新加载 filesByProject
          window.dispatchEvent(new CustomEvent("aga-workspace-restored"));
        }
        setServerSynced(true);
      } catch {
        /* 网络失败静默 fallback 到 localStorage */
      }
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverSynced]);

  // 项目变化时持久化（兜底：针对其他路径调用 setProjects 未显式同步的情形）
  useEffect(() => {
    persistProjectsSync(projects);
  }, [projects]);

  const currentProject = projects.find((p) => p.id === currentProjectId) || projects[0] || null;

  const [designSchemes, setDesignSchemes] = useState<DesignScheme[]>([]);
  const [renderImages, setRenderImages] = useState<RenderImage[]>([]);
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [pptSlides, setPPTSlides] = useState<PPTSlide[]>([]);
  const [uploadedDoc, setUploadedDoc] = useState<{ name: string; url: string } | null>(null);
  const [uploadedSketch, setUploadedSketch] = useState<{ name: string; url: string } | null>(null);

  const createProject = useCallback((name: string): Project => {
    const timestamp = Date.now();
    const newProject: Project = {
      id: `proj-${timestamp}-${Math.random().toString(36).slice(2)}`,
      name,
      conversations: [{ id: `conv-${timestamp}`, title: "新对话", timestamp: new Date() }],
      messagesByConversation: {},
      activeConversationId: "",
      createdAt: new Date(),
    };
    newProject.activeConversationId = newProject.conversations[0].id;
    newProject.messagesByConversation[newProject.activeConversationId] = [
      {
        id: `welcome-${newProject.id}`,
        role: "assistant",
        content: "您好，我是 Agora Agent，您的AIGC设计助手，请告诉我您的实际需求。",
        timestamp: new Date(),
      },
    ];
    // 立即更新状态
    setProjects((prev) => {
      const next = [...prev, newProject];
      // 同步保存到 localStorage（主存储 + 快照）
      persistProjectsSync(next);
      return next;
    });
    setCurrentProjectId(newProject.id);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(STORAGE_KEY_CURRENT, newProject.id);
      } catch {
        /* ignore */
      }
    }
    return newProject;
  }, []);

  const switchProject = useCallback((projectId: string) => {
    setCurrentProjectId(projectId);
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(STORAGE_KEY_CURRENT, projectId);
    }
  }, []);

  const renameProject = useCallback((projectId: string, name: string) => {
    setProjects((prev) => {
      const next = prev.map((p) => (p.id === projectId ? { ...p, name } : p));
      persistProjectsSync(next);
      return next;
    });
  }, []);

  const deleteProject = useCallback((projectId: string) => {
    setProjects((prev) => {
      // 拒绝删除已固定的项目
      const target = prev.find((p) => p.id === projectId);
      if (target?.pinned) {
        console.warn(`[project-store] 项目 "${target.name}" 已固定，无法删除`);
        return prev;
      }
      const next = prev.filter((p) => p.id !== projectId);
      if (currentProjectId === projectId) {
        setCurrentProjectId(next[0]?.id || null);
        if (typeof localStorage !== "undefined" && next[0]) {
          localStorage.setItem(STORAGE_KEY_CURRENT, next[0].id);
        }
      }
      persistProjectsSync(next);
      return next;
    });
  }, [currentProjectId]);

  const addConversation = useCallback((projectId: string, title?: string) => {
    const convId = `conv-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const newConv: Conversation = {
      id: convId,
      title: title || "新对话",
      timestamp: new Date(),
    };
    setProjects((prev) => {
      const next = prev.map((p) =>
        p.id === projectId
          ? {
              ...p,
              conversations: [...p.conversations, newConv],
              activeConversationId: convId,
              messagesByConversation: {
                ...p.messagesByConversation,
                [convId]: [
                  {
                    id: `welcome-${convId}`,
                    role: "assistant" as const,
                    content: "您好，我是 Agora Agent，您的AIGC设计助手，请告诉我您的实际需求。",
                    timestamp: new Date(),
                  },
                ],
              },
            }
          : p,
      );
      persistProjectsSync(next);
      return next;
    });
  }, []);

  const switchConversation = useCallback((projectId: string, conversationId: string) => {
    setProjects((prev) => {
      const next = prev.map((p) => (p.id === projectId ? { ...p, activeConversationId: conversationId } : p));
      persistProjectsSync(next);
      return next;
    });
  }, []);

  const deleteConversation = useCallback((projectId: string, conversationId: string) => {
    setProjects((prev) => {
      const next = prev.map((p) => {
        if (p.id !== projectId) return p;
        // 不允许删除最后一个对话
        if (p.conversations.length <= 1) return p;
        const remainingConvs = p.conversations.filter((c) => c.id !== conversationId);
        const remainingMessages = { ...p.messagesByConversation };
        delete remainingMessages[conversationId];
        // 如果删除的是当前激活对话，切换到第一个
        const newActiveId =
          p.activeConversationId === conversationId
            ? remainingConvs[0]?.id || ""
            : p.activeConversationId;
        return {
          ...p,
          conversations: remainingConvs,
          messagesByConversation: remainingMessages,
          activeConversationId: newActiveId,
        };
      });
      persistProjectsSync(next);
      return next;
    });
  }, []);

  const setMessages = useCallback((projectId: string, conversationId: string, messages: Message[]) => {
    setProjects((prev) => {
      const next = prev.map((p) =>
        p.id === projectId
          ? {
              ...p,
              messagesByConversation: {
                ...p.messagesByConversation,
                [conversationId]: messages,
              },
            }
          : p,
      );
      // ⚠️ 关键修复：同步写入 localStorage，消除 useEffect 调度微任务窗口
      // 防止 HMR/刷新在 setProjects→useEffect 之间触发时丢失最新对话
      persistProjectsSync(next);
      return next;
    });
  }, []);

  const resetAll = useCallback(() => {
    setDesignSchemes([]);
    setRenderImages([]);
    setVideos([]);
    setPPTSlides([]);
    setUploadedDoc(null);
    setUploadedSketch(null);
  }, []);

  // 导出数据为 JSON 字符串
  const exportData = useCallback((): string => {
    try {
      const exportObj = {
        version: 1,
        exportedAt: new Date().toISOString(),
        projects: JSON.parse(serializeProjects(projects)),
        currentProjectId,
        designSchemes,
        renderImages,
        videos,
        pptSlides,
        uploadedDoc,
        uploadedSketch,
      };
      return JSON.stringify(exportObj, null, 2);
    } catch {
      return JSON.stringify({ error: "Export failed" });
    }
  }, [projects, currentProjectId, designSchemes, renderImages, videos, pptSlides, uploadedDoc, uploadedSketch]);

  // 从 JSON 字符串导入数据
  const importData = useCallback((json: string): boolean => {
    try {
      const data = JSON.parse(json);
      if (!data.version || !Array.isArray(data.projects)) {
        return false;
      }
      // 恢复项目列表（同步持久化）
      const normalizedProjects: Project[] = data.projects.map((p: Project) => ({
        ...p,
        createdAt: new Date(p.createdAt),
        conversations: p.conversations.map((c) => ({
          ...c,
          timestamp: new Date(c.timestamp),
        })),
      }));
      setProjects(() => {
        persistProjectsSync(normalizedProjects);
        return normalizedProjects;
      });
      // 恢复当前项目 ID
      if (data.currentProjectId) {
        setCurrentProjectId(data.currentProjectId);
        try {
          localStorage.setItem(STORAGE_KEY_CURRENT, data.currentProjectId);
        } catch { /* ignore */ }
      }
      // 恢复其他数据
      if (data.designSchemes) setDesignSchemes(data.designSchemes);
      if (data.renderImages) setRenderImages(data.renderImages);
      if (data.videos) setVideos(data.videos);
      if (data.pptSlides) setPPTSlides(data.pptSlides);
      if (data.uploadedDoc) setUploadedDoc(data.uploadedDoc);
      if (data.uploadedSketch) setUploadedSketch(data.uploadedSketch);
      return true;
    } catch {
      return false;
    }
  }, []);

  // 快照恢复的 context 包装函数
  const listSnapshots = useCallback((): string[] => listProjectSnapshots(), []);
  const restoreSnapshot = useCallback((snapKey: string): boolean => {
    if (!restoreProjectSnapshot(snapKey)) return false;
    // 恢复后，重新从 localStorage 加载最新 projects 到 React state
    try {
      const raw = localStorage.getItem(STORAGE_KEY_PROJECTS);
      if (raw) {
        const parsed = deserializeProjects(raw);
        if (Array.isArray(parsed)) {
          setProjects(parsed);
          return true;
        }
      }
    } catch { /* ignore */ }
    return false;
  }, []);

  // 获取存储信息
  const getStorageInfo = useCallback(() => {
    let storageAvailable = false;
    try {
      storageAvailable = typeof localStorage !== "undefined" && localStorage.length >= 0;
    } catch {
      storageAvailable = false;
    }
    return {
      projectsCount: projects.length,
      currentProjectId,
      storageAvailable,
    };
  }, [projects.length, currentProjectId]);

  /**
   * 手动将 projects + currentProjectId 同步到服务端（POST /api/workspace/state）
   * 用于跨浏览器/设备持久化工作台状态
   * 注意：filesByProject 由 chat/page.tsx 的 handleManualSave 单独 POST
   */
  const syncToServer = useCallback(async (): Promise<{ ok: boolean; error?: string }> => {
    try {
      const payload = {
        projects: JSON.parse(serializeProjects(projects)),
        currentProjectId,
        filesByProject: {},
      };
      // 静态模式：使用客户端 mock 替代服务端状态保存
      const { mockSaveWorkspaceState } = await import("@/lib/client-mock");
      const json = await mockSaveWorkspaceState(payload);
      return { ok: !!json.ok, error: json.ok ? undefined : "Save failed" };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Network error";
      return { ok: false, error: msg };
    }
  }, [projects, currentProjectId]);

  return (
    <ProjectContext.Provider
      value={{
        projects,
        currentProjectId,
        currentProject,
        designSchemes,
        renderImages,
        videos,
        pptSlides,
        uploadedDoc,
        uploadedSketch,
        setDesignSchemes,
        setRenderImages,
        setVideos,
        setPPTSlides,
        setUploadedDoc,
        setUploadedSketch,
        createProject,
        switchProject,
        renameProject,
        deleteProject,
        addConversation,
        switchConversation,
        deleteConversation,
        setMessages,
        resetAll,
        exportData,
        importData,
        listProjectSnapshots: listSnapshots,
        restoreProjectSnapshot: restoreSnapshot,
        getStorageInfo,
        syncToServer,
      }}
    >
      {children}
    </ProjectContext.Provider>
  );
}

export function useProject() {
  const ctx = useContext(ProjectContext);
  if (!ctx) throw new Error("useProject must be used within ProjectProvider");
  return ctx;
}
