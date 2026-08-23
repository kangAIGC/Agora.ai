"use client";

import type { CanvasItem } from "@/components/InfiniteCanvas";
import type { GeneratedFile, UploadedFile } from "@/lib/types";

export interface ProjectCanvasSeed {
  generated: GeneratedFile[];
  text: { id: string; name: string }[];
  image: { id: string; name: string; previewUrl: string }[];
  canvas: CanvasItem[];
}

export type SeedProjectKey =
  | "jingdezhen"      // proj-default-1 / 景德镇陶瓷文创园
  | "lvshuijing"      // proj-default-2 / 绿发晶白水晶拼色树叶吊坠手链
  | "shengu";         // proj-default-3 / 《神骨》漫剧

// 通用：生成唯一但稳定的 canvas item id
const cid = (projectKey: string, name: string) => `canvas-${projectKey}-${name}`;

// ====== 1. 景德镇陶瓷文创园 ======
// 结构：任务书 → 4草图（竖排）→ 4效果图（竖排）→ 4视频（竖排）→ 1HTML
function buildJingdezhenSeed(): ProjectCanvasSeed {
  const DOC_W = 260, DOC_H = 200;
  const IMG_W = 320, IMG_H = 240;
  const SKETCH_GAP = 320;
  const X_DOC = 60;
  const X_SKETCH = X_DOC + DOC_W + 120;
  const X_RENDER = X_SKETCH + DOC_W + 120;
  const X_VIDEO = X_RENDER + IMG_W + 120;
  const X_HTML = X_VIDEO + IMG_W + 120;
  const BASE_Y = 60;

  const taskId = cid("jdz", "taskbook");
  const sketchIds = Array.from({ length: 4 }, (_, i) => cid("jdz", `sketch-${i + 1}`));
  const renderIds = Array.from({ length: 4 }, (_, i) => cid("jdz", `render-${i + 1}`));
  const videoIds = Array.from({ length: 4 }, (_, i) => cid("jdz", `video-${i + 1}`));
  const htmlId = cid("jdz", "html");

  const canvas: CanvasItem[] = [];

  // 任务书
  canvas.push({
    id: taskId,
    type: "file",
    content: "/mock-arch/任务书.docx",
    x: X_DOC, y: BASE_Y + 2 * SKETCH_GAP,
    width: DOC_W, height: DOC_H,
    zIndex: 10,
    meta: { name: "任务书.docx", fileType: "doc" },
  });

  // 4 草图（竖排）
  for (let i = 0; i < 4; i++) {
    canvas.push({
      id: sketchIds[i],
      type: "file",
      content: `/mock-arch/ske-${i + 1}.jpeg`,
      x: X_SKETCH, y: BASE_Y + i * SKETCH_GAP,
      width: DOC_W, height: DOC_H,
      zIndex: 11,
      connectionFrom: taskId,
      connectionColors: ["#60a5fa"],
      meta: { name: `ske-${i + 1}.jpeg`, fileType: "image" },
    });
  }

  // 4 效果图（竖排，与草图一一对应）
  for (let i = 0; i < 4; i++) {
    canvas.push({
      id: renderIds[i],
      type: "image",
      content: `/mock-arch/mock-0${i + 1}.png`,
      x: X_RENDER, y: BASE_Y + i * SKETCH_GAP,
      width: IMG_W, height: IMG_H,
      zIndex: 12,
      connectionFrom: sketchIds[i],
      connectionColors: ["#a78bfa"],
      meta: { name: `mock-0${i + 1}.png`, fileType: "image" },
    });
  }

  // 4 视频（竖排）
  for (let i = 0; i < 4; i++) {
    canvas.push({
      id: videoIds[i],
      type: "video",
      content: `/mock-arch/mock-v${i + 1}.mp4`,
      x: X_VIDEO, y: BASE_Y + i * SKETCH_GAP,
      width: IMG_W, height: IMG_H,
      zIndex: 13,
      connectionFrom: renderIds[i],
      connectionColors: ["#34d399"],
      meta: { name: `mock-v${i + 1}.mp4`, fileType: "video" },
    });
  }

  // HTML 网页：标准长屏尺寸（900×1500），居中于视频列
  const HTML_W = 900, HTML_H = 1500;
  const allVideos = [videoIds[0], videoIds[1], videoIds[2], videoIds[3]];
  const videoMinY = BASE_Y;
  const videoHeight = 4 * (IMG_H) + 3 * (SKETCH_GAP - IMG_H);
  const htmlY = Math.max(40, Math.floor(videoMinY + videoHeight / 2 - HTML_H / 2));
  canvas.push({
    id: htmlId,
    type: "html",
    content: `/mock-arch/流水为脉 · 坊巷成园.html`,
    x: X_HTML, y: htmlY,
    width: HTML_W, height: HTML_H,
    zIndex: 14,
    connectionFrom: allVideos,
    connectionColors: ["#fbbf24", "#fbbf24", "#fbbf24", "#fbbf24"],
    meta: { name: "流水为脉 · 坊巷成园.html", fileType: "html" },
  });

  return {
    generated: [
      ...renderIds.map((id, i) => ({
        id,
        name: `mock-0${i + 1}.png`,
        url: `/mock-arch/mock-0${i + 1}.png`,
        type: "image" as const,
        timestamp: new Date(),
      })),
      ...videoIds.map((id, i) => ({
        id,
        name: `mock-v${i + 1}.mp4`,
        url: `/mock-arch/mock-v${i + 1}.mp4`,
        type: "video" as const,
        timestamp: new Date(),
      })),
      {
        id: htmlId,
        name: "流水为脉 · 坊巷成园.html",
        url: `/mock-arch/流水为脉 · 坊巷成园.html`,
        type: "html" as const,
        timestamp: new Date(),
      },
    ],
    text: [{ id: "jdz-task", name: "任务书.docx" }],
    image: [
      { id: "jdz-ske-1", name: "ske-1.jpeg", previewUrl: "/mock-arch/ske-1.jpeg" },
      { id: "jdz-ske-2", name: "ske-2.jpeg", previewUrl: "/mock-arch/ske-2.jpeg" },
      { id: "jdz-ske-3", name: "ske-3.jpeg", previewUrl: "/mock-arch/ske-3.jpeg" },
      { id: "jdz-ske-4", name: "ske-4.jpeg", previewUrl: "/mock-arch/ske-4.jpeg" },
    ],
    canvas,
  };
}

// ====== 2. 绿发晶白水晶拼色树叶吊坠手链（电商） ======
function buildLvshuijingSeed(): ProjectCanvasSeed {
  const DOC_W = 260, DOC_H = 200;
  const IMG_W = 320, IMG_H = 240;
  const X_DOC = 60;
  const X_SKETCH = X_DOC + DOC_W + 120;
  const X_RENDER = X_SKETCH + DOC_W + 120;
  const X_VIDEO = X_RENDER + IMG_W + 120;
  const X_HTML = X_VIDEO + IMG_W + 120;
  const BASE_Y = 60;
  const GAP = 300;

  const briefId = cid("lsj", "brief");
  const sketchId = cid("lsj", "sketch");
  const renderId = cid("lsj", "render");
  const videoId = cid("lsj", "video");
  const htmlId = cid("lsj", "html");

  return {
    generated: [
      {
        id: renderId,
        name: "手链效果图.png",
        url: "/mock-dianshang/img1.png",
        type: "image",
        timestamp: new Date(),
      },
      {
        id: videoId,
        name: "1.mp4",
        url: "/mock-dianshang/1.mp4",
        type: "video",
        timestamp: new Date(),
      },
      {
        id: htmlId,
        name: "绿发晶白水晶拼色树叶吊坠手链.html",
        url: "/mock-dianshang/绿发晶白水晶拼色树叶吊坠手链.html",
        type: "html",
        timestamp: new Date(),
      },
    ],
    text: [{ id: "lsj-brief", name: "创意brief.doc" }],
    image: [{ id: "lsj-ske", name: "img模特.png", previewUrl: "/mock-dianshang/img模特.png" }],
    canvas: [
      {
        id: briefId,
        type: "file",
        content: "/mock-dianshang/创意brief.doc",
        x: X_DOC, y: BASE_Y + GAP,
        width: DOC_W, height: DOC_H,
        zIndex: 10,
        meta: { name: "创意brief.doc", fileType: "doc" },
      },
      {
        id: sketchId,
        type: "file",
        content: "/mock-dianshang/img模特.png",
        x: X_SKETCH, y: BASE_Y + GAP,
        width: DOC_W, height: DOC_H,
        zIndex: 11,
        connectionFrom: briefId,
        connectionColors: ["#60a5fa"],
        meta: { name: "img模特.png", fileType: "image" },
      },
      {
        id: renderId,
        type: "image",
        content: "/mock-dianshang/img1.png",
        x: X_RENDER, y: BASE_Y + GAP,
        width: IMG_W, height: IMG_H,
        zIndex: 12,
        connectionFrom: sketchId,
        connectionColors: ["#a78bfa"],
        meta: { name: "手链效果图.png", fileType: "image" },
      },
      {
        id: videoId,
        type: "video",
        content: "/mock-dianshang/1.mp4",
        x: X_VIDEO, y: BASE_Y + GAP,
        width: IMG_W, height: IMG_H,
        zIndex: 13,
        connectionFrom: renderId,
        connectionColors: ["#34d399"],
        meta: { name: "1.mp4", fileType: "video" },
      },
      {
        id: htmlId,
        type: "html",
        content: "/mock-dianshang/绿发晶白水晶拼色树叶吊坠手链.html",
        x: X_HTML, y: Math.max(40, Math.floor(BASE_Y + GAP + IMG_H / 2 - 1500 / 2)),
        width: 900, height: 1500,
        zIndex: 14,
        connectionFrom: videoId,
        connectionColors: ["#fbbf24"],
        meta: { name: "绿发晶白水晶拼色树叶吊坠手链.html", fileType: "html" },
      },
    ],
  };
}

// ====== 3. 《神骨》漫剧 ======
function buildShenguSeed(): ProjectCanvasSeed {
  const DOC_W = 260, DOC_H = 200;
  const IMG_W = 300, IMG_H = 225;
  const H_GAP = 40, V_GAP = 60;
  const GRID_GAP_X = IMG_W + H_GAP;
  const GRID_GAP_Y = IMG_H + V_GAP;
  const COL_DOC = 60;
  const COL_IMG = COL_DOC + DOC_W + 120;
  const COL_BOTTOM = COL_DOC;

  const docIds: Record<string, string> = {
    creative: cid("sg", "creative"),
    script: cid("sg", "script"),
    charDoc: cid("sg", "doc-character"),
    sceneDoc: cid("sg", "doc-scene"),
    propDoc: cid("sg", "doc-prop"),
    storyboard: cid("sg", "storyboard"),
  };
  const imgId = (name: string) => cid("sg", `img-${name}`);

  const nameMap: Record<string, { row: number; col: number; docId: string; path: string; fileType: string }> = {
    "苏挽": { row: 0, col: 0, docId: docIds.charDoc, path: "/mock-manju/苏挽.png", fileType: "image" },
    "萧珩": { row: 0, col: 1, docId: docIds.charDoc, path: "/mock-manju/萧珩.png", fileType: "image" },
    "玄青上人": { row: 0, col: 2, docId: docIds.charDoc, path: "/mock-manju/玄青上人.png", fileType: "image" },
    "诛仙台": { row: 1, col: 0, docId: docIds.sceneDoc, path: "/mock-manju/诛仙台.png", fileType: "image" },
    "青云大殿": { row: 1, col: 1, docId: docIds.sceneDoc, path: "/mock-manju/青云大殿.png", fileType: "image" },
    "灭门旧夜": { row: 1, col: 2, docId: docIds.sceneDoc, path: "/mock-manju/灭门旧夜.png", fileType: "image" },
    "墨玉牌": { row: 2, col: 0, docId: docIds.propDoc, path: "/mock-manju/墨玉牌.png", fileType: "image" },
    "墨断剑红绳": { row: 2, col: 1, docId: docIds.propDoc, path: "/mock-manju/墨断剑红绳.png", fileType: "image" },
    "半块碎玉": { row: 2, col: 2, docId: docIds.propDoc, path: "/mock-manju/半块碎玉.png", fileType: "image" },
  };

  // 文档竖排位置
  const docPositions: Record<string, { x: number; y: number }> = {
    creative: { x: COL_DOC, y: 60 },
    script: { x: COL_DOC, y: 360 },
    charDoc: { x: COL_DOC, y: 660 },
    sceneDoc: { x: COL_DOC, y: 960 },
    propDoc: { x: COL_DOC, y: 1260 },
    storyboard: { x: COL_BOTTOM, y: 1560 },
  };

  const canvas: CanvasItem[] = [];

  // 创意
  canvas.push({
    id: docIds.creative,
    type: "file",
    content: "/mock-manju/创意.doc",
    x: docPositions.creative.x, y: docPositions.creative.y,
    width: DOC_W, height: DOC_H,
    zIndex: 10,
    meta: { name: "创意.doc", fileType: "doc" },
  });

  // 剧本（由创意生成）
  canvas.push({
    id: docIds.script,
    type: "file",
    content: "/mock-manju/剧本.doc",
    x: docPositions.script.x, y: docPositions.script.y,
    width: DOC_W, height: DOC_H,
    zIndex: 10,
    connectionFrom: docIds.creative,
    connectionColors: ["#60a5fa"],
    meta: { name: "剧本.doc", fileType: "doc" },
  });

  // 人物/场景/道具（由剧本生成，竖排）
  canvas.push({
    id: docIds.charDoc,
    type: "file",
    content: "/mock-manju/人物.doc",
    x: docPositions.charDoc.x, y: docPositions.charDoc.y,
    width: DOC_W, height: DOC_H,
    zIndex: 10,
    connectionFrom: docIds.script,
    connectionColors: ["#60a5fa"],
    meta: { name: "人物.doc", fileType: "doc" },
  });
  canvas.push({
    id: docIds.sceneDoc,
    type: "file",
    content: "/mock-manju/场景.doc",
    x: docPositions.sceneDoc.x, y: docPositions.sceneDoc.y,
    width: DOC_W, height: DOC_H,
    zIndex: 10,
    connectionFrom: docIds.script,
    connectionColors: ["#60a5fa"],
    meta: { name: "场景.doc", fileType: "doc" },
  });
  canvas.push({
    id: docIds.propDoc,
    type: "file",
    content: "/mock-manju/道具.doc",
    x: docPositions.propDoc.x, y: docPositions.propDoc.y,
    width: DOC_W, height: DOC_H,
    zIndex: 10,
    connectionFrom: docIds.script,
    connectionColors: ["#60a5fa"],
    meta: { name: "道具.doc", fileType: "doc" },
  });

  // 3x3 图像网格
  const gridTopY = docPositions.charDoc.y;
  for (const [name, info] of Object.entries(nameMap)) {
    canvas.push({
      id: imgId(name),
      type: "image",
      content: info.path,
      x: COL_IMG + info.col * GRID_GAP_X,
      y: gridTopY + info.row * GRID_GAP_Y,
      width: IMG_W, height: IMG_H,
      zIndex: 12,
      connectionFrom: info.docId,
      connectionColors: ["#a78bfa"],
      meta: { name: `${name}.png`, fileType: info.fileType },
    });
  }

  // 分镜稿
  canvas.push({
    id: docIds.storyboard,
    type: "file",
    content: "/mock-manju/分镜稿.doc",
    x: docPositions.storyboard.x, y: docPositions.storyboard.y,
    width: DOC_W, height: DOC_H,
    zIndex: 10,
    connectionFrom: [imgId("苏挽"), imgId("诛仙台"), imgId("墨玉牌")],
    connectionColors: ["#a78bfa", "#a78bfa", "#a78bfa"],
    meta: { name: "分镜稿.doc", fileType: "doc" },
  });

  // 视频（由分镜稿生成）
  const videoId = cid("sg", "video-1");
  canvas.push({
    id: videoId,
    type: "video",
    content: "/mock-manju/视频0-30s.mp4",
    x: COL_IMG, y: docPositions.storyboard.y,
    width: IMG_W, height: IMG_H,
    zIndex: 13,
    connectionFrom: docIds.storyboard,
    connectionColors: ["#34d399"],
    meta: { name: "视频0-30s.mp4", fileType: "video" },
  });

  // HTML 网页：标准长屏尺寸（900×1500），位于视频右侧，垂直居中
  const htmlId = cid("sg", "html");
  const HTML_W = 900, HTML_H = 1500;
  const X_HTML = COL_IMG + IMG_W + 120;
  const videoCenterY = docPositions.storyboard.y + IMG_H / 2;
  const htmlY = Math.max(40, Math.floor(videoCenterY - HTML_H / 2));
  canvas.push({
    id: htmlId,
    type: "html",
    content: "/mock-manju/html.html",
    x: X_HTML, y: htmlY,
    width: HTML_W, height: HTML_H,
    zIndex: 14,
    connectionFrom: videoId,
    connectionColors: ["#fbbf24"],
    meta: { name: "《神骨》漫剧.html", fileType: "html" },
  });

  const generated: GeneratedFile[] = [];
  for (const [name, info] of Object.entries(nameMap)) {
    generated.push({
      id: imgId(name),
      name: `${name}.png`,
      url: info.path,
      type: "image",
      timestamp: new Date(),
    });
  }
  generated.push({
    id: videoId,
    name: "视频0-30s.mp4",
    url: "/mock-manju/视频0-30s.mp4",
    type: "video",
    timestamp: new Date(),
  });
  generated.push({
    id: htmlId,
    name: "《神骨》漫剧.html",
    url: "/mock-manju/html.html",
    type: "html",
    timestamp: new Date(),
  });

  return {
    generated,
    text: [
      { id: "sg-creative", name: "创意.doc" },
      { id: "sg-script", name: "剧本.doc" },
      { id: "sg-chardoc", name: "人物.doc" },
      { id: "sg-scenedoc", name: "场景.doc" },
      { id: "sg-propdoc", name: "道具.doc" },
      { id: "sg-storyboard", name: "分镜稿.doc" },
    ],
    image: [],
    canvas,
  };
}

// 种子数据缓存
const seedCache: Record<SeedProjectKey, ProjectCanvasSeed | null> = {
  jingdezhen: null,
  lvshuijing: null,
  shengu: null,
};

export function getSeedProject(key: SeedProjectKey): ProjectCanvasSeed {
  if (!seedCache[key]) {
    switch (key) {
      case "jingdezhen":
        seedCache[key] = buildJingdezhenSeed();
        break;
      case "lvshuijing":
        seedCache[key] = buildLvshuijingSeed();
        break;
      case "shengu":
        seedCache[key] = buildShenguSeed();
        break;
    }
  }
  return seedCache[key]!;
}

/**
 * 根据项目名称推断种子键（返回 null 表示没有匹配的种子）
 */
export function inferSeedKey(projectName: string, projectId: string): SeedProjectKey | null {
  // 优先按 ID 精确匹配默认项目
  if (projectId === "proj-default-1" || /proj.*default.*1/.test(projectId)) return "jingdezhen";
  if (projectId === "proj-default-2" || /proj.*default.*2/.test(projectId)) return "lvshuijing";
  if (projectId === "proj-default-3" || /proj.*default.*3/.test(projectId)) return "shengu";
  // 退回按名称模糊匹配
  if (/景德镇/.test(projectName)) return "jingdezhen";
  if (/绿发晶|树叶吊坠|白水晶拼色/.test(projectName)) return "lvshuijing";
  if (/神骨|漫剧/.test(projectName)) return "shengu";
  return null;
}

/**
 * 返回已知项目的种子键到项目名、id 的提示映射（供调试和匹配使用）
 */
export const SEED_KEY_INFO: Record<SeedProjectKey, { nameContains: string; defaultId: string }> = {
  jingdezhen: { nameContains: "景德镇", defaultId: "proj-default-1" },
  lvshuijing: { nameContains: "绿发晶|树叶吊坠|白水晶拼色", defaultId: "proj-default-2" },
  shengu: { nameContains: "神骨|漫剧", defaultId: "proj-default-3" },
};
