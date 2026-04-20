# CCHI - Claude Code Hook 调试器

实时监控和调试 Claude Code 的 hook 事件。

## 安装

```bash
npm install -g claude-code-hook-inspector
```

## 快速开始

```bash
# 首次使用时初始化 hook
cchi init

# 启动调试器（监控模式）
cchi start

# 或启动交互模式，可输入返回值影响 Claude Code 行为
cchi start --interactive
```

## 功能说明

### 监控模式

运行于监控模式时，所有 Claude Code hook 事件都会被捕获并实时显示：

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

### 交互模式

在交互模式下，你可以向 hooks 注入返回值来影响 Claude Code 的行为。只有可以控制行为的 hook 才会提示输入，其他 hook 只显示信息并自动返回 null。

```
[10:30:15] pre-tool
  payload:
    {
      "hookEventName": "PreToolUse",
      "sessionId": "abc123",
      "toolName": "Bash"
    }

  > 输入返回值 (JSON 或直接回车返回 null): {"permissionDecision": "allow"}
```

## Hook 参考

### 需要输入的 Hooks

这些 hook 可以控制 Claude Code 的行为，在交互模式下会提示输入返回值：

#### `pre-tool` - 工具执行前

可以阻止或修改工具执行。

**输入示例：**
```json
{"permissionDecision": "allow"}
```
```json
{"permissionDecision": "deny", "permissionDecisionReason": "被调试器阻止"}
```

#### `permission-request` - 权限对话框出现时

可以代表用户允许或拒绝权限。

**输入示例：**
```json
{"decision": {"behavior": "allow"}}
```
```json
{"decision": {"behavior": "deny", "message": "被调试器拒绝"}}
```

#### `user-prompt` - 用户提交 prompt 时

可以阻止或添加上下文到用户 prompt。

**输入示例：**
```json
{"decision": "block", "reason": "被调试器阻止"}
```
```json
{"additionalContext": "由调试器添加的额外上下文"}
```

#### `stop` - Claude 结束响应时

可以阻止 Claude 停止。

**输入示例：**
```json
{"decision": "block", "reason": "继续工作"}
```

#### `config-change` - 配置更改时

可以阻止配置更改。

**输入示例：**
```json
{"decision": "block", "reason": "不允许配置更改"}
```

#### `permission-denied` - 自动模式拒绝工具时

可以告诉模型重试被拒绝的工具。

**输入示例：**
```json
{"retry": true}
```

#### `pre-compact` - 上下文压缩前

可以阻止压缩。

**输入示例：**
```json
{"decision": "block", "reason": "压缩被阻止"}
```

#### `subagent-stop` - 子代理结束时

可以阻止子代理停止。

**输入示例：**
```json
{"decision": "block", "reason": "继续工作"}
```

#### `teammate-idle` - 队友即将空闲时

可以阻止队友空闲。

**输入示例：**
```json
{"continue": false, "stopReason": "继续工作"}
```

#### `task-created` - 任务创建时

可以阻止任务创建。

**输入示例：**
```json
{"continue": false, "stopReason": "不允许创建任务"}
```

#### `task-completed` - 任务标记为完成时

可以阻止任务完成。

**输入示例：**
```json
{"continue": false, "stopReason": "测试必须先通过"}
```

#### `elicitation` - MCP 服务器请求用户输入时

可以拒绝 elicitation。

**输入示例：**
```json
{"action": "decline"}
```

#### `elicitation-result` - 用户响应 elicitation 后

可以阻止响应。

**输入示例：**
```json
{"action": "decline"}
```

### 仅通知的 Hooks

这些 hook 只会触发通知，不能控制行为：

| Hook | 描述 |
|------|------|
| `session-start` | 会话开始或恢复 |
| `session-end` | 会话结束 |
| `post-tool` | 工具执行成功 |
| `post-tool-use-failure` | 工具执行失败 |
| `notification` | 发送通知 |
| `stop-failure` | 由于 API 错误结束 |
| `cwd-changed` | 工作目录更改 |
| `file-changed` | 监视的文件更改 |
| `subagent-start` | 子代理启动 |
| `post-compact` | 压缩完成 |
| `instructions-loaded` | 指令文件加载 |
| `worktree-create` | 工作树创建 |
| `worktree-remove` | 工作树移除 |

## 命令

| 命令 | 描述 |
|------|------|
| `cchi init` | 安装 hooks 到 Claude Code 设置 |
| `cchi start` | 启动调试器（监控模式） |
| `cchi start --interactive` | 启动调试器（交互模式） |
| `cchi logs` | 查看历史 hook 事件日志 |
| `cchi logs --follow` | 跟踪新日志条目 |
| `cchi stop` | 停止调试器服务 |
| `cchi uninstall` | 从 Claude Code 移除 hooks |

## 工作原理

```
Claude Code → Hook Shim → Unix Socket → Inspector Server → CLI / 日志文件
```

Hooks 被安装为垫片，通过 Unix 域套接字将事件转发到调试器服务器。

## 配置

日志存储在 `~/.claude-code-hook-inspector/logs/sessions/`，格式为 JSONL。

## License

MIT
