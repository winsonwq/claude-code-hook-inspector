import { InspectorServer } from '../inspector/server.js'
import chalk from 'chalk'
import readline from 'readline'

let server: InspectorServer | null = null

// Hook name colors
const HOOK_COLORS: Record<string, string> = 'cyan'

const hookColors: Record<string, string> = {
  'pre-tool': 'cyan',
  'post-tool': 'green',
  'on-tool-error': 'red',
  'user-prompt': 'yellow',
  'session-start': 'blue',
  'session-end': 'blue',
  'notification': 'magenta',
  'stop': 'red',
  'stop-failure': 'red',
  'cwd-changed': 'cyan',
  'file-changed': 'green',
  'config-change': 'yellow',
  'permission-request': 'magenta',
  'permission-denied': 'red',
  'pre-compact': 'cyan',
  'post-compact': 'green'
}

function getHookColor(hook: string): string {
  return hookColors[hook] || 'white'
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

    // Hooks that can control behavior and may need input
    // Based on Claude Code hooks docs
    const hooksWithDecision = new Set([
      'pre-tool',           // Can block/modify tool call
      'permission-request', // Can allow/deny
      'user-prompt',       // Can block prompt
      'stop',              // Can block stop
      'config-change',      // Can block config change
      'permission-denied', // Can return retry: true
      'pre-compact',       // Can block compaction
      'subagent-stop',     // Can block subagent stop
      'teammate-idle',     // Can block teammate idle
      'task-created',      // Can block task creation
      'task-completed',    // Can block task completion
      'elicitation',       // Can deny elicitation
      'elicitation-result' // Can block elicitation result
    ])

    if (interactive) {
      dispatcher.setInputCallback(async (event) => {
        const color = getHookColor(event.hook)
        const time = new Date(event.timestamp).toLocaleTimeString()

        console.log()
        console.log(chalk[color].bold(`[${time}] ${event.hook}`))
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
        const color = getHookColor(event.hook)
        const time = new Date(event.timestamp).toLocaleTimeString()

        console.log(chalk[color].bold(`[${time}] ${event.hook}`))
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
