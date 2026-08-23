"use client";

import { useState, useRef, useEffect } from "react";
import { toast } from "sonner";
import {
  FileText,
  Image as ImageIcon,
  File,
  Download,
  Trash2,
  Eye,
  Plus,
  FolderOpen,
  ChevronDown,
  ChevronRight,
  Pencil,
  Check,
  PanelLeftClose,
  PanelLeft,
  Upload as UploadIcon,
  HardDrive,
  Loader2,
  Pin,
} from "lucide-react";
import { useProject } from "@/lib/project-store";
import type { UploadedFile, GeneratedFile } from "@/lib/types";
import { asset } from "@/lib/asset";

interface WorkspaceSidebarProps {
  textFiles: UploadedFile[];
  imageFiles: UploadedFile[];
  generatedFiles: GeneratedFile[];
  onUploadText: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onUploadImage: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveText: (id: string) => void;
  onRemoveImage: (id: string) => void;
  onPreviewImage: (url: string) => void;
  onDownloadGenerated: (file: GeneratedFile) => void;
  onRemoveGenerated: (id: string) => void;
  onDownloadAll: () => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  onExportData?: () => void;
  onImportData?: (file: File) => void;
  onSaveWorkflow?: (projectId?: string) => void;
  currentProjectName?: string;
  /** 切换项目前的钩子：返回 true 才执行切换；可用于脏状态提示 */
  onBeforeSwitchProject?: (targetProjectId: string) => boolean;
}

function getFileIconStyle(type: string) {
  switch (type) {
    case "doc":
      return { bg: "bg-blue-500/20 text-blue-400", icon: <FileText className="w-4 h-4" /> };
    case "image":
      return { bg: "bg-green-500/20 text-green-400", icon: <ImageIcon className="w-4 h-4" /> };
    case "video":
      return { bg: "bg-purple-500/20 text-purple-400", icon: <File className="w-4 h-4" /> };
    case "html":
      return { bg: "bg-orange-500/20 text-orange-400", icon: <File className="w-4 h-4" /> };
    default:
      return { bg: "bg-gray-500/20 text-gray-400", icon: <File className="w-4 h-4" /> };
  }
}

function CollapsibleSection({
  title,
  icon,
  children,
  defaultOpen = true,
  action,
  className = "",
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
  action?: React.ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={`flex-1 min-h-0 flex flex-col border-b border-white/10 ${className}`}>
      <div
        role="button"
        tabIndex={0}
        onClick={() => setOpen(!open)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen(!open);
          }
        }}
        className="flex-shrink-0 w-full flex items-center gap-2 px-3 py-2.5 text-sm font-medium text-white/80 hover:bg-white/5 transition-colors cursor-pointer"
      >
        {open ? (
          <ChevronDown className="w-3.5 h-3.5 text-white/40" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5 text-white/40" />
        )}
        <span className="text-white/60">{icon}</span>
        <span className="flex-1 text-left">{title}</span>
        {action}
      </div>
      {open && (
        <div className="flex-1 overflow-y-auto px-3 pb-3 min-h-0 chat-scroll">
          {children}
        </div>
      )}
    </div>
  );
}

export default function WorkspaceSidebar({
  textFiles,
  imageFiles,
  generatedFiles,
  onUploadText,
  onUploadImage,
  onRemoveText,
  onRemoveImage,
  onPreviewImage,
  onDownloadGenerated,
  onRemoveGenerated,
  onDownloadAll,
  collapsed: collapsedProp,
  onToggleCollapse,
  onExportData,
  onImportData,
  onSaveWorkflow,
  currentProjectName,
  onBeforeSwitchProject,
}: WorkspaceSidebarProps) {
  const {
    projects,
    currentProjectId,
    switchProject,
    createProject,
    renameProject,
    deleteProject,
  } = useProject();

  const imageInputRef = useRef<HTMLInputElement>(null);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [newProjectName, setNewProjectName] = useState("");
  const [showNewProject, setShowNewProject] = useState(false);
  const [savingProjectId, setSavingProjectId] = useState<string | null>(null);

  // Internal collapsed state with localStorage persistence
  const [internalCollapsed, setInternalCollapsed] = useState(false);
  const isControlled = collapsedProp !== undefined;
  const collapsed = isControlled ? collapsedProp! : internalCollapsed;

  useEffect(() => {
    if (!isControlled) {
      try {
        const saved = localStorage.getItem("aga-sidebar-collapsed");
        if (saved === "true") setInternalCollapsed(true);
      } catch { /* ignore */ }
    }
  }, []);

  const handleToggle = () => {
    if (onToggleCollapse) {
      onToggleCollapse();
    } else {
      const newVal = !collapsed;
      setInternalCollapsed(newVal);
      try {
        localStorage.setItem("aga-sidebar-collapsed", String(newVal));
      } catch { /* ignore */ }
    }
  };

  const handleCreateProject = () => {
    const name = newProjectName.trim();
    if (!name) {
      toast.warning("请输入项目名称");
      return;
    }
    if (projects.some((p) => p.name === name)) {
      toast.warning("项目名称已存在");
      return;
    }
    const newProject = createProject(name);
    if (newProject) {
      toast.success(`项目"${name}"已创建`);
      setNewProjectName("");
      setShowNewProject(false);
    } else {
      toast.error("项目创建失败");
    }
  };

  const handleRenameProject = (projectId: string) => {
    if (editingName.trim()) {
      renameProject(projectId, editingName.trim());
    }
    setEditingProjectId(null);
    setEditingName("");
  };

  if (collapsed) {
    // Collapsed state - show only icons and a toggle button
    return (
      <aside className="w-14 h-full border-r border-white/10 bg-[#1a1a1a]/95 flex flex-col items-center py-3 gap-2 transition-all duration-300">
        {/* Toggle expand button */}
        <button
          onClick={handleToggle}
          className="w-10 h-10 flex items-center justify-center rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors"
          title="展开面板"
        >
          <PanelLeft className="w-5 h-5" />
        </button>
        <div className="w-8 h-px bg-white/10 my-1" />

        {/* Project icon */}
        <button
          onClick={() => { /* project list access via tooltip only in collapsed */ }}
          className="w-10 h-10 flex items-center justify-center rounded-lg text-blue-400 hover:bg-white/10 transition-colors"
          title={projects.length > 0 ? projects.find(p => p.id === currentProjectId)?.name || "项目" : "项目"}
        >
          <FolderOpen className="w-5 h-5" />
        </button>

        {/* Input section icon */}
        <label
          className="w-10 h-10 flex items-center justify-center rounded-lg text-green-400 hover:bg-white/10 cursor-pointer transition-colors"
          title="上传图片"
        >
          <ImageIcon className="w-5 h-5" />
          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={onUploadImage}
          />
        </label>

        <label
          className="w-10 h-10 flex items-center justify-center rounded-lg text-blue-400 hover:bg-white/10 cursor-pointer transition-colors"
          title="上传文档"
        >
          <FileText className="w-5 h-5" />
          <input type="file" accept=".doc,.docx" className="hidden" onChange={onUploadText} />
        </label>

        {/* Output section icon */}
        <button
          className="w-10 h-10 flex items-center justify-center rounded-lg text-orange-400 hover:bg-white/10 transition-colors relative"
          title={`输出 (${generatedFiles.length})`}
        >
          <File className="w-5 h-5" />
          {generatedFiles.length > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-orange-500 text-[10px] font-medium text-white flex items-center justify-center">
              {generatedFiles.length > 9 ? "9+" : generatedFiles.length}
            </span>
          )}
        </button>

        <div className="flex-1" />

        {/* Download all */}
        {generatedFiles.length > 0 && (
          <button
            onClick={onDownloadAll}
            className="w-10 h-10 flex items-center justify-center rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors"
            title="全部下载"
          >
            <Download className="w-5 h-5" />
          </button>
        )}
      </aside>
    );
  }

  // Expanded state - full sidebar
  return (
    <aside className="w-full h-full border-r border-white/10 bg-[#1a1a1a]/95 flex flex-col overflow-hidden relative transition-all duration-300">
      {/* 项目 */}
      <CollapsibleSection
        title="项目"
        icon={<FolderOpen className="w-4 h-4" />}
        defaultOpen={true}
        action={
          <div className="flex items-center gap-0.5">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowNewProject(true);
              }}
              className="p-1.5 hover:bg-blue-500/20 rounded transition-colors"
              title="新建项目"
            >
              <Plus className="w-4 h-4 text-blue-400" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleToggle();
              }}
              className="p-1.5 hover:bg-white/10 rounded transition-colors"
              title="收起面板"
            >
              <PanelLeftClose className="w-4 h-4 text-white/40" />
            </button>
          </div>
        }
      >
        <div className="space-y-1">
          {projects.map((project) => (
            <div key={project.id} className="group relative">
              {editingProjectId === project.id ? (
                <div className="flex items-center gap-1 p-2 bg-white/10 rounded-lg">
                  <input
                    autoFocus
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleRenameProject(project.id);
                      if (e.key === "Escape") {
                        setEditingProjectId(null);
                        setEditingName("");
                      }
                    }}
                    className="flex-1 bg-transparent text-sm text-white outline-none border-b border-white/30 min-w-0"
                  />
                  <button
                    onClick={() => handleRenameProject(project.id)}
                    className="p-0.5 hover:bg-white/10 rounded"
                  >
                    <Check className="w-3.5 h-3.5 text-green-400" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => {
                    // —— 手动保存模式：切换项目前调用钩子检查脏状态 ——
                    //    钩子返回 false/未显式返回 true 时，仅提示不切换；用户点击保存后再次切换即可
                    if (onBeforeSwitchProject) {
                      const allowed = onBeforeSwitchProject(project.id);
                      if (!allowed) return;
                    }
                    switchProject(project.id);
                  }}
                  onDoubleClick={() => {
                    setEditingProjectId(project.id);
                    setEditingName(project.name);
                  }}
                  className={`w-full flex items-center gap-2 p-2 rounded-lg text-sm transition-colors ${
                    currentProjectId === project.id
                      ? "bg-white/10 text-white"
                      : "text-white/50 hover:bg-white/5 hover:text-white/80"
                  }`}
                >
                  <FolderOpen
                    className={`w-4 h-4 flex-shrink-0 ${
                      currentProjectId === project.id ? "text-blue-400" : ""
                    }`}
                  />
                  <span className="truncate flex-1 text-left">{project.name}</span>
                  {project.pinned && (
                    <Pin className="w-3 h-3 text-blue-400 flex-shrink-0" fill="currentColor" />
                  )}
                  {project.conversations.length > 0 && (
                    <span className="text-[10px] text-white/30 flex-shrink-0">
                      {project.conversations.length}
                    </span>
                  )}
                </button>
              )}

              {/* Hover actions */}
              {editingProjectId !== project.id && (
                <div className="absolute right-1 top-1/2 -translate-y-1/2 hidden group-hover:flex items-center gap-0.5">
                  {onSaveWorkflow && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSavingProjectId(project.id);
                        // 模拟异步保存（为了显示加载状态）
                        setTimeout(() => {
                          onSaveWorkflow(project.id);
                          setSavingProjectId(null);
                        }, 300);
                      }}
                      className="p-1 bg-[#1a1a1a] hover:bg-blue-500/20 rounded transition-colors disabled:opacity-50"
                      title="保存工作流"
                      disabled={savingProjectId === project.id}
                    >
                      {savingProjectId === project.id ? (
                        <Loader2 className="w-3 h-3 text-blue-400 animate-spin" />
                      ) : (
                        <HardDrive className="w-3 h-3 text-white/50 hover:text-blue-400" />
                      )}
                    </button>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingProjectId(project.id);
                      setEditingName(project.name);
                    }}
                    className="p-1 bg-[#1a1a1a] hover:bg-white/20 rounded transition-colors"
                    title="重命名"
                  >
                    <Pencil className="w-3 h-3 text-white/50" />
                  </button>
                  {projects.length > 1 && !project.pinned && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteProject(project.id);
                      }}
                      className="p-1 bg-[#1a1a1a] hover:bg-red-500/20 rounded transition-colors"
                      title="删除"
                    >
                      <Trash2 className="w-3 h-3 text-white/50 hover:text-red-400" />
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}

          {/* New project input */}
          {showNewProject && (
            <div className="flex items-center gap-1 p-2 bg-white/5 rounded-lg">
              <input
                autoFocus
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreateProject();
                  if (e.key === "Escape") {
                    setShowNewProject(false);
                    setNewProjectName("");
                  }
                }}
                placeholder="项目名称"
                className="flex-1 bg-transparent text-sm text-white outline-none border-b border-white/30 min-w-0 placeholder:text-white/30"
              />
              <button
                onClick={handleCreateProject}
                className="p-0.5 hover:bg-white/10 rounded"
              >
                <Check className="w-3.5 h-3.5 text-green-400" />
              </button>
              <button
                onClick={() => {
                  setShowNewProject(false);
                  setNewProjectName("");
                }}
                className="p-0.5 hover:bg-white/10 rounded"
              >
                <span className="w-3.5 h-3.5 text-white/40 text-xs">✕</span>
              </button>
            </div>
          )}
        </div>
      </CollapsibleSection>

      {/* 输入 */}
      <CollapsibleSection
        title="输入"
        icon={<Upload className="w-4 h-4" />}
        defaultOpen={true}
      >
        <div className="flex gap-2 p-2">
          <label className="flex-1 flex flex-col items-center justify-center p-3 bg-white/5 hover:bg-white/10 rounded-lg cursor-pointer transition-colors">
            <FileText className="w-5 h-5 text-blue-400 mb-1" />
            <span className="text-xs text-white/70">上传文档</span>
            <input type="file" accept=".doc,.docx" className="hidden" onChange={onUploadText} />
          </label>
          <label className="flex-1 flex flex-col items-center justify-center p-3 bg-white/5 hover:bg-white/10 rounded-lg cursor-pointer transition-colors">
            <ImageIcon className="w-5 h-5 text-green-400 mb-1" />
            <span className="text-xs text-white/70">上传图片</span>
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={onUploadImage}
            />
          </label>
        </div>

        {/* 已上传文件列表（简洁展示） */}
        {textFiles.length > 0 && (
          <div className="mt-2 space-y-1.5 max-h-24 overflow-y-auto">
            {textFiles.map((file) => (
              <div
                key={file.id}
                className="group flex items-center gap-2 p-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-xs transition-colors"
              >
                {file.status === "uploading" ? (
                  <span className="w-4 h-4 border-2 border-white/20 border-t-white/60 rounded-full animate-spin flex-shrink-0" />
                ) : file.status === "error" ? (
                  <span className="w-4 h-4 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                  </span>
                ) : (
                  <FileText className="w-4 h-4 text-blue-400 flex-shrink-0" />
                )}
                <span className="truncate flex-1 text-white">{file.name}</span>
                <button
                  onClick={() => onRemoveText(file.id)}
                  className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-white/10 rounded transition-all"
                >
                  <Trash2 className="w-3 h-3 text-white/50" />
                </button>
              </div>
            ))}
          </div>
        )}

        {imageFiles.length > 0 && (
          <div className="mt-2 grid grid-cols-3 gap-1.5 max-h-32 overflow-y-auto">
            {imageFiles.map((file) => (
              <div
                key={file.id}
                className="group relative aspect-square bg-white/5 rounded-lg overflow-hidden flex items-center justify-center"
              >
                {file.status === "uploading" ? (
                  <span className="w-4 h-4 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
                ) : file.status === "error" ? (
                  <span className="w-4 h-4 rounded-full bg-red-500/20 flex items-center justify-center">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                  </span>
                ) : (
                  <>
                    <img
                      src={asset(file.previewUrl)}
                      alt={file.name}
                      className="w-full h-full object-cover cursor-pointer"
                      onClick={() => onPreviewImage(file.previewUrl!)}
                    />
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                      <button
                        onClick={() => onPreviewImage(file.previewUrl!)}
                        className="p-0.5 hover:bg-white/20 rounded transition-colors"
                      >
                        <Eye className="w-3 h-3 text-white" />
                      </button>
                      <button
                        onClick={() => onRemoveImage(file.id)}
                        className="p-0.5 hover:bg-white/20 rounded transition-colors"
                      >
                        <Trash2 className="w-3 h-3 text-white" />
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </CollapsibleSection>

      {/* 输出 */}
      <CollapsibleSection
        title="输出"
        icon={<File className="w-4 h-4" />}
        defaultOpen={true}
        action={
          generatedFiles.length > 0 && (
            <button
              onClick={onDownloadAll}
              className="p-1 hover:bg-white/10 rounded transition-colors"
              title="全部下载"
            >
              <Download className="w-3.5 h-3.5 text-white/50" />
            </button>
          )
        }
      >
        {generatedFiles.length === 0 ? (
          <p className="text-xs text-white/30 text-center py-3">暂无生成文件</p>
        ) : (
          <div className="space-y-1.5 max-h-64 overflow-y-auto">
            {generatedFiles.map((file) => {
              const iconStyle = getFileIconStyle(file.type);
              return (
                <div
                  key={file.id}
                  className="group flex items-center gap-2 p-2 bg-white/5 hover:bg-white/10 rounded-lg text-xs transition-colors cursor-pointer"
                  onClick={() => onDownloadGenerated(file)}
                >
                  <div className={`w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 ${iconStyle.bg}`}>
                    {iconStyle.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-white">{file.name}</p>
                    <p className="text-white/40 text-[10px]">{file.type.toUpperCase()}</p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveGenerated(file.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-white/10 rounded transition-all"
                  >
                    <Trash2 className="w-3 h-3 text-white/50" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </CollapsibleSection>
    </aside>
  );
}

function Upload({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
      />
    </svg>
  );
}
