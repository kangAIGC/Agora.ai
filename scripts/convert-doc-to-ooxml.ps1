# Batch convert binary OLE2 .doc files to OOXML format (keep .doc filename)
# Word 2007 COM degrades after one SaveAs+Close, so we use a FRESH Word instance per file.

$ErrorActionPreference = 'Continue'

$root = Join-Path $PSScriptRoot '..'
$pubDir = Join-Path $root 'public'
$dirs = @(
    (Join-Path $pubDir 'mock-arch'),
    (Join-Path $pubDir 'mock-dianshang'),
    (Join-Path $pubDir 'mock-manju')
)

function Get-DocMagic {
    param([string]$Path)
    if (-not (Test-Path $Path)) { return 'missing' }
    $bytes = [System.IO.File]::ReadAllBytes($Path)
    if ($bytes.Length -lt 4) { return 'toosmall' }
    if ($bytes[0] -eq 0x50 -and $bytes[1] -eq 0x4B) { return 'ooxml' }
    if ($bytes[0] -eq 0xD0 -and $bytes[1] -eq 0xCF) { return 'ole2' }
    if ($bytes[0] -eq 0x3C) { return 'html' }
    return 'unknown'
}

$wdFormatXMLDocument = 12

function Convert-One {
    param([string]$Source, [string]$TempDest)
    $word = New-Object -ComObject Word.Application
    $word.Visible = $false
    $word.DisplayAlerts = 0
    $doc = $null
    $ok = $false
    try {
        $doc = $word.Documents.Open($Source)
        if ($null -eq $doc) { return $false }
        # Validate the doc is usable
        $null = $doc.FullName  # read a property to confirm the COM ref is live
        $doc.SaveAs($TempDest, $wdFormatXMLDocument)
        $ok = $true
    } catch {
        Write-Output "    inner error: $($_.Exception.Message)"
        $ok = $false
    } finally {
        if ($doc) {
            try { $doc.Close(0) } catch {}
            try { [System.Runtime.InteropServices.Marshal]::ReleaseComObject($doc) | Out-Null } catch {}
        }
        try { $word.Quit() } catch {}
        try { [System.Runtime.InteropServices.Marshal]::ReleaseComObject($word) | Out-Null } catch {}
        [GC]::Collect()
        [GC]::WaitForPendingFinalizers()
        Start-Sleep -Milliseconds 400
    }
    return $ok
}

foreach ($dir in $dirs) {
    if (-not (Test-Path $dir)) { Write-Output "DIR MISSING: $dir"; continue }
    $files = Get-ChildItem -Path $dir -Filter '*.doc' -ErrorAction SilentlyContinue
    Write-Output "Dir has $($files.Count) .doc files: $dir"
    foreach ($f in $files) {
        $magic = Get-DocMagic -Path $f.FullName
        if ($magic -ne 'ole2') {
            Write-Output "[SKIP] $($f.Name) (already $magic)"
            continue
        }
        Write-Output "[CONVERT] $($f.Name) size=$($f.Length)"
        $tempDocx = [System.IO.Path]::Combine($f.DirectoryName, ($f.BaseName + '.__tmp__.docx'))
        if (Test-Path $tempDocx) { Remove-Item $tempDocx -Force -ErrorAction SilentlyContinue }
        $ok = Convert-One -Source $f.FullName -TempDest $tempDocx
        if ($ok -and (Test-Path $tempDocx)) {
            Copy-Item -Path $tempDocx -Destination $f.FullName -Force
            Remove-Item -Path $tempDocx -Force -ErrorAction SilentlyContinue
            $newMagic = Get-DocMagic -Path $f.FullName
            Write-Output "  -> DONE: $newMagic size=$((Get-Item $f.FullName).Length)"
        } else {
            Write-Output "  -> FAILED"
            if (Test-Path $tempDocx) { Remove-Item $tempDocx -Force -ErrorAction SilentlyContinue }
        }
    }
}

Write-Output ""
Write-Output "=== Final state ==="
foreach ($dir in $dirs) {
    if (-not (Test-Path $dir)) { continue }
    $files = Get-ChildItem -Path $dir -Filter '*.doc*' -ErrorAction SilentlyContinue
    foreach ($f in $files) {
        $magic = Get-DocMagic -Path $f.FullName
        Write-Output ("{0,-10} {1}" -f $magic, $f.Name)
    }
}
