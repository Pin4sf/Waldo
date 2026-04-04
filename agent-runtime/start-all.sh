#!/bin/bash
# Waldo — start all 5 user agents on Windows WSL2 / Linux
# Each agent gets its own process, its own SQLite workspace, its own memory
#
# Setup (run once in WSL2):
#   sudo apt install nodejs npm sqlite3
#   cd ~/waldo-agents && npm install
#   cp .env.example .env && fill in your keys
#
# Usage:
#   bash start-all.sh
#   bash start-all.sh stop

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_DIR="$HOME/waldo-logs"
PID_DIR="$HOME/waldo-pids"

mkdir -p "$LOG_DIR" "$PID_DIR"

# Load env
if [ -f "$SCRIPT_DIR/.env" ]; then
  export $(grep -v '^#' "$SCRIPT_DIR/.env" | xargs)
fi

# ─── USER CONFIG ─────────────────────────────────────────────────
# Add each user: ID and name
# Get user IDs from Supabase dashboard → Table Editor → users

declare -A USERS=(
  ["ark"]="00000000-0000-0000-0000-000000000001"
  # Add your team:
  # ["shivansh"]="<uuid-from-supabase>"
  # ["suyash"]="<uuid-from-supabase>"
  # ["user4"]="<uuid>"
  # ["user5"]="<uuid>"
)

# ─── STOP ────────────────────────────────────────────────────────
if [ "$1" = "stop" ]; then
  echo "Stopping all Waldo agents..."
  for name in "${!USERS[@]}"; do
    PID_FILE="$PID_DIR/waldo-$name.pid"
    if [ -f "$PID_FILE" ]; then
      PID=$(cat "$PID_FILE")
      kill "$PID" 2>/dev/null && echo "  Stopped $name (PID $PID)" || echo "  $name already stopped"
      rm -f "$PID_FILE"
    fi
  done
  echo "Done."
  exit 0
fi

# ─── START ────────────────────────────────────────────────────────
echo "Starting Waldo agents..."
for name in "${!USERS[@]}"; do
  USER_ID="${USERS[$name]}"
  LOG_FILE="$LOG_DIR/waldo-$name.log"
  PID_FILE="$PID_DIR/waldo-$name.pid"

  # Kill existing if running
  if [ -f "$PID_FILE" ]; then
    OLD_PID=$(cat "$PID_FILE")
    kill "$OLD_PID" 2>/dev/null || true
  fi

  # Start agent
  node "$SCRIPT_DIR/agent-loop.js" \
    --user-id="$USER_ID" \
    --name="$name" \
    --interval-minutes=15 \
    >> "$LOG_FILE" 2>&1 &

  echo $! > "$PID_FILE"
  echo "  Started $name (PID $!, log: $LOG_FILE)"
done

echo ""
echo "All agents running. Commands:"
echo "  tail -f $LOG_DIR/waldo-ark.log   # watch Ark's agent"
echo "  bash start-all.sh stop           # stop all"
echo ""
echo "Agent workspaces: ~/waldo-workspaces/<user-id>/memory.db"
