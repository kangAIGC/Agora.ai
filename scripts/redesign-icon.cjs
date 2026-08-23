/* eslint-disable */
// 重新设计图标（正确版）：
// 图标结构：275x275，外圈白色方形边框 + 黑色背景 + 中心白色小圆点
// 1) 黑色背景 → 透明
// 2) 仅放大中心的"圆点"元素（半径 ~7px → ~10px）
// 3) 保持外圈方形边框不变
// 4) 边缘清晰（alpha 硬阈值二值化）
// 5) 保留原尺寸 275x275
const sharp = require("sharp");
const path = require("path");
const fs = require("fs");

const SRC_DIR = path.join(__dirname, "..", "public", "mock-arch");
const SRC = path.join(SRC_DIR, "Image-.png");
const BACKUP = path.join(SRC_DIR, "Image-.original.png");

// 第一步：从备份恢复原图（之前的脚本破坏了原图）
if (fs.existsSync(BACKUP)) {
  fs.copyFileSync(BACKUP, SRC);
  console.log("[restore] 已从备份恢复原图");
}

(async () => {
  const meta = await sharp(SRC).metadata();
  const W = meta.width;
  const H = meta.height;
  console.log("[meta]", W, "x", H);

  const raw = await sharp(SRC).ensureAlpha().raw().toBuffer();
  const ch = 4;

  // 通过行段扫描识别中心圆点：
  // 中线扫描显示中心圆点位于 x≈131-144, y≈132-145
  // 圆点中心约 (137, 138)，半径约 7px
  // 使用连通域分析：从中心出发找同色（白色 L>200）连通像素
  const isLight = (i) => {
    const l = (raw[i] + raw[i + 1] + raw[i + 2]) / 3;
    return l > 180; // 白色像素
  };
  const isDark = (i) => {
    const l = (raw[i] + raw[i + 1] + raw[i + 2]) / 3;
    return l < 40; // 黑色背景
  };

  // BFS 找中心圆点的连通区域
  const startIdx = (138 * W + 137) * ch; // 中心点
  const visited = new Uint8Array(W * H);
  const dotPixels = [];
  const queue = [[137, 138]];
  visited[138 * W + 137] = 1;
  while (queue.length > 0) {
    const [x, y] = queue.shift();
    const i = (y * W + x) * ch;
    if (!isLight(i)) continue;
    dotPixels.push([x, y]);
    // 4 邻域
    const neighbors = [[x-1,y],[x+1,y],[x,y-1],[x,y+1]];
    for (const [nx, ny] of neighbors) {
      if (nx < 0 || nx >= W || ny < 0 || ny >= H) continue;
      const ni = ny * W + nx;
      if (visited[ni]) continue;
      visited[ni] = 1;
      queue.push([nx, ny]);
    }
  }
  console.log("[dot] 圆点像素数:", dotPixels.length);

  // 计算圆点的几何中心和半径
  let sumX = 0, sumY = 0;
  let minX = W, minY = H, maxX = 0, maxY = 0;
  for (const [x, y] of dotPixels) {
    sumX += x; sumY += y;
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  const dotCx = sumX / dotPixels.length;
  const dotCy = sumY / dotPixels.length;
  const dotR = Math.max(maxX - minX, maxY - minY) / 2;
  console.log("[dot] center:", dotCx.toFixed(1), dotCy.toFixed(1), "radius:", dotR.toFixed(1));
  console.log("[dot] bbox:", minX, minY, "-", maxX, maxY);

  // ===== 处理像素 =====
  const out = Buffer.from(raw);

  // 1) 黑色背景 → 透明；保留白色元素（外圈框 + 圆点）
  for (let i = 0; i < out.length; i += ch) {
    if (isDark(i)) {
      out[i + 3] = 0; // 透明
    } else {
      // 白色元素保留，并硬二值化为纯白 + 不透明，保证边缘清晰
      out[i] = 255;
      out[i + 1] = 255;
      out[i + 2] = 255;
      out[i + 3] = 255;
    }
  }

  // 2) 放大中心圆点：半径 × 1.4
  const SCALE = 1.4;
  const newR = dotR * SCALE;
  const newR2 = newR * newR;
  console.log("[dot] new radius:", newR.toFixed(1));

  // 在 out 上重新绘制放大后的圆点：
  // 对距离中心 <= newR 的位置，如果当前是透明的（原本是黑色背景），则填白
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const dx = x - dotCx;
      const dy = y - dotCy;
      const d2 = dx * dx + dy * dy;
      if (d2 <= newR2) {
        const i = (y * W + x) * ch;
        // 只填充原本透明的位置，避免覆盖外圈框（虽然外圈框远离中心，这里只是保险）
        if (out[i + 3] === 0) {
          out[i] = 255;
          out[i + 1] = 255;
          out[i + 2] = 255;
          out[i + 3] = 255;
        }
      }
    }
  }

  // 输出 PNG，保持 275x275
  await sharp(out, {
    raw: { width: W, height: H, channels: 4 },
  })
    .png({ compressionLevel: 9, palette: false })
    .toFile(SRC + ".tmp.png");

  fs.renameSync(SRC + ".tmp.png", SRC);
  console.log("[done] 已输出", SRC);

  // 验证输出
  const vRaw = await sharp(SRC).ensureAlpha().raw().toBuffer();
  let transparentCount = 0;
  let whiteCount = 0;
  for (let i = 0; i < vRaw.length; i += ch) {
    if (vRaw[i + 3] === 0) transparentCount++;
    else if (vRaw[i] > 200) whiteCount++;
  }
  console.log("[verify] 透明像素:", transparentCount, "白色像素:", whiteCount);
})();
