# Test fixture: prints every argument it received, then a JSON summary line.
[Console]::OutputEncoding = [Text.Encoding]::UTF8
foreach ($a in $args) { Write-Output "ARG:$a" }
Write-Output (ConvertTo-Json -Compress @($args))
