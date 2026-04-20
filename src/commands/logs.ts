import fs from 'fs'
import path from 'path'
import chalk from 'chalk'
import readline from 'readline'

const LOG_DIR = path.join(process.env.HOME || '/tmp', '.claude-code-hook-inspector', 'logs', 'sessions')

interface LogOptions {
  session?: string
  hook?: string
  follow?: boolean
}

export async function logs(options: LogOptions) {
  if (!fs.existsSync(LOG_DIR)) {
    console.log(chalk.yellow('No logs found. Run `cchi start` first to generate logs.'))
    return
  }

  const files = fs.readdirSync(LOG_DIR)
    .filter(f => f.endsWith('.jsonl'))
    .sort()
    .reverse()

  if (files.length === 0) {
    console.log(chalk.yellow('No log files found.'))
    return
  }

  if (options.follow) {
    await followLogs(options)
  } else {
    displayLogs(options, files)
  }
}

function displayLogs(options: LogOptions, files: string[]) {
  for (const file of files) {
    if (options.session && !file.includes(options.session)) {
      continue
    }

    const filepath = path.join(LOG_DIR, file)
    const content = fs.readFileSync(filepath, 'utf-8')
    const lines = content.split('\n').filter(l => l.trim())

    for (const line of lines) {
      try {
        const event = JSON.parse(line)
        if (options.hook && event.hook !== options.hook) {
          continue
        }
        printEvent(event)
      } catch {
        // Skip invalid lines
      }
    }
  }
}

async function followLogs(options: LogOptions) {
  const rl = readline.createInterface({
    input: process.stdin,
    terminal: false
  })

  // Watch for new files
  const watched = new Set<string>()

  const watch = () => {
    const files = fs.readdirSync(LOG_DIR)
    for (const file of files) {
      if (!watched.has(file) && file.endsWith('.jsonl')) {
        if (options.session && !file.includes(options.session)) {
          continue
        }
        watched.add(file)
        tailFile(path.join(LOG_DIR, file))
      }
    }
  }

  const tailFile = (filepath: string) => {
    let position = fs.statSync(filepath).size

    const interval = setInterval(() => {
      try {
        const stats = fs.statSync(filepath)
        if (stats.size > position) {
          const stream = fs.createReadStream(filepath, { start: position })
          stream.on('data', (chunk) => {
            const lines = chunk.toString().split('\n').filter(l => l.trim())
            for (const line of lines) {
              try {
                const event = JSON.parse(line)
                if (!options.hook || event.hook === options.hook) {
                  printEvent(event)
                }
              } catch {}
            }
          })
          stream.on('end', () => {
            position = stats.size
          })
        }
      } catch {}
    }, 1000)
  }

  watch()
  setInterval(watch, 5000)

  // Keep alive
  await new Promise(() => {})
}

function printEvent(event: any) {
  const time = new Date(event.timestamp).toLocaleString()
  console.log(
    chalk.yellow(`[${time}]`) +
    chalk.cyan(` ${event.hook}`) +
    chalk.gray(` (id: ${event.id})`)
  )
  if (event.payload) {
    console.log(chalk.gray(`  payload: ${JSON.stringify(event.payload)}`))
  }
  if (event.returnValue !== undefined) {
    console.log(chalk.green(`  returnValue: ${JSON.stringify(event.returnValue)}`))
  }
  console.log()
}
