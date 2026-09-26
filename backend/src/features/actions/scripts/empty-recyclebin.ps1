# Empty Recycle Bin: permanently deletes everything in the Recycle Bin on all drives.
# Cannot be undone, so the server only runs it with {"confirm": true} (registry.ts).
#
# -DryRun only counts what would be deleted. The server never passes it; it exists so
# tests can exercise the real code without destroying anything.
#
# Contract (see runner.ts): last stdout line is the summary; non-zero exit on failure.
param([switch]$DryRun)

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [Text.Encoding]::UTF8

try {
    # Shell namespace 10 is the Recycle Bin (all drives).
    $bin = (New-Object -ComObject Shell.Application).Namespace(10)
    $items = @($bin.Items())
    $count = $items.Count
    $bytes = [int64]0
    foreach ($item in $items) { $bytes += [int64]$item.Size }
    $mb = [math]::Round($bytes / 1MB, 1).ToString([Globalization.CultureInfo]::InvariantCulture)

    if ($count -eq 0) {
        Write-Output 'Recycle Bin is already empty'
        exit 0
    }
    if ($DryRun) {
        Write-Output "Dry run: would delete $count items ($mb MB)"
        exit 0
    }

    Clear-RecycleBin -Force -Confirm:$false
    Write-Output "Emptied the Recycle Bin: $count items ($mb MB)"
    exit 0
}
catch {
    [Console]::Error.WriteLine("Could not empty the Recycle Bin: $($_.Exception.Message)")
    exit 1
}
