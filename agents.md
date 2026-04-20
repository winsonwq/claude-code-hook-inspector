# Agent Design Notes

## Design Decisions

### Why Unix Socket instead of HTTP?

1. **Local-only communication**: Inspector and hooks run on the same machine
2. **Low latency**: No HTTP parsing overhead
3. **Simpler IPC**: Direct byte stream without HTTP protocol complexity
4. **No port conflicts**: Uses filesystem path instead of network ports

### Why JSONL for logs?

1. **Streaming-friendly**: Append-only, easy to tail
2. **Structured**: Each event is a complete JSON object
3. **Analysis-friendly**: Can use `jq` or similar tools
4. **Debuggable**: Human-readable when pretty-printed

### Why Ink/React for TUI?

1. **Familiar patterns**: React developers can build TUI components easily
2. **Component model**: Reusable UI components
3. **State management**: React's state model fits event streams well
4. **Stable**: `ink` is battle-tested by CLI tools like `blessed`

## Future Considerations

### HTTP API (Future)

If we add an HTTP API for remote monitoring:

- Use JSON-RPC over HTTP for simplicity
- Add authentication (maybe just API key for now)
- Consider WebSocket for real-time event streaming

### Session Management

Currently sessions are identified by Claude Code's session ID. Future improvements:

- Name sessions manually
- Merge/split sessions
- Export session recordings

### Hook Return Value Schema

Need to research Claude Code's expected return format for each hook. Current assumption:

```typescript
// For content injection
{ content: [{ type: 'text', text: '...' }] }
```

But we need to verify this with actual Claude Code behavior.

## Open Questions

1. Does Claude Code actually wait for hook return values?
2. Are hooks executed synchronously or in parallel?
3. What's the timeout behavior if a hook hangs?
4. Can hooks modify the execution path (e.g., skip a tool)?

These need to be empirically tested with the actual Claude Code implementation.
