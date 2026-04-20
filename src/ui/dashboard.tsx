import React from 'react'
import { Box, Text } from 'ink'
import { HookEvent } from '../inspector/types.js'
import { HookEventCard } from './hook-event.js'

interface DashboardProps {
  events: HookEvent[]
}

export function Dashboard({ events }: DashboardProps) {
  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Text bold>Events ({events.length})</Text>
      </Box>
      <Box flexDirection="column">
        {events.length === 0 ? (
          <Text dimColor>No events yet. Start Claude Code to see hook events.</Text>
        ) : (
          events.slice(0, 20).map((event, index) => (
            <HookEventCard key={event.id} event={event} />
          ))
        )}
      </Box>
    </Box>
  )
}
