import { InspectorServer } from '../inspector/server.js'
import { runTUI } from '../ui/index.js'
import { HookEvent } from '../inspector/types.js'
import chalk from 'chalk'
import readline from 'readline'

let server: InspectorServer | null = null
let inputMode: 'json' | 'guided' = 'json' // v1 is JSON mode only

export async function start(options: { interactive?: boolean }) {
  const interactive = options.interactive || false

  console.log(chalk.blue('🚀 Starting Claude Code Hook Inspector...'))
  console.log(chalk.gray(`Mode: ${interactive ? 'Interactive' : 'Monitor'}`))

  server = new InspectorServer(interactive)
  server.setInteractive(interactive)

  try {
    await server.start()
    console.log(chalk.green('✓ Inspector server started'))
    console.log(chalk.gray('Socket: /tmp/cchi-inspector.sock'))
    console.log()

    // Set up event handling
    const dispatcher = server.getDispatcher()

    if (interactive) {
      // Interactive mode - wait for input after each event
      dispatcher.setInputCallback(async (event: HookEvent) => {
        return await waitForUserInput(event)
      })

      // Run interactive TUI
      dispatcher.onEvent((event) => {
        // TUI handles display
      })

      await runTUI(dispatcher, interactive)
    } else {
      // Monitor mode - just display events
      let eventCount = 0

      dispatcher.onEvent((event) => {
        eventCount++
        const time = new Date(event.timestamp).toLocaleTimeString()
        console.log(
          chalk.yellow(`[${time}]`) +
          chalk.cyan(` ${event.hook}`) +
          chalk.gray(` (session: ${event.sessionId.slice(0, 8)}...)`)
        )
        console.log(chalk.gray(`  payload: ${JSON.stringify(event.payload)}`))
        console.log()
      })

      console.log(chalk.green('Monitoring hook events...'))
      console.log(chalk.gray('Press Ctrl+C to stop\n'))

      // Keep process alive
      await new Promise(() => {})
    }
  } catch (err) {
    console.error(chalk.red('Failed to start inspector:'), err)
    process.exit(1)
  }
}

// Wait for user JSON input
async function waitForUserInput(event: HookEvent): Promise<unknown> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    })

    const time = new Date(event.timestamp).toLocaleTimeString()
    console.log(chalk.yellow(`\n[${time}] ${chalk.cyan(event.hook)} triggered`))
    console.log(chalk.gray(`Session: ${event.sessionId}`))
    console.log(chalk.gray(`Payload: ${JSON.stringify(event.payload, null, 2)}`))
    console.log()

    if (inputMode === 'json') {
      rl.question(
        chalk.magenta('[Interactive Mode] Enter JSON return value (or press Enter for null): '),
        (answer) => {
          rl.close()
          if (!answer.trim()) {
            resolve(null)
            return
          }
          try {
            const parsed = JSON.parse(answer)
            resolve(parsed)
          } catch {
            console.log(chalk.red('Invalid JSON, returning null'))
            resolve(null)
          }
        }
      )
    }
  })
}

// Handle shutdown
process.on('SIGINT', async () => {
  console.log(chalk.yellow('\nShutting down...'))
  if (server) {
    await server.stop()
  }
  process.exit(0)
})
