# Clear temp files: deletes old files from the user's temp folder and reports the space freed.
#
# Safety rules:
# - Only items not modified for -MinAgeHours (default 24h) are deleted, so files that
#   running programs are using right now are left alone.
# - Files that are locked or protected are skipped and counted, never an error.
# - Junctions and symbolic links are never followed or deleted: a link inside %TEMP%
#   could point at Documents or a whole drive.
# - A drive root or a missing folder is refused outright.
# The server always runs it without arguments (registry.ts), so it only ever cleans
# %TEMP%; -Path exists so tests can run it on a sandbox folder.
#
# Contract (see runner.ts): last stdout line is the summary; non-zero exit on failure.
param(
    [string]$Path = $env:TEMP,
    [ValidateRange(0, 8760)][int]$MinAgeHours = 24
)

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [Text.Encoding]::UTF8

try {
    if ([string]::IsNullOrWhiteSpace($Path) -or -not (Test-Path -LiteralPath $Path -PathType Container)) {
        throw "Temp folder not found: '$Path'"
    }
    $root = (Resolve-Path -LiteralPath $Path).ProviderPath.TrimEnd('\')
    if ($root.Length -le 3) {
        throw "Refusing to clean a drive root: '$root'"
    }
}
catch {
    [Console]::Error.WriteLine("Could not clear temp files: $($_.Exception.Message)")
    exit 1
}

$cutoff = (Get-Date).AddHours(-$MinAgeHours)
$script:freed = [int64]0
$script:deleted = 0
$script:skipped = 0

function Test-IsLink($item) {
    return [bool]($item.Attributes -band [IO.FileAttributes]::ReparsePoint)
}

function Clear-Folder([string]$dir) {
    foreach ($item in @(Get-ChildItem -LiteralPath $dir -Force -ErrorAction SilentlyContinue)) {
        if (Test-IsLink $item) { continue }

        if ($item.PSIsContainer) {
            # Read the age before emptying it: deleting children updates the timestamp.
            $wasOld = $item.LastWriteTime -lt $cutoff
            Clear-Folder $item.FullName
            $isEmpty = -not (Get-ChildItem -LiteralPath $item.FullName -Force -ErrorAction SilentlyContinue | Select-Object -First 1)
            if ($wasOld -and $isEmpty) {
                try { Remove-Item -LiteralPath $item.FullName -Force -ErrorAction Stop }
                catch { $script:skipped++ }
            }
        }
        elseif ($item.LastWriteTime -lt $cutoff) {
            try {
                $size = $item.Length
                Remove-Item -LiteralPath $item.FullName -Force -ErrorAction Stop
                $script:freed += $size
                $script:deleted++
            }
            catch { $script:skipped++ }
        }
    }
}

Clear-Folder $root

$mb = [math]::Round($script:freed / 1MB, 1).ToString([Globalization.CultureInfo]::InvariantCulture)
Write-Output "Freed $mb MB from $($script:deleted) files ($($script:skipped) skipped: in use or protected)"
exit 0
