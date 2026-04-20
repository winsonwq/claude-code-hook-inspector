// Type definitions for the Inspector

export type HookName =
  | 'pre-tool'
  | 'post-tool'
  | 'on-tool-error'
  | 'user-prompt'
  | 'session-start'
  | 'session-end'
  | 'notification'
  | 'stop'
  | 'stop-failure'
  | 'cwd-changed'
  | 'file-changed'
  | 'config-change'
  | 'permission-request'
  | 'permission-denied'
  | 'pre-compact'
  | 'post-compact'

export interface HookPayload {
  [key: string]: unknown
}

export interface HookEvent {
  type: 'hook_event'
  id: string
  hook: HookName
  sessionId: string
  timestamp: number
  payload: HookPayload
}

export interface HookResponse {
  type: 'hook_response'
  id: string
  returnValue: unknown
}

export interface PingMessage {
  type: 'ping'
}

export interface PongMessage {
  type: 'pong'
}

export interface RegisterClientMessage {
  type: 'register_client'
  pid: number
}

export interface ReadyMessage {
  type: 'ready'
  pid: number
}

export type IPCMessage =
  | HookEvent
  | HookResponse
  | PingMessage
  | PongMessage
  | RegisterClientMessage
  | ReadyMessage

export interface SessionLog {
  sessionId: string
  startTime: number
  events: LoggedEvent[]
}

export interface LoggedEvent {
  id: string
  hook: HookName
  timestamp: number
  payload: HookPayload
  returnValue?: unknown
  responseTime?: number
}

export interface InspectorConfig {
  socketPath: string
  logDir: string
  interactive: boolean
}
