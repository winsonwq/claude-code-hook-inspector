// IPC client for hook shims to communicate with inspector server
import net from 'net'
import { IPCMessage, HookEvent, HookResponse } from '../inspector/types.js'

const SOCKET_PATH = '/tmp/cchi-inspector.sock'

let socket: net.Socket | null = null
let buffer = ''
let responseHandlers: Map<string, (value: HookResponse) => void> = new Map()

function generateId(): string {
  return `h_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

async function connect(): Promise<net.Socket> {
  if (socket && !socket.destroyed) {
    return socket
  }

  return new Promise((resolve, reject) => {
    socket = net.createConnection(SOCKET_PATH, () => {
      if (socket) {
        socket.on('data', (data) => {
          buffer += data.toString()
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''

          for (const line of lines) {
            if (!line.trim()) continue
            try {
              const message: IPCMessage = JSON.parse(line)
              if (message.type === 'hook_response') {
                const handler = responseHandlers.get(message.id)
                if (handler) {
                  handler(message)
                  responseHandlers.delete(message.id)
                }
              }
            } catch {
              // Ignore parse errors for now
            }
          }
        })

        socket.on('error', () => {
          socket = null
        })

        socket.on('close', () => {
          socket = null
        })

        resolve(socket!)
      }
    })

    socket.on('error', (err) => {
      socket = null
      reject(err)
    })

    socket.setTimeout(1000, () => {
      if (socket) {
        socket.destroy()
        socket = null
      }
      reject(new Error('Connection timeout'))
    })
  })
}

export async function sendHookEvent(
  hook: string,
  sessionId: string,
  payload: Record<string, unknown>
): Promise<unknown> {
  const id = generateId()
  const event: HookEvent = {
    type: 'hook_event',
    id,
    hook: hook as HookEvent['hook'],
    sessionId,
    timestamp: Date.now(),
    payload
  }

  try {
    const sock = await connect()
    sock.write(JSON.stringify(event) + '\n')

    return new Promise((resolve) => {
      responseHandlers.set(id, (response: HookResponse) => {
        resolve(response.returnValue)
      })

      // Timeout after 30 seconds
      setTimeout(() => {
        if (responseHandlers.has(id)) {
          responseHandlers.delete(id)
          resolve(null)
        }
      }, 30000)
    })
  } catch {
    // If inspector is not running, return null
    return null
  }
}

export function isConnected(): boolean {
  return socket !== null && !socket.destroyed
}
