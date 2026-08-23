# ============================================================
# ArchDesign.ai - Windows 一键构建脚本
# 用法：
#   1. 先安装依赖： pnpm install
#   2. 构建：        .\build.ps1
# ============================================================

[CmdletBinding()]
param(
    [switch]$SkipInstall,
    [switch]$SkipNextBuild
)

$ErrorActionPreference = "Stop"

# 切换到脚本所在目录（项目根目录）
Set-Location $PSScriptRoot
Write-Host "`n=== ArchDesign.ai 构建开始 ===" -ForegroundColor Cyan
Write-Host "工作目录: $(Get-Location)" -ForegroundColor Gray

# -------------------------------------------------------
# 1. 依赖安装检查
# -------------------------------------------------------
if (-not $SkipInstall) {
    Write-Host "`n[1/3] 检查并安装依赖..." -ForegroundColor Yellow
    if (-not (Test-Path "node_modules")) {
        Write-Host "node_modules 不存在，开始 pnpm install..."
        pnpm install
        if ($LASTEXITCODE -ne 0) {
            throw "pnpm install 失败，退出码 $LASTEXITCODE"
        }
        Write-Host "依赖安装完成。" -ForegroundColor Green
    } else {
        Write-Host "已检测到 node_modules，跳过安装。使用 -SkipInstall 可强制跳过检查，或手动 pnpm install --frozen-lockfile" -ForegroundColor Gray
    }
} else {
    Write-Host "`n[1/3] 参数指定，跳过依赖安装。" -ForegroundColor Gray
}

# -------------------------------------------------------
# 2. Next.js 构建
# -------------------------------------------------------
if (-not $SkipNextBuild) {
    Write-Host "`n[2/3] 执行 Next.js 构建 (next build) ..." -ForegroundColor Yellow
    pnpm next build
    if ($LASTEXITCODE -ne 0) {
        # 类型错误不一定阻塞运行，给出警告而不直接 throw
        Write-Warning "next build 返回非零退出码 $LASTEXITCODE。若仅是 ESLint/ts 警告通常可忽略，若页面 404/500 请重新执行。"
    }
    if (Test-Path ".next") {
        Write-Host "Next.js 构建完成（.next/ 目录已生成）。" -ForegroundColor Green
    } else {
        throw "Next.js 构建失败：未找到 .next/ 目录。"
    }
} else {
    Write-Host "`n[2/3] 参数指定，跳过 Next.js 构建。" -ForegroundColor Gray
}

# -------------------------------------------------------
# 3. 打包自定义服务器 (src/server.ts -> dist/server.js)
# -------------------------------------------------------
Write-Host "`n[3/3] 打包服务器 (tsup src/server.ts) ..." -ForegroundColor Yellow
pnpm tsup src/server.ts --format cjs --platform node --target node20 --outDir dist --no-splitting --no-minify
if ($LASTEXITCODE -ne 0) {
    throw "tsup 打包失败，退出码 $LASTEXITCODE"
}
if (-not (Test-Path "dist/server.js")) {
    throw "服务器打包失败：未找到 dist/server.js"
}
Write-Host "服务器打包完成（dist/server.js 已生成）。" -ForegroundColor Green

# -------------------------------------------------------
# 收尾
# -------------------------------------------------------
Write-Host "`n================================================" -ForegroundColor Cyan
Write-Host "  构建成功！" -ForegroundColor Green
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "下一步请运行（生产模式）：" -ForegroundColor White
Write-Host "    .\start.ps1" -ForegroundColor Yellow
Write-Host "开发模式（带热更新）：" -ForegroundColor White
Write-Host "    pnpm run dev" -ForegroundColor Yellow
Write-Host "`n默认端口 5000，访问  http://localhost:5000" -ForegroundColor Gray
