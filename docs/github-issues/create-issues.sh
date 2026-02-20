#!/bin/bash
# Phase 2-3 GitHub Issues 一键创建脚本（Bash）
# 使用方式：
#   1. 安装 GitHub CLI: https://cli.github.com/
#   2. 登录：gh auth login
#   3. 运行：cd docs/github-issues && chmod +x create-issues.sh && ./create-issues.sh

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# 检查 gh CLI 是否安装
if ! command -v gh &> /dev/null; then
    echo -e "${RED}错误：未安装 GitHub CLI${NC}"
    echo -e "${YELLOW}请访问：https://cli.github.com/${NC}"
    exit 1
fi

# 检查是否已登录
if ! gh auth status &> /dev/null; then
    echo -e "${RED}错误：未登录 GitHub CLI${NC}"
    echo -e "${YELLOW}请运行：gh auth login${NC}"
    exit 1
fi

echo -e "${GREEN}开始创建 Phase 2-3 GitHub Issues...${NC}"

# Issue #1: Day 1 - Models + Migrations
echo -e "\n${CYAN}创建 Issue #1: Day 1 - Models + Migrations${NC}"
gh issue create \
  --title "Phase 2-3A Day 1 - Models + Migrations + Data Migration" \
  --label "backend,database,migration,phase-2-3,critical" \
  --milestone "Phase 2-3 Refactor" \
  --body-file "issue-1-day1-models-migrations.md"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Issue #1 创建成功${NC}"
else
    echo -e "${RED}✗ Issue #1 创建失败${NC}"
    exit 1
fi

# Issue #2: Day 2 - Backend Services + API
echo -e "\n${CYAN}创建 Issue #2: Day 2 - Backend Services + API${NC}"
gh issue create \
  --title "Phase 2-3A Day 2 - Backend Services + API" \
  --label "backend,api,services,phase-2-3,critical" \
  --milestone "Phase 2-3 Refactor" \
  --body-file "issue-2-day2-backend-services-api.md"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Issue #2 创建成功${NC}"
else
    echo -e "${RED}✗ Issue #2 创建失败${NC}"
    exit 1
fi

# Issue #3: Day 3 - Frontend Costing UI
echo -e "\n${CYAN}创建 Issue #3: Day 3 - Frontend Costing UI${NC}"
gh issue create \
  --title "Phase 2-3A Day 3 - Frontend Costing UI" \
  --label "frontend,ui,react,phase-2-3,critical" \
  --milestone "Phase 2-3 Refactor" \
  --body-file "issue-3-day3-frontend-costing-ui.md"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Issue #3 创建成功${NC}"
else
    echo -e "${RED}✗ Issue #3 创建失败${NC}"
    exit 1
fi

# Issue #4: Day 4 - Compare + Impact Detection (Optional)
echo -e "\n${CYAN}创建 Issue #4: Day 4 - Compare + Impact Detection (Optional)${NC}"
gh issue create \
  --title "Phase 2-3B - Compare + Impact Detection (Optional)" \
  --label "backend,frontend,enhancement,phase-2-3,optional" \
  --milestone "Phase 2-3 Refactor" \
  --body-file "issue-4-day4-compare-impact.md"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Issue #4 创建成功${NC}"
else
    echo -e "${RED}✗ Issue #4 创建失败${NC}"
    exit 1
fi

echo -e "\n${GREEN}✓ 所有 Issues 创建成功！${NC}"
echo -e "${YELLOW}\n查看 Issues: gh issue list --label phase-2-3${NC}"
