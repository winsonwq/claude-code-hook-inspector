import React from 'react'
import { Box, Text } from 'ink'
import { HookEvent } from '../inspector/types.js'

interface HookEventCardProps {
  event: HookEvent
}

export function HookEventCard({ event }: HookEventCardProps) {
  const time = new Date(event.timestamp).toLocaleTimeString()

  const hookColors: Record<string, string> = {
    'pre-tool': 'cyan',
    'post-tool': 'green',
    'pre-command': 'magenta',
    'post-command': 'blue',
    'on-tool-error': 'red',
    'on-command-error': 'red'
  }

  const color = hookColors[event.hook] || 'white'

  return (
    <Box flexDirection="column" borderStyle="round" padding={1} marginBottom={1}>
      <Box>
        <Text bold>[{time}]</Text>
        <Text color={color}> {event.hook}</Text>
      </Box>
      <Box>
        <Text dimColor>Session: {event.sessionId.slice(0, 16)}...</Text>
      </Box>
      <Box flexDirection="column" marginTop={1}>
        <Text dimColor>Payload:</Text>
        <Text>{JSON.stringify(event.payload, null, 2)}</Text>
      </Box>
    </Box>
  )
}
