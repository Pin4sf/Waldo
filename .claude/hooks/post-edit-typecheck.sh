#!/bin/bash
# Run TypeScript check after editing .ts/.tsx files
TOOL_INPUT="$1"
FILE_PATH=$(echo "$TOOL_INPUT" | grep -oE '"file_path"\s*:\s*"[^"]*"' | head -1 | sed 's/.*"file_path"\s*:\s*"//;s/"$//')

if [[ "$FILE_PATH" == *.ts || "$FILE_PATH" == *.tsx ]]; then
  # Only run if tsconfig exists (project is initialized)
  if [ -f "/Users/shivansh.fulper/Github/personal/OneSync/tsconfig.json" ]; then
    cd /Users/shivansh.fulper/Github/personal/OneSync
    npx tsc --noEmit --pretty 2>&1 | head -20
  fi
fi
exit 0
