# Kill process: force-stops one process by PID. Unsaved work in it is lost, so the
# server only runs it with {"confirm": true} and after its own PID checks (B-52).
#
# Second line of defense: processes Windows can't live without are refused here too,
# whatever the caller checked. Killing csrss, wininit or lsass crashes or reboots the
# machine.
#
# Exit codes: 0 stopped, 1 failed (not found, access denied...), 2 refused (critical).
# Contract (see runner.ts): last stdout line is the summary.
param(
    [Parameter(Mandatory = $true)]
    [ValidateRange(1, [int]::MaxValue)]
    [int]$ProcessId
)

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [Text.Encoding]::UTF8

$critical = @(
    'System', 'Idle', 'Registry', 'Secure System', 'Memory Compression',
    'smss', 'csrss', 'wininit', 'winlogon', 'services', 'lsass', 'lsaiso',
    'svchost', 'fontdrvhost', 'dwm', 'MsMpEng'
)

try {
    $process = Get-Process -Id $ProcessId -ErrorAction SilentlyContinue
    if (-not $process) {
        [Console]::Error.WriteLine("No process with PID $ProcessId")
        exit 1
    }

    $name = $process.ProcessName
    if ($critical -contains $name) {
        [Console]::Error.WriteLine("Refusing to stop critical system process $name (PID $ProcessId)")
        exit 2
    }

    Stop-Process -Id $ProcessId -Force
    # Stop-Process returns before the process is gone, so wait briefly to report truthfully.
    # HasExited is the reliable check: a dead process can still be listed by Get-Process
    # while its parent holds a handle to it.
    [void]$process.WaitForExit(5000)
    if (-not $process.HasExited) {
        [Console]::Error.WriteLine("$name (PID $ProcessId) is still running after the stop request")
        exit 1
    }

    Write-Output "Stopped $name (PID $ProcessId)"
    exit 0
}
catch {
    [Console]::Error.WriteLine("Could not stop PID ${ProcessId}: $($_.Exception.Message)")
    exit 1
}
