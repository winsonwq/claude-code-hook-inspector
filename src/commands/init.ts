import fs from 'fs'
import path from 'path'
import chalk from 'chalk'
import { fileURLToPath } from 'url'

const SETTINGS_PATH = path.join(process.env.HOME || '/tmp', '.claude', 'settings.json')
const INSPECTOR_HOOK_MARKER = 'cchi-inspector'

// Resolve the hooks path - in production it's in dist/hooks.js
// The CLI entry point is bin/cli.js but hooks should run dist/hooks.js directly
function resolveHooksPath(): string {
  // process.argv[1] is the CLI entry point (bin/cli.js)
  // This may be a symlink, so resolve it first to find the actual package location
  const cliPath = process.argv[1]
  if (!cliPath) {
    throw new Error('Could not determine CLI path')
  }
  // Resolve symlinks to get the real path to the package
  const realCliPath = fs.realpathSync(cliPath)
  const cliDir = path.dirname(realCliPath)
  // dist/ is sibling to bin/, so go up and into dist
  const hooksPath = path.resolve(cliDir, '..', 'dist', 'hooks.js')
  return hooksPath
}

export async function init() {
  console.log(chalk.blue('Initializing Claude Code Hook Inspector...'))

  const hooksPath = resolveHooksPath()

  // Load existing settings
  let settings: { hooks?: Record<string, unknown[]> } = {}
  try {
    if (fs.existsSync(SETTINGS_PATH)) {
      settings = JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf-8'))
    }
  } catch {
    console.log(chalk.yellow('No existing settings.json found, creating new one'))
  }

  // Save backup
  if (fs.existsSync(SETTINGS_PATH)) {
    const backupPath = `${SETTINGS_PATH}.backup`
    fs.copyFileSync(SETTINGS_PATH, backupPath)
    console.log(chalk.gray(`Backed up settings to ${backupPath}`))
  }

  // All Claude Code hook events
  const allHooks = [
    'PreToolUse',
    'PostToolUse',
    'PostToolUseFailure',
    'UserPromptSubmit',
    'SessionStart',
    'SessionEnd',
    'Stop',
    'StopFailure',
    'Notification',
    'CwdChanged',
    'FileChanged',
    'ConfigChange',
    'PermissionRequest',
    'PermissionDenied',
    'PreCompact',
    'PostCompact',
    'Elicitation',
    'ElicitationResult'
  ]

  // Build hooks config for all hook events
  const hooksConfig: Record<string, unknown[]> = {}
  for (const hook of allHooks) {
    hooksConfig[hook] = [
      {
        matcher: "",
        hooks: [
          {
            type: "command",
            command: `node "${hooksPath}"`,
            description: INSPECTOR_HOOK_MARKER
          }
        ]
      }
    ]
  }

  settings.hooks = hooksConfig

  // Ensure directory exists
  const dir = path.dirname(SETTINGS_PATH)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }

  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2))

  console.log(chalk.green('✓ Hooks installed successfully'))
  console.log(chalk.gray('\nInstalled hooks (Claude Code compatible):'))
  for (const hook of Object.keys(hooksConfig)) {
    console.log(chalk.gray(`  - ${hook}`))
  }
  console.log()
  console.log(chalk.blue('Next steps:'))
  console.log(chalk.gray('  1. Run ') + chalk.white('cchi start') + chalk.gray(' to start the inspector'))
  console.log(chalk.gray('  2. Or run ') + chalk.white('cchi start --interactive') + chalk.gray(' for interactive mode'))
}
