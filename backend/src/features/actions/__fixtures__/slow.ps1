# Test fixture: prints its PID, then hangs so the runner has to time it out.
Write-Output "PID:$PID"
Start-Sleep -Seconds 60
Write-Output 'should never get here'
