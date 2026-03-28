#!/bin/bash
# Run TypeScript check after editing .ts/.tsx files
TOOL_INPUT="$1"
FILE_PATH=$(echo "$TOOL_INPUT" | grep -oE '"file_path"\s*:\s*"[^"]*"' | head -1 | sed 's/.*"file_path"\s*:\s*"//;s/"$//')

if [[ "$FILE_PATH" == *.ts || "$FILE_PATH" == *.tsx ]]; then
  # Resolve project root relative to this script
  PROJECT_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
  if [ -f "$PROJECT_ROOT/tsconfig.json" ]; then
    cd "$PROJECT_ROOT"
    npx tsc --noEmit --pretty 2>&1 | head -20
  fi
fi
exit 0
