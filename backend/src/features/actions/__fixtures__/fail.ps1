# Test fixture: reports an error on stderr and exits with code 3.
Write-Output 'starting'
[Console]::Error.WriteLine('Something went wrong')
exit 3
