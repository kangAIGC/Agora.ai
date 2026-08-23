export interface UploadedFile {
  id: string;
  file: File;
  name: string;
  dify_file_id?: string;
  uploadedAt: Date;
  status: "uploading" | "success" | "error";
  previewUrl?: string;
}

export interface GeneratedFile {
  id: string;
  name: string;
  url: string;
  type: "doc" | "image" | "video" | "html";
  timestamp: Date;
}

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  files?: GeneratedFile[];
  isLoading?: boolean;
  isError?: boolean;
}

export interface Conversation {
  id: string;
  title: string;
  timestamp: Date;
}

export type Mode = "design" | "image" | "video" | "html";
