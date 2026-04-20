import {
  HookEvent,
  HookResponse,
  IPCMessage,
  LoggedEvent,
  SessionLog
} from './types.js'
import fs from 'fs'
import path from 'path'

const SOCKET_PATH = '/tmp/cchi-inspector.sock'
const LOG_DIR = path.join(process.env.HOME || '/tmp', '.claude-code-hook-inspector', 'logs', 'sessions')

export class HookDispatcher {
  private sessions: Map<string, SessionLog> = new Map()
  private pendingResponses: Map<string, (value: unknown) => void> = new Map()
  private eventQueue: HookEvent[] = []
  private interactive: boolean = false

  private onEventCallback?: (event: HookEvent) => void
  private onWaitForInputCallback?: (event: HookEvent) => Promise<unknown>

  constructor(interactive: boolean = false) {
    this.interactive = interactive

    // Ensure log directory exists
    if (!fs.existsSync(LOG_DIR)) {
      fs.mkdirSync(LOG_DIR, { recursive: true })
    }
  }

  setInteractive(interactive: boolean) {
    this.interactive = interactive
  }

  onEvent(callback: (event: HookEvent) => void) {
    this.onEventCallback = callback
  }

  async waitForInput(event: HookEvent): Promise<unknown> {
    if (this.onWaitForInputCallback) {
      return this.onWaitForInputCallback(event)
    }
    return null
  }

  setInputCallback(callback: (event: HookEvent) => Promise<unknown>) {
    this.onWaitForInputCallback = callback
  }

  async handleMessage(message: IPCMessage): Promise<IPCMessage | null> {
    switch (message.type) {
      case 'hook_event':
        return this.handleHookEvent(message)

      case 'ping':
        return { type: 'pong' }

      default:
        return null
    }
  }

  private async handleHookEvent(event: HookEvent): Promise<HookResponse | null> {
    // Ensure session exists
    if (!this.sessions.has(event.sessionId)) {
      this.sessions.set(event.sessionId, {
        sessionId: event.sessionId,
        startTime: event.timestamp,
        events: []
      })
    }

    const session = this.sessions.get(event.sessionId)!
    const loggedEvent: LoggedEvent = {
      id: event.id,
      hook: event.hook,
      timestamp: event.timestamp,
      payload: event.payload
    }

    let returnValue: unknown = null

    if (this.interactive) {
      returnValue = await this.waitForInput(event)
      loggedEvent.returnValue = returnValue
    }

    // Record event
    session.events.push(loggedEvent)

    // Log to file
    this.writeSessionLog(session)

    // Notify UI
    if (this.onEventCallback) {
      this.onEventCallback(event)
    }

    return {
      type: 'hook_response',
      id: event.id,
      returnValue
    }
  }

  private writeSessionLog(session: SessionLog) {
    const date = new Date(session.startTime).toISOString().split('T')[0]
    const filename = `${date}_${session.sessionId}.jsonl`
    const filepath = path.join(LOG_DIR, filename)

    const logLine = JSON.stringify({
      ...session.events[session.events.length - 1],
      sessionId: session.sessionId
    }) + '\n'

    fs.appendFileSync(filepath, logLine)
  }

  getSessions(): SessionLog[] {
    return Array.from(this.sessions.values())
  }

  getSession(sessionId: string): SessionLog | undefined {
    return this.sessions.get(sessionId)
  }

  cleanupOldSessions(keepCount: number = 100) {
    if (!fs.existsSync(LOG_DIR)) return

    const files = fs.readdirSync(LOG_DIR)
      .filter(f => f.endsWith('.jsonl'))
      .map(f => ({
        name: f,
        path: path.join(LOG_DIR, f),
        time: fs.statSync(path.join(LOG_DIR, f)).mtime.getTime()
      }))
      .sort((a, b) => b.time - a.time)

    // Keep only the most recent N sessions
    const toDelete = files.slice(keepCount)
    for (const file of toDelete) {
      fs.unlinkSync(file.path)
    }
  }
}
