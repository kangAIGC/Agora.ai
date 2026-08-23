/* eslint-disable */
// 分析图标结构：扫描中心十字线，识别各元素
const sharp = require("sharp");
const path = require("path");

const SRC = path.join(__dirname, "..", "public", "mock-arch", "Image-.original.png");

(async () => {
  const meta = await sharp(SRC).metadata();
  const W = meta.width;
  const H = meta.height;
  const raw = await sharp(SRC).ensureAlpha().raw().toBuffer();
  const ch = 4;

  console.log("=== 水平中线扫描 (y =", Math.floor(H/2), ") ===");
  const midY = Math.floor(H / 2);
  let segStart = -1;
  let lastL = -1;
  for (let x = 0; x < W; x++) {
    const i = (midY * W + x) * ch;
    const r = raw[i], g = raw[i+1], b = raw[i+2];
    const l = Math.round((r + g + b) / 3);
    if (Math.abs(l - lastL) > 30) {
      if (segStart >= 0) {
        console.log(`  x[${segStart}-${x-1}] L=${lastL} (R=${raw[(midY*W+segStart)*ch]} G=${raw[(midY*W+segStart)*ch+1]} B=${raw[(midY*W+segStart)*ch+2]})`);
      }
      segStart = x;
    }
    lastL = l;
  }
  if (segStart >= 0) {
    console.log(`  x[${segStart}-${W-1}] L=${lastL}`);
  }

  console.log("\n=== 垂直中线扫描 (x =", Math.floor(W/2), ") ===");
  const midX = Math.floor(W / 2);
  segStart = -1;
  lastL = -1;
  for (let y = 0; y < H; y++) {
    const i = (y * W + midX) * ch;
    const r = raw[i], g = raw[i+1], b = raw[i+2];
    const l = Math.round((r + g + b) / 3);
    if (Math.abs(l - lastL) > 30) {
      if (segStart >= 0) {
        console.log(`  y[${segStart}-${y-1}] L=${lastL}`);
      }
      segStart = y;
    }
    lastL = l;
  }
  if (segStart >= 0) {
    console.log(`  y[${segStart}-${H-1}] L=${lastL}`);
  }

  // 找所有亮像素的连通区域：按行扫描，记录每段亮像素的起止
  console.log("\n=== 亮像素行段统计（按行）===");
  let rowSegments = [];
  for (let y = 0; y < H; y++) {
    let segs = [];
    let inSeg = false;
    let s = 0;
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * ch;
      const l = (raw[i] + raw[i+1] + raw[i+2]) / 3;
      if (l > 40 && !inSeg) { inSeg = true; s = x; }
      else if (l <= 40 && inSeg) { inSeg = false; segs.push([s, x-1]); }
    }
    if (inSeg) segs.push([s, W-1]);
    if (segs.length > 0) rowSegments.push({ y, segs });
  }
  // 打印前20行和后20行的段
  console.log("前15行:");
  rowSegments.slice(0, 15).forEach(r => console.log(`  y=${r.y}:`, JSON.stringify(r.segs)));
  console.log("...");
  console.log("中间10行 (y=130-140):");
  rowSegments.filter(r => r.y >= 130 && r.y <= 140).forEach(r => console.log(`  y=${r.y}:`, JSON.stringify(r.segs)));
  console.log("...");
  console.log("后15行:");
  rowSegments.slice(-15).forEach(r => console.log(`  y=${r.y}:`, JSON.stringify(r.segs)));

  // 统计每行的段数量分布
  const segCountDist = {};
  rowSegments.forEach(r => {
    const n = r.segs.length;
    segCountDist[n] = (segCountDist[n] || 0) + 1;
  });
  console.log("\n=== 每行段数分布 ===");
  Object.keys(segCountDist).sort((a,b)=>a-b).forEach(k => {
    console.log(`  ${k}段/行: ${segCountDist[k]}行`);
  });
})();
