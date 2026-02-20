# Phase 2-3 GitHub Issues 一键创建脚本（PowerShell）
# 使用方式：
#   1. 安装 GitHub CLI: winget install GitHub.cli
#   2. 登录：gh auth login
#   3. 运行：cd docs/github-issues && .\create-issues.ps1

# 检查 gh CLI 是否安装
if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
    Write-Host "错误：未安装 GitHub CLI" -ForegroundColor Red
    Write-Host "请运行：winget install GitHub.cli" -ForegroundColor Yellow
    exit 1
}

# 检查是否已登录
$authStatus = gh auth status 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "错误：未登录 GitHub CLI" -ForegroundColor Red
    Write-Host "请运行：gh auth login" -ForegroundColor Yellow
    exit 1
}

Write-Host "开始创建 Phase 2-3 GitHub Issues..." -ForegroundColor Green

# Issue #1: Day 1 - Models + Migrations
Write-Host "`n创建 Issue #1: Day 1 - Models + Migrations" -ForegroundColor Cyan
gh issue create `
  --title "Phase 2-3A Day 1 - Models + Migrations + Data Migration" `
  --label "backend,database,migration,phase-2-3,critical" `
  --milestone "Phase 2-3 Refactor" `
  --body-file "issue-1-day1-models-migrations.md"

if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Issue #1 创建成功" -ForegroundColor Green
} else {
    Write-Host "✗ Issue #1 创建失败" -ForegroundColor Red
    exit 1
}

# Issue #2: Day 2 - Backend Services + API
Write-Host "`n创建 Issue #2: Day 2 - Backend Services + API" -ForegroundColor Cyan
gh issue create `
  --title "Phase 2-3A Day 2 - Backend Services + API" `
  --label "backend,api,services,phase-2-3,critical" `
  --milestone "Phase 2-3 Refactor" `
  --body-file "issue-2-day2-backend-services-api.md"

if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Issue #2 创建成功" -ForegroundColor Green
} else {
    Write-Host "✗ Issue #2 创建失败" -ForegroundColor Red
    exit 1
}

# Issue #3: Day 3 - Frontend Costing UI
Write-Host "`n创建 Issue #3: Day 3 - Frontend Costing UI" -ForegroundColor Cyan
gh issue create `
  --title "Phase 2-3A Day 3 - Frontend Costing UI" `
  --label "frontend,ui,react,phase-2-3,critical" `
  --milestone "Phase 2-3 Refactor" `
  --body-file "issue-3-day3-frontend-costing-ui.md"

if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Issue #3 创建成功" -ForegroundColor Green
} else {
    Write-Host "✗ Issue #3 创建失败" -ForegroundColor Red
    exit 1
}

# Issue #4: Day 4 - Compare + Impact Detection (Optional)
Write-Host "`n创建 Issue #4: Day 4 - Compare + Impact Detection (Optional)" -ForegroundColor Cyan
gh issue create `
  --title "Phase 2-3B - Compare + Impact Detection (Optional)" `
  --label "backend,frontend,enhancement,phase-2-3,optional" `
  --milestone "Phase 2-3 Refactor" `
  --body-file "issue-4-day4-compare-impact.md"

if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Issue #4 创建成功" -ForegroundColor Green
} else {
    Write-Host "✗ Issue #4 创建失败" -ForegroundColor Red
    exit 1
}

Write-Host "`n" -NoNewline
Write-Host "✓ 所有 Issues 创建成功！" -ForegroundColor Green -BackgroundColor DarkGreen
Write-Host "`n查看 Issues: gh issue list --label phase-2-3" -ForegroundColor Yellow
