#!/usr/bin/env node

// Test script that simulates Claude Code calling a hook
import { spawn } from 'child_process'

const hookInput = {
  hook_event_name: 'PreToolUse',
  session_id: 'test_session_123',
  cwd: '/Users/test/project',
  tool_name: 'Read',
  tool_input: {
    filePath: '/Users/test/project/package.json'
  }
}

console.log('Simulating Claude Code hook call...')
console.log('Input:', JSON.stringify(hookInput, null, 2))

const hookScript = spawn('node', ['dist/hooks.js'], {
  stdio: ['pipe', 'pipe', 'pipe']
})

hookScript.stdin.write(JSON.stringify(hookInput))
hookScript.stdin.end()

let stdout = ''
let stderr = ''

hookScript.stdout.on('data', (data) => {
  stdout += data.toString()
})

hookScript.stderr.on('data', (data) => {
  stderr += data.toString()
})

hookScript.on('close', (code) => {
  console.log(`\nHook script exited with code: ${code}`)
  
  if (stderr) {
    console.log('Stderr:', stderr)
  }
  
  if (stdout) {
    console.log('Stdout:', stdout)
    
    try {
      const output = JSON.parse(stdout.trim())
      console.log('\nParsed output:', JSON.stringify(output, null, 2))
      
      // Verify output format matches Claude Code expectations
      if (output.hookSpecificOutput && output.hookSpecificOutput.hookEventName === 'PreToolUse') {
        console.log('\n✅ Hook output format is correct for Claude Code!')
      } else {
        console.log('\n❌ Hook output format is incorrect')
      }
    } catch (e) {
      console.log('\n❌ Failed to parse JSON output:', e.message)
    }
  }
})