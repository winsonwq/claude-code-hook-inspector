// Claude Code Hook Inspector - Hook Router
// Claude Code passes JSON on stdin and expects JSON on stdout
// Exit codes: 0 = allow, 2 = block, other = allow with error logged

import { sendHookEvent, isConnected } from './ipc.js'
import process from 'process'

// Get session ID from input JSON
function getSessionId(input: Record<string, unknown>): string {
  return input.session_id as string ||
    process.env.CLAUDE_SESSION_ID ||
    process.env.CLAUDE_API_SESSION_ID ||
    `local_${process.pid}`
}

// Extract payload data based on hook type
function extractPayload(hookEventName: string, input: Record<string, unknown>): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    hookEventName,
    sessionId: getSessionId(input),
    ...input
  }

  // Extract tool-specific data
  if (['PreToolUse', 'PostToolUse', 'PostToolUseFailure'].includes(hookEventName)) {
    payload.toolName = input.tool_name
    payload.toolInput = input.tool_input
  }

  if (['PostToolUse', 'PostToolUseFailure'].includes(hookEventName)) {
    payload.toolResult = input.tool_result || input.error
  }

  // Extract permission data
  if (['PermissionRequest', 'PermissionDenied'].includes(hookEventName)) {
    payload.permissionType = input.permission_type
    payload.permissionData = input.permission_data
  }

  return payload
}

// Claude Code compatible hook handler
// Reads JSON from stdin, processes event, writes JSON to stdout
export async function claudeCodeHookHandler(): Promise<void> {
  try {
    // Read JSON from stdin
    const stdin = process.stdin
    let inputData = ''
    
    for await (const chunk of stdin) {
      inputData += chunk.toString()
    }

    if (!inputData.trim()) {
      // Empty input, exit with success (allow)
      process.exit(0)
    }

    const input = JSON.parse(inputData) as Record<string, unknown>
    const hookEventName = input.hook_event_name as string

    if (!hookEventName) {
      // No hook event name, exit with success
      process.exit(0)
    }

    // Hooks that require hookSpecificOutput structure
    // Based on Claude Code hooks docs
    const HOOKS_WITH_HOOK_SPECIFIC_OUTPUT = [
      'PreToolUse',         // permissionDecision, updatedInput, additionalContext
      'PermissionRequest',   // decision.behavior, updatedInput, updatedPermissions
      'PermissionDenied',    // retry
      'Elicitation',        // action, content
      'ElicitationResult'   // action, content
    ]

    // Hooks that use top-level decision field
    // Based on Claude Code hooks docs
    const HOOKS_WITH_TOP_DECISION = [
      'UserPromptSubmit',    // decision: "block"
      'PostToolUse',        // decision: "block"
      'PostToolUseFailure', // additionalContext
      'Stop',               // decision: "block"
      'SubagentStop',       // decision: "block"
      'ConfigChange',       // decision: "block"
      'PreCompact'          // decision: "block"
    ]

    // Map to internal hook name
    const internalHookName = hookEventName

    // Extract payload
    const payload = extractPayload(hookEventName, input)

    // Send to inspector (sendHookEvent handles connection internally)
    // If inspector is not running, it returns null
    const returnValue = await sendHookEvent(internalHookName, getSessionId(input), payload)

    // Return response to Claude Code
    if (returnValue !== undefined && returnValue !== null) {
      // If we have a return value from inspector
      if (HOOKS_WITH_HOOK_SPECIFIC_OUTPUT.includes(hookEventName)) {
        // Wrap in hookSpecificOutput structure
        console.log(JSON.stringify({ hookSpecificOutput: { hookEventName, ...returnValue } }))
      } else {
        // Output return value directly (for top-level decision hooks)
        console.log(JSON.stringify(returnValue))
      }
    } else if (HOOKS_WITH_HOOK_SPECIFIC_OUTPUT.includes(hookEventName)) {
      // For hooks that expect hookSpecificOutput structure, send minimal output
      console.log(JSON.stringify({ hookSpecificOutput: { hookEventName } }))
    } else if (HOOKS_WITH_TOP_DECISION.includes(hookEventName)) {
      // For hooks that use top-level decision, send empty object to allow
      console.log(JSON.stringify({}))
    } else {
      // For hooks that don't need hookSpecificOutput or decision
      // Return an empty object or minimal valid structure
      console.log(JSON.stringify({}))
    }

    process.exit(0)

  } catch (error) {
    // Log error but don't block Claude Code
    console.error(`Hook error: ${error}`)
    
    // Always exit with 0 to allow Claude Code to continue
    // Claude Code will show error in debug log but won't block execution
    process.exit(0)
  }
}

// For backward compatibility with old hook router
export async function hookRouter(hookName: string, ...args: unknown[]): Promise<unknown> {
  // This is for old-style hook calls (deprecated)
  const payload = args.length > 0 ? args[0] as Record<string, unknown> : {}
  
  if (!isConnected()) return undefined
  
  return sendHookEvent(hookName, 
    process.env.CLAUDE_SESSION_ID || process.env.CLAUDE_API_SESSION_ID || `local_${process.pid}`, 
    payload
  )
}

// Export for direct invocation
if (import.meta.url === new URL(import.meta.url).href) {
  claudeCodeHookHandler()
}

