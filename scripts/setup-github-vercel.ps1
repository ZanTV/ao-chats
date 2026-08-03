# AO Chats v2 — GitHub + Vercel setup (run after: gh auth login)
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $Root

$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")

Write-Host "Checking GitHub auth..."
gh auth status
if ($LASTEXITCODE -ne 0) {
  Write-Host "Run first: gh auth login -h github.com -p https -w"
  exit 1
}

$RepoName = "ao-chats-v2"
$User = (gh api user -q .login)
$Remote = "https://github.com/$User/$RepoName.git"

Write-Host "Creating GitHub repo: $User/$RepoName"
gh repo create $RepoName --private --source=. --remote=origin --push --description "AO Chats v2 - Full stack chat application"

Write-Host "Connecting Vercel to GitHub..."
vercel link --project mobile --yes
vercel git connect $Remote

Write-Host ""
Write-Host "Done! Set Vercel Root Directory to 'mobile' in project settings if builds fail:"
Write-Host "https://vercel.com/ortoman95-9322s-projects/mobile/settings"
Write-Host ""
Write-Host "Frontend: https://www.aochats.chat"
Write-Host "API:      https://api.aochats.chat"
