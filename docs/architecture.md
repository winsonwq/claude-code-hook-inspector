# Architecture

## System Overview

```
┌──────────────────────────────────────────────────────────────┐
│                      Claude Code                              │
│                                                               │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐        │
│  │pre-tool │  │post-tool│  │pre-cmd  │  │post-cmd │  ...   │
│  └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘        │
│       │            │            │            │              │
└───────┼────────────┼────────────┼────────────┼──────────────┘
        │            │            │            │
        └────────────┴────────────┴────────────┘
                     │
                     ▼
           ┌─────────────────────┐
           │   Hook Shim Layer   │
           │ (src/hooks/index.ts) │
           └──────────┬──────────┘
                      │
                      │ JSON over Unix Socket
                      ▼
           ┌─────────────────────┐
           │  Inspector Server   │
           │ (src/inspector/)     │
           │                     │
           │  ┌─────────────────┐ │
           │  │ Dispatcher     │ │
           │  │ (event routing) │ │
           │  └────────┬────────┘ │
           │           │         │
           │  ┌────────▼────────┐ │
           │  │   Session Log   │ │
           │  │   Manager       │ │
           │  └─────────────────┘ │
           └──────────┬──────────┘
                      │
          ┌───────────┼───────────┐
          ▼           ▼           ▼
      ┌────────┐  ┌────────┐  ┌────────┐
      │  TUI   │  │  Log   │  │ HTTP   │
      │(ink)   │  │ (JSONL)│  │ API*   │
      └────────┘  └────────┘  └────────┘
```

## Component Details

### Hook Shim (`src/hooks/`)

The hook shim is a thin layer that:
1. Receives calls from Claude Code
2. Serializes the event data
3. Sends it over Unix socket to inspector
4. Returns the response from inspector back to Claude Code

Key file: `src/hooks/index.ts`

```typescript
// Main entry point called by Claude Code
export async function hookRouter(hookName: string, ...args: unknown[]): Promise<unknown> {
  const payload = args[0] as Record<string, unknown>
  return await sendHookEvent(hookName, getSessionId(), payload)
}
```

### Inspector Server (`src/inspector/server.ts`)

- Manages Unix socket connections from shims
- Routes messages to dispatcher
- Handles client lifecycle

### Dispatcher (`src/inspector/dispatcher.ts`)

- Core event processing logic
- Manages sessions
- Routes to appropriate output (TUI, log, etc.)
- Handles interactive mode input waiting

### TUI (`src/ui/`)

Built with Ink, displays:
- Real-time event stream
- Event details (hook name, payload, timestamp)
- Interactive input panel for return value injection

## Data Flow

### Monitor Mode

1. Claude Code triggers hook → Shim
2. Shim sends `HookEvent` to Inspector via socket
3. Inspector dispatches to:
   - `SessionLogManager` → writes JSONL file
   - `TUI` → displays event
4. Inspector sends `HookResponse` with `returnValue: null`
5. Shim returns `null` to Claude Code
6. Claude Code continues execution

### Interactive Mode

1-3. Same as monitor mode
4. Inspector sees `interactive: true` and sets `pendingResponse` for event
5. Inspector pauses hook response, awaits user input via TUI
6. User enters JSON in TUI
7. Inspector sends `HookResponse` with user's JSON
8. Shim returns user's JSON to Claude Code
9. **Claude Code may wait for this value before continuing**

## Session Management

Sessions are identified by `sessionId` which comes from:
- `CLAUDE_SESSION_ID` environment variable
- `CLAUDE_API_SESSION_ID` environment variable
- Fallback: `local_${process.pid}`

Logs are stored as:
```
~/.claude-code-hook-inspector/logs/sessions/
├── 2026-04-20_abc123.jsonl
├── 2026-04-20_def456.jsonl
└── 2026-04-21_ghi789.jsonl
```

## IPC Protocol

All messages are newline-delimited JSON.

**Shim → Inspector:**
```json
{"type":"hook_event","id":"h_123_abc","hook":"pre-tool","sessionId":"abc123","timestamp":1713000000000,"payload":{"toolName":"Read","input":{}}}
```

**Inspector → Shim:**
```json
{"type":"hook_response","id":"h_123_abc","returnValue":{"content":[{"type":"text","text":"modified input"}]}}
```

## Error Handling

1. **Socket not available**: Shim returns `null`, no monitoring occurs
2. **Inspector crash**: Shims continue to work (degraded mode)
3. **Invalid JSON**: Logged as error, skipped
4. **Session timeout**: 30 second timeout for hook response, then `null` is returned

## Future: HTTP API

For remote monitoring or integration with external tools:

```
┌─────────────┐     HTTP/JSON-RPC     ┌─────────────┐
│  External   │ ──────────────────▶  │  Inspector  │
│   Client   │ ◀──────────────────  │   Server    │
└─────────────┘                      └─────────────┘
```

But for now, only local Unix socket is supported.
