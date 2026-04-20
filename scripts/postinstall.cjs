#!/usr/bin/env node
// Postinstall script - auto-init on npm install

const { execSync } = require('child_process')
const path = require('path')

console.log('🔧 Running postinstall setup for claude-code-hook-inspector...')

try {
  // Try direct node execution since dist might not be built yet
  const packagePath = path.resolve(__dirname, '..')
  const distCliPath = path.join(packagePath, 'dist', 'cli.js')

  // Check if dist exists
  try {
    require('fs').accessSync(path.join(packagePath, 'dist', 'cli.js'))
  } catch {
    console.log('⚠️ Package not built yet. Run `npm run build` first.')
    console.log('   Then run `cchi init` manually to install hooks.')
    return
  }

  execSync(`node ${distCliPath} init`, { stdio: 'inherit' })
  console.log('✅ Hooks installed successfully')
} catch (e) {
  console.log('⚠️ Could not auto-initialize. Run `cchi init` manually to install hooks.')
  console.log('   After running: npm install -g cchi')
}
