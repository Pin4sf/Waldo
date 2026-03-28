#!/bin/bash
# Auto-format JS/TS files after Write/Edit using Prettier
TOOL_INPUT="$1"
FILE_PATH=$(echo "$TOOL_INPUT" | grep -oE '"file_path"\s*:\s*"[^"]*"' | head -1 | sed 's/.*"file_path"\s*:\s*"//;s/"$//')

if [[ "$FILE_PATH" == *.ts || "$FILE_PATH" == *.tsx || "$FILE_PATH" == *.js || "$FILE_PATH" == *.jsx || "$FILE_PATH" == *.json ]]; then
  if [ -f "$FILE_PATH" ]; then
    npx prettier --write "$FILE_PATH" 2>/dev/null || true
  fi
fi
exit 0
