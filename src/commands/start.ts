import { InspectorServer } from '../inspector/server.js'
import { HOOK_NAME_MAP, HookName } from '../inspector/types.js'
import chalk from 'chalk'
import readline from 'readline'

// Force enable colors (chalk auto-detection may fail in some terminals)
chalk.level = 3

let server: InspectorServer | null = null

function colorizeHook(hook: HookName, text: string): string {
  const officialName = HOOK_NAME_MAP[hook]
  switch (officialName) {
    case 'PreToolUse': return chalk.cyan(text)
    case 'PostToolUse': return chalk.green(text)
    case 'PostToolUseFailure': return chalk.red(text)
    case 'UserPromptSubmit': return chalk.yellow(text)
    case 'SessionStart': return chalk.blue(text)
    case 'SessionEnd': return chalk.blue(text)
    case 'Notification': return chalk.magenta(text)
    case 'Stop': return chalk.red(text)
    case 'StopFailure': return chalk.red(text)
    case 'CwdChanged': return chalk.cyan(text)
    case 'FileChanged': return chalk.green(text)
    case 'ConfigChange': return chalk.yellow(text)
    case 'PermissionRequest': return chalk.magenta(text)
    case 'PermissionDenied': return chalk.red(text)
    case 'PreCompact': return chalk.cyan(text)
    case 'PostCompact': return chalk.green(text)
    default: return chalk.white(text)
  }
}

function getOfficialHookName(hook: HookName): string {
  return HOOK_NAME_MAP[hook] || hook
}

function formatJson(obj: unknown): string {
  return JSON.stringify(obj, null, 2)
}

export async function start(options: { interactive?: boolean }) {
  const interactive = options.interactive || false

  console.log(chalk.blue('🚀 Starting Claude Code Hook Inspector...'))
  console.log(chalk.gray(`Mode: ${interactive ? 'Interactive' : 'Monitor'}`))
  console.log()

  server = new InspectorServer(interactive)
  server.setInteractive(interactive)

  try {
    await server.start()
    console.log(chalk.green('✓ Inspector server started'))
    console.log(chalk.gray('Socket: /tmp/cchi-inspector.sock'))
    console.log()
    console.log(chalk.gray('Monitoring hook events...'))
    console.log(chalk.gray('Press Ctrl+C to stop\n'))

    const dispatcher = server.getDispatcher()

    // Hooks that can control behavior and may need input (using official names)
    // Based on Claude Code hooks docs
    const hooksWithDecision = new Set([
      'PreToolUse',           // Can block/modify tool call
      'PostToolUse',          // Can return result
      'PostToolUseFailure',   // Can return additionalContext
      'UserPromptSubmit',     // Can block prompt
      'PermissionRequest',     // Can allow/deny
      'Stop',                 // Can block stop
      'ConfigChange',         // Can block config change
      'PermissionDenied',     // Can return retry: true
      'PreCompact',           // Can block compaction
      'SubagentStop',         // Can block subagent stop
      'TeammateIdle',         // Can block teammate idle
      'TaskCreated',          // Can block task creation
      'TaskCompleted',        // Can block task completion
      'Elicitation',          // Can deny elicitation
      'ElicitationResult'     // Can block elicitation result
    ])

    if (interactive) {
      dispatcher.setInputCallback(async (event) => {
        const time = new Date(event.timestamp).toLocaleTimeString()

        console.log()
        console.log(colorizeHook(event.hook, `[${time}] ${getOfficialHookName(event.hook)}`))
        console.log(chalk.gray('  payload:'))
        console.log(formatJson(event.payload).split('\n').map((l: string) => chalk.gray('    ') + l).join('\n'))

        if (hooksWithDecision.has(event.hook)) {
          console.log()
          return new Promise((resolve) => {
            const rl = readline.createInterface({
              input: process.stdin,
              output: process.stdout
            })

            rl.question(chalk.cyan('  > enter return value (JSON or Enter for null): '), (answer: string) => {
              rl.close()
              if (!answer.trim()) {
                console.log(chalk.gray('  ← null'))
                resolve(null)
              } else {
                try {
                  const parsed = JSON.parse(answer)
                  console.log(chalk.green(`  ← ${JSON.stringify(parsed).slice(0, 50)}${JSON.stringify(parsed).length > 50 ? '...' : ''}`))
                  resolve(parsed)
                } catch {
                  console.log(chalk.red('  ✗ invalid JSON, returning null'))
                  resolve(null)
                }
              }
              console.log()
            })
          })
        } else {
          console.log(chalk.gray('  ← (no return value needed)'))
          console.log()
          return null
        }
      })
    } else {
      dispatcher.onEvent((event) => {
        const time = new Date(event.timestamp).toLocaleTimeString()

        console.log(colorizeHook(event.hook, `[${time}] ${getOfficialHookName(event.hook)}`))
        console.log(chalk.gray('  payload:'))
        console.log(formatJson(event.payload).split('\n').map((l: string) => chalk.gray('    ') + l).join('\n'))
        console.log()
      })
    }

    // Keep process alive
    await new Promise(() => {})
  } catch (err) {
    console.error(chalk.red('Failed to start inspector:'), err)
    process.exit(1)
  }
}

// Handle shutdown
process.on('SIGINT', async () => {
  console.log(chalk.yellow('\nShutting down...'))
  if (server) {
    await server.stop()
  }
  process.exit(0)
})
