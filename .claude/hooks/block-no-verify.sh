#!/bin/bash
# Block --no-verify flag on git commits to protect pre-commit hooks
TOOL_INPUT="$1"
if echo "$TOOL_INPUT" | grep -q "\-\-no-verify"; then
  echo "BLOCKED: --no-verify is not allowed. Fix the underlying issue instead of skipping hooks."
  exit 2
fi
exit 0
