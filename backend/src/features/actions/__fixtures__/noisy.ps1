# Test fixture: floods stdout (about 1 MB), then prints a short last line.
$line = 'x' * 1000
for ($i = 0; $i -lt 1000; $i++) { Write-Output $line }
Write-Output 'noisy done'
