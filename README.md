# CCHI - Claude Code Hook Inspector

Monitor and debug Claude Code hooks with an interactive TUI.

## Installation

```bash
npm install -g cchi
```

## Quick Start

```bash
# Initialize hooks (required first time)
cchi init

# Start inspector in monitor mode
cchi start

# Or start in interactive mode
cchi start --interactive
```

## Features

### Monitor Mode

When running in monitor mode, all Claude Code hook events are captured and displayed in real-time:

```
[10:30:15] pre-tool (session: abc123...)
  payload: {"toolName":"Read","input":{"filePath":"/Users/..."}}
```

### Interactive Mode

In interactive mode, you can inject custom return values into hooks to influence Claude Code's behavior:

```
[Interactive Mode]
pre-tool triggered at 10:30:15
Session: abc123
Payload: {"toolName":"Read","input":{"filePath":"/Users/..."}}

Enter JSON return value (or press Enter for null):
```

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

## Supported Hooks

| Hook | Trigger |
|------|---------|
| `pre-tool` | Before a tool is executed |
| `post-tool` | After a tool completes |
| `pre-command` | Before a shell command runs |
| `post-command` | After a shell command completes |
| `on-tool-error` | When a tool execution fails |
| `on-command-error` | When a shell command fails |

## How It Works

```
Claude Code → Hook Shim → Unix Socket → Inspector Server → TUI / Log File
```

The hooks are installed as shims that forward events to the inspector server via a Unix domain socket.

## Configuration

Logs are stored in `~/.claude-code-hook-inspector/logs/sessions/` in JSONL format.

## License

MIT
