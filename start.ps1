# ============================================================
# ArchDesign.ai - Windows 一键启动脚本（生产模式）
# 用法：
#   .\start.ps1                  # 默认端口 5000
#   .\start.ps1 -Port 8080       # 指定端口
#   .\start.ps1 -KillExisting    # 启动前先清理同端口进程
# ============================================================

[CmdletBinding()]
param(
    [int]$Port = 5000,
    [switch]$KillExisting
)

$ErrorActionPreference = "Stop"

# 切换到脚本所在目录（项目根目录）
Set-Location $PSScriptRoot
Write-Host "`n=== ArchDesign.ai 启动（生产模式）===" -ForegroundColor Cyan
Write-Host "工作目录: $(Get-Location)" -ForegroundColor Gray

# -------------------------------------------------------
# 0. 检查构建产物是否存在
# -------------------------------------------------------
if (-not (Test-Path "dist/server.js")) {
    Write-Warning "未找到 dist/server.js，是否未构建？"
    $choice = Read-Host "是否立即执行构建？ [Y/N] （默认 Y）"
    if ($choice -ne "N" -and $choice -ne "n") {
        Write-Host "开始构建..." -ForegroundColor Yellow
        & "$PSScriptRoot\build.ps1"
        if (-not (Test-Path "dist/server.js")) {
            throw "构建后仍未找到 dist/server.js，启动终止。"
        }
    } else {
        throw "启动终止：请先运行 .\build.ps1"
    }
}

if (-not (Test-Path ".next")) {
    Write-Warning "未检测到 .next/ 构建产物，首次运行可能页面加载失败。建议先执行 .\build.ps1"
}

# -------------------------------------------------------
# 1. 清理占用端口的进程（可选）
# -------------------------------------------------------
if ($KillExisting) {
    Write-Host "`n检查端口 $Port 占用情况..." -ForegroundColor Yellow
    $portInUse = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue
    if ($portInUse) {
        $pids = $portInUse | Select-Object -ExpandProperty OwningProcess -Unique
        Write-Host "端口 $Port 被以下 PID 占用： $pids"
        foreach ($pid in $pids) {
            try {
                Stop-Process -Id $pid -Force -ErrorAction Stop
                Write-Host "  已终止进程 PID=$pid" -ForegroundColor Gray
            } catch {
                Write-Warning "  无法终止 PID=$pid ：$($_.Exception.Message)"
            }
        }
        Start-Sleep -Seconds 2
    } else {
        Write-Host "端口 $Port 空闲。" -ForegroundColor Green
    }
} else {
    # 即使不 Kill，也做一次快速检查并提示
    $portInUse = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue
    if ($portInUse) {
        $pids = $portInUse | Select-Object -ExpandProperty OwningProcess -Unique
        Write-Warning "端口 $Port 已被 PID=$pids 占用，启动可能失败。使用 -KillExisting 参数强制清理，或使用其他端口："
        Write-Host "    .\start.ps1 -Port 8080" -ForegroundColor Yellow
    }
}

# -------------------------------------------------------
# 2. 启动 Node 生产服务器
# -------------------------------------------------------
$env:PORT = [string]$Port
$env:HOSTNAME = "localhost"
$env:COZE_PROJECT_ENV = "PROD"

Write-Host "`n正在启动生产服务器： PORT=$Port  COZE_PROJECT_ENV=PROD" -ForegroundColor Yellow
Write-Host "Node 进程启动后，使用 Ctrl+C 停止。" -ForegroundColor Gray
Write-Host "浏览器访问： http://localhost:$Port" -ForegroundColor Cyan
Write-Host "`n-------------------------------------------------" -ForegroundColor DarkGray

try {
    node dist/server.js
} catch {
    Write-Error "服务器进程异常退出： $($_.Exception.Message)"
    exit 1
}
