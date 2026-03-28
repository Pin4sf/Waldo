#!/bin/bash
# Warn about console.log in modified files after each response
PROJECT_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$PROJECT_ROOT"

if [ -d ".git" ]; then
  # Check both staged and unstaged changes
  MODIFIED=$(git diff --name-only --diff-filter=d 2>/dev/null; git diff --cached --name-only --diff-filter=d 2>/dev/null)
  MODIFIED=$(echo "$MODIFIED" | sort -u | grep -E '\.(ts|tsx|js|jsx)$')
  if [ -n "$MODIFIED" ]; then
    FOUND=$(echo "$MODIFIED" | xargs grep -n "console\.log" 2>/dev/null)
    if [ -n "$FOUND" ]; then
      echo "WARNING: console.log found in modified files:"
      echo "$FOUND" | head -10
    fi
  fi
fi
exit 0
