# CCHI - Claude Code Hook Inspector

## 概述

一个 TypeScript NPM 工具，用于监控和调试 Claude Code 的 hooks。

**项目名**：`claude-code-hook-inspector`
**npm 包名**：`cchi`
**CLI 命令**：`cchi`

**核心问题待验证**：Claude Code hooks 是同步等待返回值，还是 fire-and-forget？

---

## 工作模式

### 模式 1：Monitor（监控模式）

- 启动 inspector 服务后，Claude Code 所有触发的 hooks 事件被捕获
- Ink TUI 实时展示 hook 事件流
- 所有事件记录到 JSONL 日志文件，按 session 隔离
- Hook 正常返回 null（不干预 Claude Code 行为）

### 模式 2：Interactive（交互模式）

- 启动 inspector 服务时加 `--interactive` flag
- 当 hook 被触发时，TUI 暂停并等待用户输入
- 用户在底部面板输入 JSON 文本作为返回值
- 返回值注入到 hook 响应中，影响 Claude Code 执行

---

## CLI 命令

```bash
# 初始化（安装 hooks）
cchi init

# 启动 inspector（监控模式）
cchi start

# 启动 inspector（交互模式）
cchi start --interactive

# 查看日志
cchi logs [--session <id>] [--hook <name>]

# 停止服务
cchi stop

# 卸载 hooks
cchi uninstall
```

---

## Hook 安装机制

### postinstall / `cchi init`

修改 `~/.claude/settings.json`，添加 hooks 指向本包内的 shims：

```json
{
  "hooks": {
    "pre-tool": "<package>/dist/hooks/shims.js",
    "post-tool": "<package>/dist/hooks/shims.js",
    "pre-command": "<package>/dist/hooks/shims.js",
    "post-command": "<package>/dist/hooks/shims.js",
    "on-tool-error": "<package>/dist/hooks/shims.js",
    "on-command-error": "<package>/dist/hooks/shims.js"
  }
}
```

### 注册的 Hooks

| Hook | 用途 | 支持返回值 |
|------|------|-----------|
| `pre-tool` | 工具执行前 | 是 |
| `post-tool` | 工具执行后 | 是 |
| `pre-command` | 命令执行前 | 是 |
| `post-command` | 命令执行后 | 是 |
| `on-tool-error` | 工具错误时 | 是 |
| `on-command-error` | 命令错误时 | 是 |

---

## 通信机制

- **IPC**：Unix Domain Socket
- **Socket 路径**：`/tmp/cchi-inspector.sock`
- **协议**：JSON 消息流

### 消息格式

**Shim → Inspector**：
```json
{
  "type": "hook_event",
  "hook": "pre-tool",
  "sessionId": "s_abc123",
  "timestamp": 1713000000000,
  "payload": { /* hook 原始参数 */ }
}
```

**Inspector → Shim**：
```json
{
  "type": "hook_response",
  "hook": "pre-tool",
  "returnValue": null | { /* 用户输入的 JSON */ }
}
```

**心跳检测**：
```json
{ "type": "ping" }
{ "type": "pong" }
```

---

## 日志策略

```
~/.claude-code-hook-inspector/
├── logs/
│   └── sessions/
│       ├── 2026-04-20_abc123.jsonl
│       └── 2026-04-20_def456.jsonl
└── inspector.log
```

- **Session 日志**：JSONL 格式，每个 hook 事件一行
- **日志内容**：时间戳、hook name、sessionId、payload、returnValue（如果有）
- **保留策略**：保留最近 100 个 session（可配置）
- **日志路径**：`~/.claude-code-hook-inspector/logs/`

---

## 项目结构

```
claude-code-hook-inspector/
├── bin/
│   └── cli.ts              # CLI 入口 (cchi 命令)
├── src/
│   ├── index.ts            # 包主入口
│   ├── commands/           # CLI 命令实现
│   │   ├── start.ts
│   │   ├── init.ts
│   │   ├── logs.ts
│   │   ├── stop.ts
│   │   └── uninstall.ts
│   ├── inspector/          # Inspector 服务核心
│   │   ├── server.ts       # Unix socket server
│   │   ├── dispatcher.ts   # 事件分发
│   │   └── types.ts
│   ├── hooks/              # Claude Code hook shims
│   │   ├── index.ts        # Shim 入口（根据 hook 名分发）
│   │   └── ipc.ts          # Unix socket 客户端
│   └── ui/                 # Ink TUI
│       ├── index.tsx       # TUI 主入口
│       ├── dashboard.tsx   # 主监控界面
│       └── input-panel.tsx # 交互模式输入面板
├── package.json
├── tsconfig.json
├── SPEC.md
├── README.md
├── agents.md
└── docs/
    ├── architecture.md
    └── hooks-reference.md
```

---

## 技术选型

| 组件 | 选型 |
|------|------|
| 语言 | TypeScript |
| CLI 框架 | commander |
| TUI | ink + react |
| IPC | Unix Domain Socket（Node.js net 模块） |
| 日志 | pino + pino-pretty（日志轮转通过外部 logrotate） |
| 构建 | tsup |

---

## 交互模式流程（简化版 v1）

1. Hook 触发 → Shim 发送事件到 Inspector
2. Inspector 检查是 interactive 模式
3. TUI 在底部显示 `[Input return value as JSON, or press Enter for null:]`
4. 用户输入 JSON 文本
5. Inspector 解析 JSON，发送给 Shim
6. Shim 作为 hook 返回值返回给 Claude Code
7. 流程继续

**v1 局限性**：
- 不验证 JSON 格式合法性（用户自己保证）
- 不做 hook 特定的 UI 优化
- 返回值直接透传，不做转换

---

## 待验证

1. Claude Code 是否等待 hook 返回值后才继续执行？
2. Hook 返回值格式具体是什么？（`{ content: [...] }` 还是其他？）
3. 不同 hook 的返回值是否有不同限制？

---

## 优先级

1. **P0**：Monitor 模式跑通（TUI 显示事件 + 日志记录）
2. **P0**：Interactive 模式跑通（JSON 文本注入）
3. **P1**：Session 日志隔离和管理
4. **P2**：日志轮转和清理
5. **P3**：更友好的交互 UI（引导式编辑）
