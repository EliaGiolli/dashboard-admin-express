# Flush DNS cache: clears the Windows DNS resolver cache.
# Harmless: cached names are simply resolved again on next use.
# Contract (see runner.ts): last stdout line is the summary; non-zero exit on failure.
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [Text.Encoding]::UTF8

try {
    $before = @(Get-DnsClientCache -ErrorAction SilentlyContinue).Count
    Clear-DnsClientCache
    Write-Output "DNS cache flushed ($before cached entries cleared)"
    exit 0
}
catch {
    [Console]::Error.WriteLine("Could not flush the DNS cache: $($_.Exception.Message)")
    exit 1
}
