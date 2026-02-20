# Phase 2-3 GitHub Issues - Quick Start

## 🎯 One-Command Creation

### Step 1: Authenticate (First Time Only)
```bash
gh auth login
```

### Step 2: Create All 4 Issues

**Git Bash / Linux / Mac:**
```bash
cd docs/github-issues
./create-issues.sh
```

**Windows PowerShell:**
```powershell
cd docs/github-issues
.\create-issues.ps1
```

---

## 📋 What Will Be Created

### Issue #1: Phase 2-3A Day 1 - Models + Migrations + Data Migration
- **Labels:** backend, database, migration, phase-2-3, critical
- **Milestone:** Phase 2-3 Refactor
- **Estimated Time:** 4-6 hours

### Issue #2: Phase 2-3A Day 2 - Backend Services + API
- **Labels:** backend, api, services, phase-2-3, critical
- **Milestone:** Phase 2-3 Refactor
- **Estimated Time:** 6-8 hours

### Issue #3: Phase 2-3A Day 3 - Frontend Costing UI
- **Labels:** frontend, ui, react, phase-2-3, critical
- **Milestone:** Phase 2-3 Refactor
- **Estimated Time:** 8 hours

### Issue #4: Phase 2-3B - Compare + Impact Detection (Optional)
- **Labels:** backend, frontend, enhancement, phase-2-3, optional
- **Milestone:** Phase 2-3 Refactor
- **Estimated Time:** 4-6 hours

---

## 🔍 Verify Creation

```bash
# List all Phase 2-3 issues
gh issue list --label phase-2-3

# Expected output:
# #4  Phase 2-3B - Compare + Impact Detection (Optional)
# #3  Phase 2-3A Day 3 - Frontend Costing UI
# #2  Phase 2-3A Day 2 - Backend Services + API
# #1  Phase 2-3A Day 1 - Models + Migrations + Data Migration
```

---

## 🚀 Start Implementation

After issues are created:

```bash
# Assign yourself to Issue #1
gh issue edit 1 --add-assignee @me

# Start working on Day 1
# Reference: docs/DAY-1-MIGRATION-MAPPING.md
```

---

## 📚 Reference Documents

- **Implementation Checklist:** `docs/PHASE-2-3-IMPLEMENTATION-CHECKLIST.md`
- **Day 1 Migration Guide:** `docs/DAY-1-MIGRATION-MAPPING.md`
- **Delivery Summary:** `docs/PHASE-2-3-DELIVERY-SUMMARY.md`

---

## ⚠️ Troubleshooting

**Problem:** `gh: command not found`
- **Solution:** Install GitHub CLI: https://cli.github.com/

**Problem:** `authentication failed`
- **Solution:** Run `gh auth login`

**Problem:** `milestone not found`
- **Solution:** Create milestone "Phase 2-3 Refactor" in GitHub UI first

**Problem:** Script fails on Windows
- **Solution:** Use Git Bash or PowerShell script instead

---

**Total Time Estimate:** 18-22 hours (2.5-3 days)
**Priority:** Critical (blocks Phase 3 Sample Request System)
