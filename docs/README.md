# CCHI - Claude Code Hook Inspector

Monitor and debug Claude Code hooks with an interactive CLI.

## Installation

```bash
npm install -g claude-code-hook-inspector
```

## Quick Start

```bash
# Initialize hooks (first time only)
cchi init

# Start inspector in monitor mode
cchi start

# Or start in interactive mode to inject return values
cchi start --interactive
```

## Features

### Monitor Mode

When running in monitor mode, all Claude Code hook events are captured and displayed in real-time:

```
[10:30:15] pre-tool
  payload:
    {
      "hookEventName": "PreToolUse",
      "sessionId": "abc123",
      "toolName": "Bash",
      "toolInput": {
        "command": "npm test"
      }
    }
```

### Interactive Mode

In interactive mode, you can inject custom return values into hooks to influence Claude Code's behavior. Only hooks that can control behavior will prompt for input. Other hooks display info and return null automatically.

```
[10:30:15] pre-tool
  payload:
    {
      "hookEventName": "PreToolUse",
      "sessionId": "abc123",
      "toolName": "Bash"
    }

  > enter return value (JSON or Enter for null): {"permissionDecision": "allow"}
```

## Hooks Reference

### Hooks That Accept Input

These hooks can control Claude Code's behavior and will prompt for return values in interactive mode:

#### `pre-tool` - Before a tool is executed

Can block or modify tool execution.

**Example input:**
```json
{"permissionDecision": "allow"}
```
```json
{"permissionDecision": "deny", "permissionDecisionReason": "Blocked by inspector"}
```

#### `permission-request` - When permission dialog appears

Can allow or deny permission on behalf of user.

**Example input:**
```json
{"decision": {"behavior": "allow"}}
```
```json
{"decision": {"behavior": "deny", "message": "Denied by inspector"}}
```

#### `user-prompt` - When user submits a prompt

Can block or add context to user prompts.

**Example input:**
```json
{"decision": "block", "reason": "Prompt blocked by inspector"}
```
```json
{"additionalContext": "Extra context added by inspector"}
```

#### `stop` - When Claude finishes responding

Can prevent Claude from stopping.

**Example input:**
```json
{"decision": "block", "reason": "Continue working"}
```

#### `config-change` - When configuration changes

Can block configuration changes.

**Example input:**
```json
{"decision": "block", "reason": "Config changes not allowed"}
```

#### `permission-denied` - When auto mode denies a tool

Can tell the model to retry a denied tool.

**Example input:**
```json
{"retry": true}
```

#### `pre-compact` - Before context compaction

Can block compaction.

**Example input:**
```json
{"decision": "block", "reason": "Compaction blocked"}
```

#### `subagent-stop` - When a subagent finishes

Can prevent the subagent from stopping.

**Example input:**
```json
{"decision": "block", "reason": "Continue working"}
```

#### `teammate-idle` - When a teammate is about to go idle

Can prevent the teammate from going idle.

**Example input:**
```json
{"continue": false, "stopReason": "Keep working"}
```

#### `task-created` - When a task is being created

Can block task creation.

**Example input:**
```json
{"continue": false, "stopReason": "Task not allowed"}
```

#### `task-completed` - When a task is being marked as completed

Can block task completion.

**Example input:**
```json
{"continue": false, "stopReason": "Tests must pass first"}
```

#### `elicitation` - When an MCP server requests user input

Can deny the elicitation.

**Example input:**
```json
{"action": "decline"}
```

#### `elicitation-result` - After user responds to elicitation

Can block the response.

**Example input:**
```json
{"action": "decline"}
```

### Hooks That Just Notify

These hooks fire for observability but cannot control behavior:

| Hook | Description |
|------|-------------|
| `session-start` | Session begins or resumes |
| `session-end` | Session terminates |
| `post-tool` | Tool completed successfully |
| `post-tool-use-failure` | Tool failed |
| `notification` | Notification sent |
| `stop-failure` | Turn ended due to API error |
| `cwd-changed` | Working directory changed |
| `file-changed` | Watched file changed |
| `subagent-start` | Subagent spawned |
| `post-compact` | Compaction completed |
| `instructions-loaded` | Instruction file loaded |
| `worktree-create` | Worktree created |
| `worktree-remove` | Worktree removed |

## Commands

| Command | Description |
|---------|-------------|
| `cchi init` | Install hooks to Claude Code settings |
| `cchi start` | Start inspector in monitor mode |
| `cchi start --interactive` | Start inspector in interactive mode |
| `cchi logs` | View historical hook event logs |
| `cchi logs --follow` | Follow new log entries |
| `cchi stop` | Stop the inspector server |
| `cchi uninstall` | Remove hooks from Claude Code |

## How It Works

```
Claude Code → Hook Shim → Unix Socket → Inspector Server → CLI / Log File
```

Hooks are installed as shims that forward events to the inspector server via a Unix domain socket.

## Configuration

Logs are stored in `~/.claude-code-hook-inspector/logs/sessions/` in JSONL format.

## License

MIT
