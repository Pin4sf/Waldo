# Claude Code Internals - Complete Documentation Extract

> Source: https://www.mintlify.com/VineeTagarwaL-code/claude-code/
> Extracted: 2026-03-31
> Pages fetched: 15+ documentation pages covering all major sections

---

# TABLE OF CONTENTS

1. [Introduction](#introduction)
2. [How Claude Code Works (Core Architecture)](#how-claude-code-works)
3. [The Agentic Loop](#the-agentic-loop)
4. [Context Loading](#context-loading)
5. [Tool Execution Model](#tool-execution-model)
6. [Tools Reference](#tools-reference)
7. [Memory and Context (CLAUDE.md)](#memory-and-context)
8. [Permissions System](#permissions-system)
9. [Hooks System](#hooks-system)
10. [Multi-Agent Workflows](#multi-agent-workflows)
11. [Skills System](#skills-system)
12. [MCP Server Integration](#mcp-server-integration)
13. [Settings Configuration](#settings-configuration)
14. [Environment Variables](#environment-variables)
15. [Authentication](#authentication)
16. [CLI Flags Reference](#cli-flags-reference)
17. [Slash Commands Reference](#slash-commands-reference)
18. [SDK Overview (Control Protocol)](#sdk-overview)
19. [Hooks Reference (Detailed)](#hooks-reference-detailed)
20. [Permissions API (Detailed)](#permissions-api-detailed)

---

# INTRODUCTION

Claude Code is an AI coding agent that runs in your terminal -- reading, editing, and executing code across your entire codebase. It provides terminal-based AI capabilities built on Claude with direct filesystem, shell, and tool access. Users describe tasks in plain language while Claude manages implementation without requiring copy-pasting or context switching.

## Core Capabilities

- **File Operations**: Read source files, write new content, perform targeted edits with diffs displayed before application
- **Shell Command Execution**: Execute tests, build scripts, git operations, and shell commands with configurable permission controls
- **Codebase Search**: Find files using glob patterns, search content with regular expressions, navigate large codebases efficiently
- **Web Fetching**: Pull documentation, read API specifications, search the web without leaving terminal sessions
- **Sub-Agent Spawning**: Break complex tasks into parallel workstreams with multiple coordinated agents
- **MCP Server Integration**: Extend capabilities through Model Context Protocol servers for databases, APIs, and internal tools

## Prerequisites

- Node.js 18 or higher
- npm
- Install: `npm install -g @anthropic-ai/claude-code`

---

# HOW CLAUDE CODE WORKS

Claude Code operates as a terminal-based coding agent executing "a continuous agentic loop: it reads your request, reasons about what to do, calls tools, observes results, and repeats until the task is complete or it needs your input."

## The Agentic Loop

The fundamental cycle consists of six sequential steps:

### Step 1: User sends a message
Input arrives via terminal (interactive) or via `--print`/stdin (non-interactive/headless). The message gets appended to conversation history.

### Step 2: Context is assembled
A system prompt is built including: current date, git status (branch, recent commits, working-tree status), loaded CLAUDE.md memory files, and available tools. Context is memoized and built once per conversation (referenced in `context.ts`).

### Step 3: Claude reasons and selects tools
The conversation is sent to the Anthropic API. The model reasons about the task and emits one or more `tool_use` blocks with tool name and structured JSON input.

### Step 4: Permission check
Before executing each tool call, Claude Code evaluates the permission mode and allow/deny rules. Tools may be auto-approved, require confirmation, or be blocked entirely.

### Step 5: Tool executes and returns a result
Approved tools run. Results (file contents, command output, search hits) are appended as `tool_result` blocks to the conversation.

### Step 6: Loop continues
The model receives tool results and either calls additional tools or produces a final text response. This cycle repeats until no tool calls remain in a model turn.

**Critical Note**: "The loop runs entirely in your terminal process. There is no remote execution server -- your files, shell, and credentials never leave your machine unless a tool explicitly sends them (e.g., WebFetch, WebSearch, or an MCP server)."

---

# CONTEXT LOADING

Two context blocks are prepended to every API call:

## System Context (assembled by `getSystemContext()` in `context.ts`)

- **Git status**: current branch, default/main branch, git username, `git status --short` output (truncated to 2,000 characters if larger), and the last 5 commits from `git log --oneline`
- **Cache-breaking injection**: an optional ephemeral string for debugging prompt cache
- Git status is skipped when `CLAUDE_CODE_REMOTE=1` is set or when git instructions are disabled in settings

## User Context (assembled by `getUserContext()` in `context.ts`)

- **CLAUDE.md memory files**: discovered through 4-level hierarchy (managed -> user -> project -> local). Disabled by `CLAUDE_CODE_DISABLE_CLAUDE_MDS=1` or in bare mode without explicit `--add-dir`
- **Current date**: injected as `Today's date is YYYY-MM-DD` so the model knows the current date

Both blocks are **memoized** for the conversation duration using `lodash/memoize`. Calling `setSystemPromptInjection()` clears the caches immediately.

---

# TOOL EXECUTION MODEL

Claude Code doesn't execute tools autonomously by default. Each tool has a `checkPermissions` method determining what happens next:

| Permission result | Action |
|---|---|
| `allow` | Tool runs immediately; result appended to conversation |
| `ask` | Claude Code pauses and renders a confirmation dialog |
| `deny` | Tool call is rejected; Claude receives an error result |

Permission behavior is controlled by the active permission mode and configured allow/deny rules. In `bypassPermissions` mode all checks are skipped. In `acceptEdits` mode file-edit tools are auto-approved but bash commands still prompt. Read-only tools (e.g., Read, Glob, Grep) are generally auto-approved across all modes.

## Interactive vs. Non-Interactive Mode

**Interactive (REPL) mode**: The default experience. Claude Code renders a live terminal UI using React/Ink. Users see streaming output, tool-use confirmations, and spinner animations as the agent works.

**Non-interactive / print mode**: Activated with `--print` or by piping stdin. No UI is rendered. Output writes to stdout for script or CI pipeline capture.

## The Query Engine

Each "turn" in the agentic loop is driven by a **query** -- a call to `query.ts` that sends the current message list to the Anthropic API and streams the response back. The query engine handles:

- Streaming token output to terminal in real time
- Dispatching `tool_use` blocks to appropriate tool handlers
- Enforcing per-turn token and tool-call budgets
- Collecting tool results and appending them before the next model call
- Triggering compaction when the context window fills up

Each tool has a `maxResultSizeChars` property. When results exceed this limit, content is saved to a temporary file and the model receives a preview with the file path, preventing context-window overflow from large outputs.

## Conversation Storage and Resumption

Conversations are stored as JSON transcript files on disk (in `~/.claude/` by default). Each conversation has a unique session ID. Previous conversations can be resumed with `--resume <session-id>` or by selecting from a list using `--resume` alone.

When resuming:
- The full message history is loaded from disk
- Memory files are re-discovered and may differ from initial conversation start
- The permission mode resets to the configured default unless persisted in the session

**Note**: "Long conversations are periodically **compacted** -- the oldest messages are summarised to keep the context window manageable. The full raw transcript is always preserved on disk; compaction only affects what is sent to the API."

---

# TOOLS REFERENCE

Claude Code gives Claude a set of built-in tools it can call to interact with your machine. Each tool call is subject to the active permission mode and rules.

## File Tools

### Read
Read a file from the local filesystem. Reads up to 2,000 lines by default. Supports `offset` and `limit` for targeted reads. Returns content in `cat -n` format with line numbers. Also supports reading images (PNG, JPG), PDF files (up to 20 pages at a time), and Jupyter notebooks (.ipynb). Read-only. Always auto-approved in default mode.

### Edit
Perform exact string replacements in a file. Requires a prior Read call on the file in the same conversation. Replaces `old_string` with `new_string` -- the match must be unique in the file. Use `replace_all: true` to rename across the entire file. Fails if `old_string` appears more than once (unless `replace_all` is set).

### Write
Create a new file or completely overwrite an existing one. For existing files, a prior Read call is required. Prefer Edit for modifying existing files -- Write sends the entire file content and is better suited for new files or full rewrites.

### Glob
Find files by name pattern. Fast pattern matching that works on any codebase size. Returns matching file paths sorted by modification time (most recently modified first). Supports patterns like `**/*.ts`, `src/**/*.test.js`, `**/CLAUDE.md`. Read-only. Always auto-approved.

## Shell Tool

### Bash
Execute a shell command in a persistent shell session. Runs in a shell that persists across tool calls within a conversation -- environment variables and working-directory changes carry over between calls.

Key behaviors:
- **Compound commands** (`&&`, `||`, `;`, `|`) are parsed and each sub-command is permission-checked independently
- **Background execution** -- pass `run_in_background: true` to run a long-running command without blocking
- **Output limits** -- stdout/stderr is truncated if it exceeds the per-tool result size budget; a preview and file path are returned instead
- **Search commands** (find, grep, rg) -- for content search, prefer the dedicated Grep tool

Subject to permission prompts in default mode.

## Search Tools

### Grep
Search file contents using regular expressions. Built on ripgrep. Supports full regex syntax, file-type filtering, and three output modes:
- `files_with_matches` (default) -- returns only file paths
- `content` -- returns matching lines with context
- `count` -- returns match counts per file

Multiline patterns supported with `multiline: true`. Read-only. Always auto-approved.

### LS
List directory contents. Returns files and subdirectories in a structured format. Read-only. Always auto-approved.

## Web Tools

### WebFetch
Fetch a URL and extract information from it. Takes a URL and a prompt describing what to extract. Converts HTML to Markdown, then passes content through a secondary model. Features: HTTP auto-upgrade to HTTPS, 15-minute self-cleaning cache, redirect handling. Read-only. Prompts for approval in default mode.

### WebSearch
Search the web and return results. Returns search results with titles, snippets, and URLs. Automatically appends a Sources section. Domain filtering supported. Currently only available in the US. Prompts for approval in default mode.

## Agent and Task Tools

### Task (Agent)
Spawn a sub-agent to complete a task. Starts a nested agentic loop in a separate context. The sub-agent has its own conversation history, its own tool set (optionally restricted), and runs to completion before returning a result to the parent agent.

Sub-agents can run:
- **Locally** -- in-process, sharing the parent's filesystem and shell
- **Remotely** -- on separate compute when remote agent eligibility criteria are met

Use Task for open-ended multi-step searches, parallel workstreams, or delegating distinct sub-problems to isolated agents.

### TodoWrite
Create and manage a structured task list. Writes a list of todo items with statuses (pending, in_progress, completed) to a persistent panel in the terminal UI. Helps Claude track progress on complex multi-step tasks.

## MCP Tools

MCP servers can expose additional tools to Claude Code. Connected tools appear alongside built-in tools and follow the same permission system. Named with `mcp__` prefix: `mcp__<server-name>__<tool-name>`.

To deny all tools from a specific MCP server:
```json
{
  "permissions": {
    "deny": ["mcp__untrusted-server"]
  }
}
```

## Notebook Tool

### NotebookEdit
Edit cells in a Jupyter notebook. Allows inserting, replacing, or deleting cells in a .ipynb file with line-level precision.

## Tool Availability

Not all tools are available in every context:
- `CLAUDE_CODE_SIMPLE=1` -- restricts to Bash, Read, and Edit only
- Permission deny rules -- tools blanket-denied are removed from the tool list before the model sees them
- `isEnabled()` checks -- each tool can self-disable based on environment conditions
- MCP server connection state -- MCP tools only available when server is running and connected
- Inspect active tool set with `/tools` command

---

# MEMORY AND CONTEXT

Claude Code implements a layered memory system based on plain Markdown files that allows customization at global, project, and user levels.

## 4-Level Memory Hierarchy

### Level 1: Managed Memory (Lowest Priority)
- **Path**: `/etc/claude-code/CLAUDE.md` (platform-configured equivalent)
- System-wide administrator-set instructions applying to all machine users
- Supports `rules/` subdirectory
- Cannot be overridden when enforced via policy

### Level 2: User Memory
- **Path**: `~/.claude/CLAUDE.md` and `~/.claude/rules/*.md`
- Private global instructions for every project
- Ideal for personal preferences, code style, language defaults, git credentials
- Never committed to repositories

### Level 3: Project Memory
- **Paths checked**: `CLAUDE.md`, `.claude/CLAUDE.md`, `.claude/rules/*.md`
- Checked in each ancestor directory from root to current working directory
- Team-shared instructions in source control
- Purpose: project conventions, architecture notes, testing commands

### Level 4: Local Memory (Highest Priority)
- **Path**: `CLAUDE.local.md` (each ancestor directory)
- Private project-specific overrides
- Must be added to .gitignore
- Personal workflow preferences not shared with team

**Priority Note**: "Files closer to the current working directory are loaded later and therefore have higher priority."

## File Discovery Algorithm

The `getMemoryFiles()` function in `utils/claudemd.ts`:
1. Walks from current working directory upward to filesystem root
2. Collects memory files at each level
3. Loads in order: managed -> user -> project/local (root downward to CWD)
4. Full list is memoized for conversation duration
5. Use `/memory` command to force reload or restart session

## The @include Directive

Memory files reference other files using `@` notation:

```markdown
# My project CLAUDE.md
@./docs/architecture.md
@./docs/conventions/typescript.md
Always run `bun test` before committing.
```

Supported path forms:

| Syntax | Resolution |
|---|---|
| `@filename` | Relative from including file's directory |
| `@./relative/path` | Explicit relative path |
| `@~/home/path` | User home directory relative |
| `@/absolute/path` | Absolute filesystem path |

Rules:
- Paths in code blocks/inline code are ignored
- Circular references automatically skipped
- Non-existent files silently ignored
- Maximum include depth: 5 levels
- Text-based files only (.md, .ts, .py, .json); binary files excluded

## .claude/rules/*.md -- Granular Rule Files

Split instructions across multiple files instead of single large CLAUDE.md:

```
my-project/
  CLAUDE.md
  .claude/
    rules/
      testing.md
      typescript-style.md
      git-workflow.md
```

**Path-Scoped Frontmatter**:
```markdown
---
paths:
  - "src/api/**"
  - "src/services/**"
---
Always use dependency injection. Never import concrete implementations directly.
```

Rules inject only when Claude works on matching glob patterns.

## Maximum File Size

Recommended maximum: 40,000 characters per memory file.

## Memory's Effect on Claude Behavior

Assembled memory context is prefixed with: "Codebase and user instructions are shown below. Be sure to adhere to these instructions. IMPORTANT: These instructions OVERRIDE any default behavior and you MUST follow them exactly as written."

Instructions take precedence over built-in defaults.

## When to Use Each Level

- **Managed Memory**: Organization-wide policies, security guardrails, deployment configuration
- **User Memory** (`~/.claude/CLAUDE.md`): Personal preferences across all projects
- **Project Memory** (`CLAUDE.md`): Team-shared conventions
- **Local Memory** (`CLAUDE.local.md`): Personal project overrides

## Disabling Memory Loading

| Method | Effect |
|---|---|
| `CLAUDE_CODE_DISABLE_CLAUDE_MDS=1` | Disables all memory file loading |
| `--bare` flag | Skips auto-discovery; loads only explicitly provided `--add-dir` directories |
| `claudeMdExcludes` setting | Glob patterns excluding specific memory file paths |

---

# PERMISSIONS SYSTEM

Controls which operations Claude performs automatically versus which require explicit approval.

## What Permissions Control

- **File Operations**: Reading, editing, and writing files via Read, Edit, and Write tools
- **Bash Commands**: Shell execution through Bash tool
- **MCP Tool Calls**: Tools from connected MCP servers

## Permission Modes

### Default Mode
Standard mode. Claude Code prompts for confirmation on operations with side effects. Read-only operations auto-approve.

### acceptEdits Mode
File edit and write operations auto-approve. Bash commands still require confirmation.

### Plan Mode
Read-only planning mode. Claude reads files and discusses changes but cannot execute write or bash operations. The model can exit via ExitPlanMode tool.

### bypassPermissions Mode
All permission checks disabled. Every tool call executes immediately. **Warning**: Intended for automated, fully-scripted workflows in audited scenarios.

### dontAsk Mode
Tool calls auto-approve. For scripted/non-interactive scenarios.

### auto Mode
Experimental transcript-classifier mode (feature-gated). A secondary AI classifier evaluates proposed tool calls against conversation context.

## Permission Rules (Allow/Deny Lists)

Fine-grained rules override global mode settings.

### Rule Components

| Field | Description |
|---|---|
| `toolName` | Tool name (e.g., "Bash", "Edit", "mcp__myserver") |
| `ruleContent` | Optional pattern matching tool input |
| `behavior` | "allow", "deny", or "ask" |

### Rule Sources and Persistence

| Source | Location | Scope |
|---|---|---|
| `userSettings` | `~/.claude/settings.json` | All projects for current user |
| `projectSettings` | `.claude/settings.json` | All users of this project |
| `localSettings` | `.claude/settings.local.json` | Current user, this project |
| `session` | In-memory | Current session only |
| `cliArg` | CLI flags | Current invocation only |

### Example Rule Set
```json
{
  "permissions": {
    "allow": [
      "Bash(git status)",
      "Bash(git diff *)",
      "Bash(git log *)",
      "Read(*)"
    ],
    "deny": [
      "Bash(rm -rf *)",
      "Bash(sudo *)"
    ]
  }
}
```

## How Bash Permissions Work

### Pattern Matching
- `git status` -- exact match only
- `git *` -- any git subcommand
- `npm run *` -- any npm run script
- `*` -- any bash command (extreme caution)

### Compound Commands
Multiple sub-commands joined by `&&`, `||`, `;`, or pipes check independently. Most restrictive result applies.

### Safety Checks (Always enforced)
- Commands targeting `.claude/` or `.git/` configuration directories
- Shell config file modifications (.bashrc, .zshrc, etc.)
- Path restriction bypass attempts

---

# HOOKS SYSTEM

Run shell commands, HTTP requests, or prompts automatically when Claude uses tools or reaches session milestones. Hooks attach automation to Claude Code's tool lifecycle.

## How Hooks Work

A hook is a command (shell script, HTTP endpoint, or LLM prompt) bound to a specific event. Hook input arrives as JSON on stdin.

### Exit Code Semantics

| Exit code | Meaning |
|---|---|
| `0` | Success. Stdout may be shown to Claude (event-specific). |
| `2` | Block or inject. Show stderr to Claude and (for PreToolUse) prevent the tool call. |
| Other | Show stderr to the user only; execution continues. |

## Hook Events

### PreToolUse -- before tool execution
Fires before every tool call. Exit 0: tool proceeds. Exit 2: block the tool call. Other: show stderr to user but allow.

### PostToolUse -- after tool execution
Fires after every successful tool call. Exit 0: stdout shown in transcript mode. Exit 2: show stderr to Claude immediately. Use for formatters, linters, test runners.

### PostToolUseFailure -- after a tool error
Fires when a tool call results in an error.

### Stop -- before Claude concludes a response
Fires just before Claude's turn ends. Exit 2: show stderr to Claude and continue the conversation.

### SubagentStop -- before a subagent concludes
Like Stop, but fires when a subagent finishes.

### SubagentStart -- when a subagent starts
Fires when a new subagent is launched.

### SessionStart -- when a session begins
Fires at the start of every session (startup, resume, /clear, or /compact). Match on source values.

### UserPromptSubmit -- when you submit a prompt
Fires when you press Enter. Exit 2: block the prompt.

### PreCompact -- before conversation compaction
Exit 0: stdout appended as custom compact instructions. Exit 2: block the compaction.

### PostCompact -- after conversation compaction

### Setup -- repository setup and maintenance
Fires with trigger: init (project onboarding) or trigger: maintenance (periodic).

### PermissionRequest -- when a permission dialog appears
Output JSON with hookSpecificOutput.decision to approve or deny programmatically.

### PermissionDenied -- after auto mode denies a tool call
Return retry: true to tell Claude it may retry.

### Notification -- when notifications are sent
Fires for permission prompts, idle prompts, auth success, and elicitation events.

### CwdChanged -- after working directory changes
CLAUDE_ENV_FILE environment variable is set for injecting env vars.

### FileChanged -- when a watched file changes
Matcher specifies filename patterns to watch.

### SessionEnd -- when a session ends

### ConfigChange -- when config files change
Exit 2: block the change from being applied.

### InstructionsLoaded -- when a CLAUDE.md file is loaded
Observability-only -- does not support blocking.

### WorktreeCreate / WorktreeRemove -- worktree lifecycle

### Task events (TaskCreated, TaskCompleted) -- task lifecycle
Exit 2 prevents the state change.

### TeammateIdle -- when a teammate is about to go idle
Exit 2 to prevent idle.

### Elicitation / ElicitationResult -- MCP elicitation

## Configuring Hooks

Run `/hooks` inside Claude Code to open the hooks configuration menu. Hooks are stored in the `hooks` field of settings files.

### Configuration Format

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write",
        "hooks": [
          {
            "type": "command",
            "command": "prettier --write $CLAUDE_FILE_PATH"
          }
        ]
      }
    ]
  }
}
```

### Hook Command Types

#### Shell Command
```json
{
  "type": "command",
  "command": "npm test",
  "timeout": 60,
  "shell": "bash"
}
```

Fields: command, timeout, shell ("bash" or "powershell"), statusMessage, async, once, if.

#### HTTP Request
```json
{
  "type": "http",
  "url": "https://hooks.example.com/claude-event",
  "headers": { "Authorization": "Bearer $MY_TOKEN" },
  "allowedEnvVars": ["MY_TOKEN"],
  "timeout": 10
}
```

#### LLM Prompt
```json
{
  "type": "prompt",
  "prompt": "Review this tool call for security issues: $ARGUMENTS.",
  "model": "claude-haiku-4-5",
  "timeout": 30
}
```

#### Agent Hook
```json
{
  "type": "agent",
  "prompt": "Verify that the unit tests passed and all assertions are meaningful.",
  "timeout": 60
}
```

Like a prompt hook, but runs as a full agent with tool access.

## Hooks vs. Skills

| Feature | Hooks | Skills |
|---|---|---|
| When they run | Automatically on tool events | When explicitly invoked |
| Purpose | Side effects, gating, observability | On-demand workflows |
| Configuration | Settings JSON | Markdown files in .claude/skills/ |
| Input | JSON from the tool event | Arguments passed to skill |

---

# MULTI-AGENT WORKFLOWS

Claude Code enables task parallelization through sub-agents -- distinct Claude instances operating independently.

## Sub-agent Mechanics

When Claude activates the Agent tool, it instantiates a new Claude instance with:
- Independent context window (unless forked)
- Specialized system prompt based on agent type
- Configurable tool permissions per agent type
- Capacity to spawn additional sub-agents with nesting limitations

## Agent Tool Parameters

- `description` -- 3-5 word task summary (UI-displayed)
- `prompt` -- complete task specification
- `subagent_type` -- optional specialized agent type
- `run_in_background` -- asynchronous execution option
- `isolation` -- "worktree" for isolated git worktree

## Execution Modes

**Foreground agents** (default): Claude awaits completion before proceeding.
**Background agents**: Execute asynchronously; Claude continues working and receives completion notifications.

## Context and Memory

Sub-agents begin with clean context windows. Parents must embed sufficient background in prompts since agents lack automatic conversation history access.

Persistent memory operates across three scopes:
- User scope: `~/.claude/agent-memory/<agent-type>/MEMORY.md`
- Project scope: `.claude/agent-memory/<agent-type>/MEMORY.md`
- Local scope: `.claude/agent-memory-local/<agent-type>/MEMORY.md`

## Worktree Isolation

Setting `isolation: "worktree"` provides agents isolated git worktrees -- sandboxed repository copies preventing working directory interference until merging.

## Safety and Constraints

- Sub-agents operate in acceptEdits permission mode by default
- Permission rules can deny agents using `Agent(AgentName)` syntax
- Sub-agents cannot spawn teammates (flat roster); they spawn additional sub-agents
- Fork agents cannot recursively fork
- Agent results cap at 100,000 characters before parent return

---

# SKILLS SYSTEM

Create reusable on-demand capabilities that Claude invokes with a slash command. Skills are markdown files defining repeatable prompts and workflows.

## Directory Structure

Skills reside in `.claude/skills/` directories containing `SKILL.md` files:
- `.claude/skills/` (project-level)
- `~/.claude/skills/` (user-level, globally available)

## Creation Process

```bash
mkdir -p .claude/skills/my-skill
```

Create SKILL.md with frontmatter:
```markdown
---
description: Run the full release process for this project
argument-hint: version number (e.g. 1.2.3)
---
Release the project at version $ARGUMENTS.
```

Invoke: `/my-skill 1.2.3`

## Frontmatter Configuration

| Field | Purpose |
|---|---|
| `description` | Short description for skill discovery |
| `argument-hint` | Autocomplete guidance text |
| `allowed-tools` | Permitted tools (Bash, Write, Read) |
| `when_to_use` | Proactive invocation guidance |
| `model` | Specific model selection |
| `user-invocable` | Visibility toggle |
| `context` | Execution scope (fork for isolation) |
| `paths` | Glob patterns for file-based activation |
| `version` | Version identifier |
| `hooks` | Scoped execution hooks |

## Argument Substitution

Use `$ARGUMENTS` anywhere in SKILL.md. Named arguments use `$ARG_NAME` syntax when declared in frontmatter.

## Inline Shell Commands

Backtick injection with `!` prefix executes commands at invocation:
```markdown
!`git log --oneline -20`
```

## Namespaced Skills

Subdirectory organization creates colon-separated namespaces:
- `deployment/SKILL.md` -> `/deployment`
- `database/migrate/SKILL.md` -> `/database:migrate`

## Path-Based Activation

```yaml
---
paths: "**/*.py"
when_to_use: Use when editing Django model files
---
```

---

# MCP SERVER INTEGRATION

MCP servers extend Claude Code by connecting to external data sources and services through the Model Context Protocol.

## Adding a Server

### CLI Method
```bash
claude mcp add <name> -- <command> [args...]
claude mcp add --scope project filesystem -- npx -y @modelcontextprotocol/server-filesystem /tmp
```

## Configuration File Format

### Stdio (Local Process)
```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/home/user/projects"],
      "env": { "NODE_ENV": "production" }
    }
  }
}
```

### HTTP (Remote Server)
```json
{
  "mcpServers": {
    "my-api": {
      "type": "http",
      "url": "https://mcp.example.com/v1",
      "headers": { "Authorization": "Bearer $MY_API_TOKEN" }
    }
  }
}
```

### SSE (Server-Sent Events)
```json
{
  "mcpServers": {
    "events-server": {
      "type": "sse",
      "url": "https://mcp.example.com/sse"
    }
  }
}
```

## Configuration Scopes

| Scope | Location | Use Case |
|---|---|---|
| project | .mcp.json in current directory | Team-shared server configs |
| user | ~/.claude.json (global) | Personal servers everywhere |
| local | .claude/settings.local.json | Per-project personal overrides |

Precedence: local overrides project, which overrides user.

## Managing Servers

```
/mcp enable <server-name>
/mcp disable <server-name>
/mcp reconnect <server-name>
```

## MCP Tool Call Approval

Options when prompted:
- **Allow once**: approve this specific call
- **Allow always**: approve all calls to this tool in current session
- **Deny**: block the call; Claude receives an error

---

# SETTINGS CONFIGURATION

Claude Code behavior is configured through JSON settings files at user, project, and managed levels.

## Settings File Locations

### Global (User)
- **Location**: `~/.claude/settings.json`
- **Scope**: Every Claude Code session across all projects

### Project (Shared)
- **Location**: `.claude/settings.json` in project root
- **Scope**: Checked into source control

### Local (Personal Project)
- **Location**: `.claude/settings.local.json` in project root
- **Scope**: Not checked into source control

### Managed (Enterprise)
- **Priority**: Highest precedence; cannot be overridden

## Settings Precedence

```
Plugin defaults -> User settings -> Project settings -> Local settings -> Managed (policy) settings
```

## Settings Reference

### model
Override the default model used by Claude Code. Accepts any model ID.

### permissions
Controls which tools Claude can use and in what mode.

| Field | Type | Description |
|---|---|---|
| `allow` | string[] | Rules for operations Claude may perform without asking |
| `deny` | string[] | Rules for operations Claude is always blocked from |
| `ask` | string[] | Rules for operations that always prompt |
| `defaultMode` | string | Default permission mode |
| `disableBypassPermissionsMode` | "disable" | Prevent users from entering bypass mode |
| `additionalDirectories` | string[] | Extra directories Claude may access |

### hooks
Run custom shell commands before or after tool executions.

### cleanupPeriodDays
Number of days to retain chat transcripts. Default: 30. Setting to 0 disables persistence.

### env
Environment variables to inject into every Claude Code session.

### availableModels (Managed only)
Enterprise allowlist of models users can select.

### worktree
Configuration for `--worktree` flag behavior:
- `symlinkDirectories`: Directories to symlink from main repo into worktrees
- `sparsePaths`: Paths to check out in sparse mode for faster worktrees

### attribution
Customize attribution text for commits and PR descriptions.

### language
Preferred language for Claude responses and voice dictation.

### alwaysThinkingEnabled
Default: true. When false, extended thinking is disabled.

### effortLevel
"low" | "medium" | "high" -- persisted effort level for models supporting adjustable thinking.

### autoMemoryEnabled
Enable or disable auto-memory for this project.

### autoMemoryDirectory
Custom path for auto-memory storage. Defaults to `~/.claude/projects/<sanitized-cwd>/memory/`.

### claudeMdExcludes
Glob patterns of CLAUDE.md files to exclude from loading.

### disableAllHooks
Set to true to disable all hook execution.

### respectGitignore
Default: true. Whether the file picker respects .gitignore files.

### defaultShell
"bash" or "powershell". Default: "bash".

### apiKeyHelper
Path to a script that outputs authentication values dynamically.

### syntaxHighlightingDisabled
Disable syntax highlighting in diffs.

### prefersReducedMotion
Reduce or disable animations for accessibility.

## Managed Settings (Enterprise)

### macOS Deployment
Deploy plist to `/Library/Preferences/` or via MDM targeting `com.anthropic.claudecode`.

### Windows Deployment
Write to `HKLM\Software\Anthropic\Claude Code` registry key.

### File-Based Deployment
Place `managed-settings.json` at platform-specific path. Supports `managed-settings.d/` directory for drop-in fragments.

### Managed-Only Settings

| Setting | Description |
|---|---|
| `allowManagedHooksOnly` | Only hooks from managed settings run |
| `allowManagedPermissionRulesOnly` | Only managed permission rules respected |
| `allowManagedMcpServersOnly` | MCP server allowlist from managed settings only |
| `strictPluginOnlyCustomization` | Lock customization surfaces to plugin-only |

---

# ENVIRONMENT VARIABLES

## Authentication

| Variable | Description |
|---|---|
| `ANTHROPIC_API_KEY` | API key for Anthropic API |
| `ANTHROPIC_AUTH_TOKEN` | Alternative authentication token |
| `ANTHROPIC_BASE_URL` | Override Anthropic API base URL |
| `CLAUDE_CODE_API_BASE_URL` | Claude Code-specific API base URL override (takes precedence) |
| `ANTHROPIC_BEDROCK_BASE_URL` | Base URL for AWS Bedrock API |
| `ANTHROPIC_VERTEX_PROJECT_ID` | Google Cloud project ID for Vertex AI |
| `CLAUDE_CODE_USE_BEDROCK` | Set to 1/true to use AWS Bedrock |
| `CLAUDE_CODE_USE_FOUNDRY` | Set to 1/true to use Anthropic Foundry |
| `CLAUDE_CODE_OAUTH_TOKEN` | OAuth access token for automated environments |

## Configuration Paths

| Variable | Description |
|---|---|
| `CLAUDE_CONFIG_DIR` | Override directory for config/settings/transcripts (default: ~/.claude) |
| `CLAUDE_CODE_MANAGED_SETTINGS_PATH` | Override path to managed settings file |

## Model Selection

| Variable | Description |
|---|---|
| `ANTHROPIC_MODEL` | Default model to use |
| `CLAUDE_CODE_SUBAGENT_MODEL` | Model for sub-agent tasks |
| `CLAUDE_CODE_AUTO_MODE_MODEL` | Model for auto mode execution |

## Behavior Toggles

| Variable | Description |
|---|---|
| `CLAUDE_CODE_REMOTE` | Set to 1/true for remote/container mode (extends timeouts, suppresses prompts) |
| `CLAUDE_CODE_SIMPLE` | Set to 1/true for bare mode |
| `DISABLE_AUTO_COMPACT` | Set to 1/true to disable automatic compaction |
| `CLAUDE_CODE_DISABLE_BACKGROUND_TASKS` | Disable background task execution |
| `CLAUDE_CODE_DISABLE_THINKING` | Disable extended thinking |
| `CLAUDE_CODE_DISABLE_AUTO_MEMORY` | Disable automatic memory operations |
| `CLAUDE_CODE_DISABLE_CLAUDE_MDS` | Completely disable CLAUDE.md file loading |
| `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC` | Suppress analytics and telemetry |
| `CLAUDE_BASH_MAINTAIN_PROJECT_WORKING_DIR` | Reset CWD to project root after each Bash command |

## Resource Limits

| Variable | Description |
|---|---|
| `CLAUDE_CODE_MAX_OUTPUT_TOKENS` | Override max output tokens per API response |
| `CLAUDE_CODE_MAX_CONTEXT_TOKENS` | Override max context window size |
| `BASH_MAX_OUTPUT_LENGTH` | Maximum characters captured from Bash output |
| `API_TIMEOUT_MS` | Override API request timeout (default: 300,000ms standard, 120,000ms remote) |

## Telemetry and Observability

| Variable | Description |
|---|---|
| `CLAUDE_CODE_ENABLE_TELEMETRY` | Enable OpenTelemetry export |
| `CLAUDE_CODE_JSONL_TRANSCRIPT` | Path for JSONL session transcript |

---

# AUTHENTICATION

## Methods

### Claude.ai OAuth (default)
When running `claude` for the first time, opens browser for OAuth flow. Tokens refreshed automatically.

### API Key
Set `ANTHROPIC_API_KEY` environment variable. Takes priority over OAuth.

### apiKeyHelper
Settings file path to a script that outputs API key:
```json
{ "apiKeyHelper": "cat ~/.anthropic/api-key" }
```

### AWS Bedrock
```bash
export CLAUDE_CODE_USE_BEDROCK=1
```
Uses standard AWS credential chain. Supports `awsAuthRefresh` and `awsCredentialExport` settings.

### GCP Vertex AI
```bash
export CLAUDE_CODE_USE_VERTEX=1
```
Uses Google Application Default Credentials. Supports `gcpAuthRefresh` setting.

## Authentication Priority

1. `ANTHROPIC_AUTH_TOKEN` environment variable
2. `CLAUDE_CODE_OAUTH_TOKEN` environment variable
3. OAuth token from file descriptor (managed deployments)
4. `apiKeyHelper` from settings
5. Stored claude.ai OAuth tokens (keychain or credentials file)
6. `ANTHROPIC_API_KEY` environment variable

---

# CLI FLAGS REFERENCE

```bash
claude [flags] [prompt]
```

## Core Flags

| Flag | Description |
|---|---|
| `-p, --print` | Non-interactive: process prompt, print response, exit |
| `--output-format <format>` | text, json, or stream-json |
| `--input-format <format>` | text or stream-json |
| `--verbose` | Enable verbose output |
| `-v, --version` | Print version and exit |
| `-h, --help` | Display help |

## Session Continuation

| Flag | Description |
|---|---|
| `-c, --continue` | Resume most recent conversation |
| `-r, --resume [session-id]` | Resume by session ID or open picker |
| `--fork-session` | Create branch from resumed conversation |
| `-n, --name <name>` | Set display name for session |
| `--session-id <uuid>` | Use specific UUID as session ID |
| `--no-session-persistence` | Disable session persistence (--print only) |

## Model and Capability

| Flag | Description |
|---|---|
| `--model <model>` | Set model (alias or full ID) |
| `--effort <level>` | low, medium, high, max |
| `--fallback-model <model>` | Automatic fallback model (--print only) |

## Permission and Safety

| Flag | Description |
|---|---|
| `--permission-mode <mode>` | default, acceptEdits, plan, bypassPermissions |
| `--dangerously-skip-permissions` | Bypass all permission checks |
| `--allowed-tools <tools...>` | Comma/space-separated allowed tools |
| `--disallowed-tools <tools...>` | Comma/space-separated blocked tools |
| `--tools <tools...>` | Exact set of built-in tools |

## Context and Prompt

| Flag | Description |
|---|---|
| `--add-dir <directories...>` | Add directories to tool access context |
| `--system-prompt <prompt>` | Override default system prompt |
| `--append-system-prompt <text>` | Append to default system prompt |
| `--mcp-config <configs...>` | Load MCP servers from config files |
| `--strict-mcp-config` | Only use MCP servers from --mcp-config |
| `--settings <file-or-json>` | Load additional settings |
| `--setting-sources <sources>` | Comma-separated settings sources to load |
| `--agents <json>` | Define custom agents inline |

## Output Control

| Flag | Description |
|---|---|
| `--include-hook-events` | Include hook events in output stream |
| `--max-turns <n>` | Limit agentic turns (--print only) |
| `--max-budget-usd <amount>` | Max dollar amount for API calls |
| `--json-schema <schema>` | JSON Schema for structured output validation |

## Worktree

| Flag | Description |
|---|---|
| `-w, --worktree [name]` | Create new git worktree (accepts PR number/URL) |
| `--tmux` | Create tmux session alongside worktree |

## Debug

| Flag | Description |
|---|---|
| `-d, --debug [filter]` | Enable debug mode with optional category filter |
| `--debug-file <path>` | Write debug logs to file |
| `--bare` | Minimal mode (skips hooks, LSP, plugins, attribution, auto-memory) |

---

# SLASH COMMANDS REFERENCE

| Command | Purpose |
|---|---|
| `/init` | Generate CLAUDE.md files and optional skills/hooks |
| `/memory` | Edit Claude memory files (global, project, local) |
| `/config` | Open settings panel |
| `/hooks` | View hook configurations |
| `/mcp` | Manage MCP servers |
| `/permissions` | Manage allow/deny rules |
| `/plan` | Enable plan mode or manage session plan |
| `/model` | Set AI model for current session |
| `/commit` | Create git commit with AI-generated message |
| `/review` | Review a pull request |
| `/skills` | List available skills |
| `/compact` | Summarize conversation history to reduce context |
| `/clear` | Clear conversation history |
| `/help` | Show help and available commands |
| `/login` | Sign in or switch accounts |
| `/logout` | Sign out |

### /init
Analyzes codebase and sets up CLAUDE.md, skills, and hooks. Can produce: Project CLAUDE.md, Personal CLAUDE.local.md, Skills, Hooks.

### /compact [instructions]
Summarizes conversation history and replaces it with a condensed version. Optional instructions for summarization focus.

### /commit
Creates git commit with AI-generated message. Safety rules: never amends existing commits, never skips hooks, never commits secrets, no empty commits. Access only to git add, git status, and git commit.

### /review [PR-number]
AI code review using GitHub CLI (gh). Provides structured review covering code quality, improvement suggestions, risks, performance, test coverage, security.

### /plan [open|description]
Toggle plan mode, open current plan, or create new plan with description. Plan mode = Claude proposes plan and waits for approval before acting.

---

# SDK OVERVIEW

The Claude Code SDK allows embedding Claude Code in external applications using a stdin/stdout control protocol.

## How It Works

1. **Spawn a Claude Code Process**: `claude --output-format stream-json --print --verbose`
2. **Send an Initialize Request**: Write `control_request` with `subtype: "initialize"` to stdin
3. **Stream Messages from stdout**: Read newline-delimited JSON
4. **Send User Messages**: Write `SDKUserMessage` objects to stdin

## Control Protocol Messages

### SDKControlRequest (host -> CLI)
```json
{
  "type": "control_request",
  "request_id": "<unique-string>",
  "request": { "subtype": "...", ...payload }
}
```

### SDKControlResponse (CLI -> host)
```json
{
  "type": "control_response",
  "response": {
    "subtype": "success",
    "request_id": "<echoed-id>",
    "response": { ...payload }
  }
}
```

## Initialize Request

```json
{
  "type": "control_request",
  "request_id": "init-1",
  "request": {
    "subtype": "initialize",
    "systemPrompt": "You are a CI automation agent.",
    "appendSystemPrompt": "Always add test coverage.",
    "hooks": { ... },
    "agents": {
      "CodeReviewer": {
        "description": "Reviews code for quality and security.",
        "prompt": "You are an expert code reviewer...",
        "model": "opus"
      }
    }
  }
}
```

### AgentDefinition Fields
- description, prompt, model, tools, disallowedTools, maxTurns, permissionMode

## SDK Message Stream Types

| Type | Description |
|---|---|
| `system` (init) | Session initialization with model, tools, MCP servers, permission mode |
| `assistant` | Model response with tool_use blocks |
| `stream_event` | Partial streaming tokens |
| `tool_progress` | Long-running tool status |
| `result` | Final turn summary (success or error subtypes) |
| `system` (status) | Permission mode or session status changes |

## Other Control Requests

| Subtype | Direction | Description |
|---|---|---|
| `interrupt` | host -> CLI | Interrupt current turn |
| `set_permission_mode` | host -> CLI | Change permission mode |
| `set_model` | host -> CLI | Switch model mid-session |
| `can_use_tool` | CLI -> host | Permission request for tool call |
| `mcp_status` | host -> CLI | Get MCP server connection statuses |
| `mcp_set_servers` | host -> CLI | Replace MCP servers |
| `get_context_usage` | host -> CLI | Context window usage breakdown |
| `get_settings` | host -> CLI | Read effective merged settings |
| `apply_flag_settings` | host -> CLI | Merge settings into flag layer |
| `rewind_files` | host -> CLI | Revert file changes since a message |
| `hook_callback` | CLI -> host | Deliver hook event for SDK callback |
| `reload_plugins` | host -> CLI | Reload plugins from disk |

## Session Management API

```typescript
import {
  query,
  listSessions,
  getSessionInfo,
  getSessionMessages,
  forkSession,
  renameSession,
  tagSession,
} from '@anthropic-ai/claude-code'
```

### query -- Run a Prompt
```typescript
for await (const message of query({
  prompt: 'What files are in this directory?',
  options: { cwd: '/my/project' }
})) {
  if (message.type === 'result') console.log(message.result)
}
```

### listSessions, getSessionMessages, forkSession, renameSession, tagSession
Full session transcript management for scripting scenarios.

---

# HOOKS REFERENCE (DETAILED)

## Configuration Structure

| Scope | Location | Priority |
|---|---|---|
| User | ~/.claude/settings.json | Low |
| Project | .claude/settings.json | Medium |
| Local | .claude/settings.local.json | High |

All hooks across files execute; higher priority files augment, not override.

## Hook Types

### Command Hooks
- command (required), timeout, shell, async, asyncRewake, once, if, statusMessage

### Prompt Hooks
- prompt (required, supports $ARGUMENTS), model

### Agent Hooks
- prompt (required), model, timeout -- runs as full agent with tool access

### HTTP Hooks
- url (required), headers (supports $VAR_NAME), allowedEnvVars

## Base Hook Input (all hooks receive)

- hook_event_name, session_id, transcript_path, cwd, permission_mode, agent_id, agent_type

## Sync Hook Output

```json
{
  "continue": true,
  "suppressOutput": false,
  "decision": "approve",
  "reason": "Explanation",
  "systemMessage": "Message for Claude",
  "hookSpecificOutput": { ... }
}
```

## Full Event Reference

### PreToolUse
Input: tool_name, tool_input, tool_use_id
hookSpecificOutput: permissionDecision, permissionDecisionReason, updatedInput, additionalContext

### PostToolUse
Input: tool_name, tool_input, tool_response, tool_use_id
hookSpecificOutput: additionalContext, updatedMCPToolOutput

### PermissionRequest
Input: tool_name, tool_input, permission_suggestions
hookSpecificOutput.decision: {behavior: "allow"/"deny", updatedInput, updatedPermissions, message, interrupt}

### Stop
Input: stop_hook_active, last_assistant_message
Exit 2: stderr injected as system message; Claude continues

### SubagentStart/SubagentStop
Input: agent_id, agent_type, agent_transcript_path

### SessionStart
Input: source (startup/resume/clear/compact), model
hookSpecificOutput: additionalContext, initialUserMessage, watchPaths

### UserPromptSubmit
Input: prompt
Exit 2: block processing

### Setup
Input: trigger (init/maintenance)

### PreCompact/PostCompact
Input: trigger (manual/auto), custom_instructions/compact_summary

### CwdChanged/FileChanged
CLAUDE_ENV_FILE available for env injection

### Elicitation/ElicitationResult
Input: mcp_server_name, message, mode, elicitation_id, requested_schema

### ConfigChange
Input: source, file_path. Exit 2: block change.

### InstructionsLoaded
Input: file_path, memory_type, load_reason, globs, trigger_file_path, parent_file_path

### Async Hooks
```json
{ "async": true, "asyncTimeout": 30 }
```
Cannot block execution or inject context.

---

# PERMISSIONS API (DETAILED)

## Permission Modes

| Mode | Description |
|---|---|
| `default` | Prompt for dangerous operations. Read-only auto-approve. |
| `acceptEdits` | Auto-approve file edits. Bash still prompts. |
| `bypassPermissions` | Skip all checks. Requires allowDangerouslySkipPermissions. |
| `plan` | Read-only. No tool execution. |
| `dontAsk` | Don't prompt. Deny anything not pre-approved. |

## Permission Rules

### Configuration Format
```json
{
  "permissions": {
    "allow": ["Bash(git *)", "Bash(npm run *)", "Read", "Write(src/**)"],
    "deny": ["Bash(rm -rf *)", "Bash(curl * | bash)", "Write(/etc/**)"]
  }
}
```

### Rule Syntax
- Tool name only: `Read`, `Write`, `Edit`, `Bash`
- Tool with content pattern: `Bash(git *)`, `Write(src/*)`
- MCP server: `mcp__myserver`
- MCP wildcard: `mcp__myserver__*`
- Specific MCP tool: `mcp__myserver__query_database`
- Agent type: `Agent(Explore)`, `Agent(CodeReviewer)`

## Permission Rule Sources and Priority

| Source | Where Configured | Editable |
|---|---|---|
| policySettings | Managed policy layer | No |
| flagSettings | CLI flags and SDK control requests | Per-session |
| userSettings | ~/.claude/settings.json | Yes |
| projectSettings | .claude/settings.json | Yes |
| localSettings | .claude/settings.local.json | Yes |
| cliArg | --allowedTools / --disallowedTools | Per-invocation |
| session | /permissions command, SDK updates | Per-session |

## Decision Pipeline

1. **Deny rules** -- if any deny rule matches, blocked immediately
2. **Ask rules** -- if any ask rule matches, permission dialog shown
3. **Tool's own permission check** -- tool's checkPermissions method runs
4. **Safety checks** -- .git/, .claude/, .vscode/, shell config always prompt
5. **Mode check** -- bypassPermissions and plan mode apply
6. **Allow rules** -- if allow rule matches, approved
7. **Default behavior** -- prompt the user

Safety checks are bypass-immune.

## Working Directories

Default: restrict to CWD and subdirectories. Grant additional access via:
- CLI: `--add-dir /path/to/extra/dir`
- Settings: `permissions.additionalDirectories`
- SDK: `apply_flag_settings` control request

## Permission Updates via SDK

### PermissionUpdate Object
```json
{
  "type": "addRules",
  "rules": [{ "toolName": "Bash", "ruleContent": "git *" }],
  "behavior": "allow",
  "destination": "userSettings"
}
```

Types: addRules, replaceRules, removeRules, setMode, addDirectories, removeDirectories.
Destinations: userSettings, projectSettings, localSettings, session, cliArg.

---

# END OF DOCUMENT

All content extracted from the Mintlify documentation at:
https://www.mintlify.com/VineeTagarwaL-code/claude-code/

Pages successfully fetched:
1. /concepts/how-it-works (Core architecture)
2. /concepts/tools (All built-in tools)
3. /concepts/permissions (Permission system)
4. /concepts/memory-context (CLAUDE.md memory)
5. /guides/hooks (Hooks system)
6. /guides/multi-agent (Multi-agent workflows)
7. /guides/skills (Skills system)
8. /guides/mcp-servers (MCP integration)
9. /guides/authentication (Auth methods)
10. /configuration/settings (Settings reference)
11. /configuration/environment-variables (Env vars)
12. /reference/commands/cli-flags (CLI flags)
13. /reference/commands/slash-commands (Slash commands)
14. /reference/sdk/overview (SDK control protocol)
15. /reference/sdk/hooks-reference (Detailed hooks API)
16. /reference/sdk/permissions-api (Detailed permissions API)
17. /introduction (Overview)
18. /quickstart (Getting started)
19. /installation (Setup)
