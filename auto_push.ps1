# Auto-Push Script (Runs every 15 minutes)
# Important: Git must be installed and configured on your system first.

Write-Host "Starting Auto-Push Script..."
Write-Host "This will commit and push changes every 15 minutes."

while ($true) {
    # Check for changes
    $status = git status --porcelain
    if ($status) {
        git add .
        $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
        git commit -m "Update: $timestamp"
        git push origin main
        Write-Host "Successfully committed and pushed at $timestamp"
    } else {
        Write-Host "No changes to commit at $(Get-Date -Format 'HH:mm:ss')."
    }
    
    Write-Host "Sleeping for 15 minutes..."
    Start-Sleep -Seconds 900
}
