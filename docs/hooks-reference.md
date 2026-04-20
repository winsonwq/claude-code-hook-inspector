# Claude Code Hooks Reference

## Overview

Claude Code provides hooks that allow external tools to intercept and modify the behavior of tool execution and command running.

## Hook Events Summary

| Event | Fires When | Decision Control |
|-------|-----------|-----------------|
| SessionStart | Session begins or resumes | `hookSpecificOutput.additionalContext` |
| UserPromptSubmit | User submits a prompt | Top-level `decision: "block"`, `reason`, `additionalContext`, `sessionTitle` |
| PreToolUse | Before tool executes | `hookSpecificOutput.permissionDecision`, `updatedInput`, etc. |
| PermissionRequest | Permission dialog appears | `hookSpecificOutput.decision.behavior` |
| PermissionDenied | Auto mode denies tool | `hookSpecificOutput.retry: true` |
| PostToolUse | Tool completes | Top-level `decision: "block"`, `reason`, `additionalContext` |
| PostToolUseFailure | Tool fails | `hookSpecificOutput.additionalContext` |
| Notification | Notification sent | `additionalContext` |
| SubagentStart | Subagent spawned | `hookSpecificOutput.additionalContext` |
| SubagentStop | Subagent finishes | Top-level `decision: "block"`, `reason` |
| TaskCreated | Task being created | Exit code 2 or `{"continue": false, "stopReason": "..."}` |
| TaskCompleted | Task being marked complete | Exit code 2 or `{"continue": false, "stopReason": "..."}` |
| Stop | Claude finishes responding | Top-level `decision: "block"`, `reason` |
| StopFailure | Turn ends due to API error | None (ignored) |
| TeammateIdle | Teammate about to go idle | Exit code 2 or `{"continue": false, "stopReason": "..."}` |
| InstructionsLoaded | CLAUDE.md/rules loaded | None |
| ConfigChange | Config file changes | Top-level `decision: "block"`, `reason` |
| CwdChanged | Working directory changes | `watchPaths` |
| FileChanged | Watched file changes | `watchPaths` |
| WorktreeCreate | Worktree being created | Must return path via stdout |
| WorktreeRemove | Worktree being removed | None |
| PreCompact | Before compaction | Exit code 2 or `decision: "block"` |
| PostCompact | After compaction | None |
| Elicitation | MCP requests user input | `hookSpecificOutput.action`, `content` |
| ElicitationResult | User responds to elicitation | `hookSpecificOutput.action`, `content` |
| SessionEnd | Session terminates | None |

---

## Return Value Schema

Based on Claude Code's hook validation, hooks fall into three categories:

### 1. Hooks with `hookSpecificOutput` Schema (strict validation)

These hooks **require** `hookSpecificOutput` with `hookEventName`:

#### PreToolUse
```typescript
{
  hookSpecificOutput: {
    hookEventName: "PreToolUse",
    permissionDecision?: "allow" | "deny" | "ask" | "defer",
    permissionDecisionReason?: string,
    updatedInput?: object,
    additionalContext?: string
  }
}
```

#### UserPromptSubmit
```typescript
{
  decision?: "block",
  reason?: string,
  hookSpecificOutput: {
    hookEventName: "UserPromptSubmit",
    additionalContext?: string,
    sessionTitle?: string
  }
}
```

#### PostToolUse
```typescript
{
  decision?: "block",
  reason?: string,
  hookSpecificOutput: {
    hookEventName: "PostToolUse",
    additionalContext?: string,
    updatedMCPToolOutput?: object
  }
}
```

### 2. Hooks with Top-Level Decision Fields

These hooks use top-level JSON fields, **NOT** `hookSpecificOutput`:

#### PostToolUseFailure
```typescript
{
  hookSpecificOutput?: {
    hookEventName: "PostToolUseFailure",
    additionalContext?: string
  }
}
```

#### Stop, SubagentStop
```typescript
{
  decision?: "block",
  reason?: string
}
```

#### ConfigChange
```typescript
{
  decision?: "block",
  reason?: string
}
```

#### TaskCreated, TaskCompleted, TeammateIdle
```typescript
// Exit code 2 to block
// OR JSON:
{
  continue: false,
  stopReason: string
}
```

#### PreCompact
```typescript
// Exit code 2 to block
// OR:
{
  decision: "block",
  reason?: string
}
```

#### Elicitation
```typescript
{
  hookSpecificOutput: {
    hookEventName: "Elicitation",
    action: "accept" | "decline" | "cancel",
    content?: object
  }
}
```

#### ElicitationResult
```typescript
{
  hookSpecificOutput: {
    hookEventName: "ElicitationResult",
    action: "accept" | "decline" | "cancel",
    content?: object
  }
}
```

### 3. Hooks with No Decision Control

These hooks should return `{}` or only `additionalContext`/`watchPaths`:

- SessionStart (can return `additionalContext` via `hookSpecificOutput`)
- SessionEnd
- StopFailure (ignored)
- Notification (can return `additionalContext`)
- SubagentStart (can return `additionalContext` via `hookSpecificOutput`)
- InstructionsLoaded
- CwdChanged (can return `watchPaths`)
- FileChanged (can return `watchPaths`)
- WorktreeCreate (special: must return path via stdout)
- WorktreeRemove
- PostCompact

### Universal Fields

These fields work across all hooks:

```typescript
{
  continue?: boolean,       // Default: true. If false, stops processing
  stopReason?: string,      // Message shown when continue is false
  suppressOutput?: boolean, // Omits stdout from debug log
  systemMessage?: string   // Warning shown to user
}
```

---

## Hooks Without Matcher Support

These hooks always fire on every occurrence (matcher is silently ignored):

- UserPromptSubmit
- Stop
- TeammateIdle
- TaskCreated
- TaskCompleted
- WorktreeCreate
- WorktreeRemove
- CwdChanged

---

## Exit Code Behavior

| Exit Code | Meaning |
|-----------|---------|
| 0 | Success, parse JSON from stdout |
| 2 | Blocking error, show stderr as error message |
| Other | Non-blocking error, continue execution |

**Important**: Exit code 1 is a non-blocking error in Claude Code hooks. Use exit code 2 for blocking.

---

## Decision Control Quick Reference

| Events | Pattern | Key Fields |
|--------|---------|------------|
| UserPromptSubmit, PostToolUse, PostToolUseFailure, Stop, SubagentStop, ConfigChange, PreCompact | Top-level decision | `decision: "block"`, `reason` |
| PreToolUse | hookSpecificOutput | `permissionDecision` |
| PermissionRequest | hookSpecificOutput | `decision.behavior` |
| PermissionDenied | hookSpecificOutput | `retry: true` |
| TaskCreated, TaskCompleted, TeammateIdle | Exit code or continue | Exit code 2 or `continue: false` |
| Elicitation, ElicitationResult | hookSpecificOutput | `action`, `content` |
| WorktreeCreate | Path return | Print path to stdout |
| All others | None | Logging/observability only |

---

## Implementation Notes

### Shim Behavior

The hook shim (`src/hooks/index.ts`) is registered in `~/.claude/settings.json` and receives all hook calls. It:
1. Determines which hook was triggered
2. Extracts the payload
3. Sends event to inspector via Unix socket
4. Returns the response from inspector

### Session Association

Each hook call is associated with a session ID to enable:
- Session-scoped logging
- Event correlation
- Session replay (future feature)

Session ID is read from environment variables:
- `CLAUDE_SESSION_ID`
- `CLAUDE_API_SESSION_ID`

### Timeout Handling

If the inspector server doesn't respond within 30 seconds, the shim returns `null` to avoid blocking Claude Code indefinitely.

---

## Testing Hooks

To test hook behavior:

1. Start inspector:
   ```bash
   cchi start --interactive
   ```

2. Run Claude Code with a task that triggers hooks

3. Observe events in the inspector terminal

4. In interactive mode, enter JSON return values to see how Claude Code responds
