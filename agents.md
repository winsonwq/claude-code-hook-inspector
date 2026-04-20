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

## Release Process

发布新版本到 npm 的正确流程：

1. **更新 package.json 版本号**为目标版本
2. **提交代码**：`git add package.json && git commit -m "release: v{x.y.z}"`
3. **推送到 main**：`git push origin main`
4. **创建并推送 tag**：`git tag v{x.y.z} && git push origin v{x.y.z}`

CI 检测到 tag 推送后会自动：build → npm publish

## Open Questions

1. Does Claude Code actually wait for hook return values?
2. Are hooks executed synchronously or in parallel?
3. What's the timeout behavior if a hook hangs?
4. Can hooks modify the execution path (e.g., skip a tool)?

These need to be empirically tested with the actual Claude Code implementation.
