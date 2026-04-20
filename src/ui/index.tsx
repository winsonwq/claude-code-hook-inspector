import React from 'react'
import { render, Box, Text } from 'ink'
import { Dashboard } from './dashboard.js'
import { HookDispatcher } from '../inspector/dispatcher.js'
import { HookEvent } from '../inspector/types.js'
import readline from 'readline'

interface TUIProps {
  dispatcher: HookDispatcher
  interactive: boolean
}

export async function runTUI(dispatcher: HookDispatcher, interactive: boolean): Promise<void> {
  const events: HookEvent[] = []

  dispatcher.onEvent((event) => {
    events.unshift(event)
    if (events.length > 100) {
      events.pop()
    }
  })

  dispatcher.setInputCallback(async (event: HookEvent) => {
    const time = new Date(event.timestamp).toLocaleTimeString()
    console.log('\n\x1b[33m[Interactive Mode]\x1b[0m')
    console.log(`\x1b[36m${event.hook}\x1b[0m triggered at ${time}`)
    console.log(`Session: ${event.sessionId}`)
    console.log(`Payload: ${JSON.stringify(event.payload, null, 2)}`)
    console.log()

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    })

    return new Promise((resolve) => {
      rl.question('\x1b[35mEnter JSON return value (or press Enter for null):\x1b[0m ', (answer: string) => {
        rl.close()

        if (!answer.trim()) {
          resolve(null)
          return
        }
        try {
          resolve(JSON.parse(answer))
        } catch {
          console.log('\x1b[31mInvalid JSON, returning null\x1b[0m')
          resolve(null)
        }
      })
    })
  })

  // Keep process alive
  await new Promise(() => {})
}

export function TUI({ dispatcher, interactive }: TUIProps) {
  const [events, setEvents] = React.useState<HookEvent[]>([])

  React.useEffect(() => {
    dispatcher.onEvent((event) => {
      setEvents(prev => {
        const next = [event, ...prev]
        return next.slice(0, 100)
      })
    })
  }, [dispatcher])

  return (
    <Box flexDirection="column">
      <Box borderStyle="single" borderDim>
        <Text bold>Claude Code Hook Inspector</Text>
        <Text> | Mode: {interactive ? 'Interactive' : 'Monitor'}</Text>
      </Box>
      <Dashboard events={events} />
    </Box>
  )
}
