import fs from 'fs'
import path from 'path'
import chalk from 'chalk'

const SETTINGS_PATH = path.join(process.env.HOME || '/tmp', '.claude', 'settings.json')
const INSPECTOR_HOOK_MARKER = 'cchi-inspector'

export async function uninstall() {
  console.log(chalk.blue('Uninstalling Claude Code Hook Inspector hooks...'))

  if (!fs.existsSync(SETTINGS_PATH)) {
    console.log(chalk.yellow('No settings.json found'))
    return
  }

  try {
    const settings = JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf-8'))

    if (!settings.hooks) {
      console.log(chalk.yellow('No hooks configured'))
      return
    }

    // Find hooks with our marker in description
    const hooksToRemove: string[] = []

    for (const [hookName, hookConfig] of Object.entries(settings.hooks)) {
      const configArray = hookConfig as Array<{matcher?: string, hooks?: Array<{type?: string, command?: string, description?: string}>}>
      if (Array.isArray(configArray)) {
        for (const config of configArray) {
          if (config.hooks && Array.isArray(config.hooks)) {
            for (const hook of config.hooks) {
              // Check if this hook has our marker
              if (hook.description === INSPECTOR_HOOK_MARKER) {
                if (!hooksToRemove.includes(hookName)) {
                  hooksToRemove.push(hookName)
                }
              }
            }
          }
        }
      }
    }

    if (hooksToRemove.length === 0) {
      console.log(chalk.yellow('No hooks from this package were found'))
      return
    }

    // Remove them
    for (const hook of hooksToRemove) {
      delete settings.hooks[hook]
    }

    // Clean up empty hooks object
    if (Object.keys(settings.hooks).length === 0) {
      delete settings.hooks
    }

    // Save
    fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2))

    console.log(chalk.green('✓ Hooks uninstalled'))
    console.log(chalk.gray(`Removed ${hooksToRemove.length} hook(s): ${hooksToRemove.join(', ')}`))
  } catch (err) {
    console.error(chalk.red('Failed to uninstall hooks:'), err)
  }
}
