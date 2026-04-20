#!/usr/bin/env node

// CLI entry point
import { Command } from 'commander'
import { start } from './commands/start.js'
import { init } from './commands/init.js'
import { logs } from './commands/logs.js'
import { stop } from './commands/stop.js'
import { uninstall } from './commands/uninstall.js'
import packageJson from '../package.json' assert { type: 'json' }
const { version } = packageJson

const program = new Command()

program
  .name('cchi')
  .description('Claude Code Hook Inspector - Monitor and debug Claude Code hooks')
  .version(version)

program
  .command('init')
  .description('Initialize and install hooks to ~/.claude/settings.json')
  .action(init)

program
  .command('start')
  .description('Start the inspector server')
  .option('-i, --interactive', 'Enable interactive mode for returning custom values')
  .option('-p, --port <port>', 'Port for HTTP API (future)')
  .action(start)

program
  .command('logs')
  .description('View hook event logs')
  .option('-s, --session <id>', 'Filter by session ID')
  .option('-h, --hook <name>', 'Filter by hook name')
  .option('-f, --follow', 'Follow log output')
  .action(logs)

program
  .command('stop')
  .description('Stop the inspector server')
  .action(stop)

program
  .command('uninstall')
  .description('Remove hooks from ~/.claude/settings.json')
  .action(uninstall)

program.parse()
