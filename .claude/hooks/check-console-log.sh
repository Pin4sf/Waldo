#!/bin/bash
# Warn about console.log in modified files after each response
cd /Users/shivansh.fulper/Github/personal/OneSync

# Only check if git is initialized and there are modified files
if [ -d ".git" ]; then
  MODIFIED=$(git diff --name-only 2>/dev/null | grep -E '\.(ts|tsx|js|jsx)$')
  if [ -n "$MODIFIED" ]; then
    FOUND=$(echo "$MODIFIED" | xargs grep -n "console\.log" 2>/dev/null)
    if [ -n "$FOUND" ]; then
      echo "WARNING: console.log found in modified files:"
      echo "$FOUND" | head -10
    fi
  fi
fi
exit 0
