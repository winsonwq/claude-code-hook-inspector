import net from 'net'
import fs from 'fs'
import { IPCMessage, InspectorConfig } from './types.js'
import { HookDispatcher } from './dispatcher.js'

const SOCKET_PATH = '/tmp/cchi-inspector.sock'

export class InspectorServer {
  private server: net.Server
  private dispatcher: HookDispatcher
  private clients: Set<net.Socket> = new Set()
  private interactive: boolean
  private config: InspectorConfig

  constructor(interactive: boolean = false) {
    this.interactive = interactive
    this.dispatcher = new HookDispatcher(interactive)

    this.config = {
      socketPath: SOCKET_PATH,
      logDir: '',
      interactive
    }

    this.server = net.createServer((socket) => {
      this.handleClient(socket)
    })

    this.server.on('error', (err) => {
      console.error('Server error:', err)
    })
  }

  setInteractive(interactive: boolean) {
    this.interactive = interactive
    this.dispatcher.setInteractive(interactive)
  }

  private handleClient(socket: net.Socket) {
    this.clients.add(socket)
    let buffer = ''

    socket.on('data', async (data) => {
      buffer += data.toString()

      // Handle newline-delimited JSON messages
      const lines = buffer.split('\n')
      buffer = lines.pop() || '' // Keep incomplete line in buffer

      for (const line of lines) {
        if (!line.trim()) continue
        try {
          const message: IPCMessage = JSON.parse(line)
          const response = await this.dispatcher.handleMessage(message)

          if (response) {
            socket.write(JSON.stringify(response) + '\n')
          }
        } catch (err) {
          console.error('Failed to parse message:', err)
        }
      }
    })

    socket.on('end', () => {
      this.clients.delete(socket)
    })

    socket.on('error', (err) => {
      this.clients.delete(socket)
      console.error('Socket error:', err)
    })
  }

  async start(): Promise<void> {
    // Remove existing socket file
    try {
      if (await this.socketExists()) {
        await this.removeSocket()
      }
    } catch {
      // Socket doesn't exist, continue
    }

    return new Promise((resolve, reject) => {
      this.server.listen(SOCKET_PATH, () => {
        resolve()
      })

      this.server.on('error', reject)
    })
  }

  private socketExists(): Promise<boolean> {
    return new Promise((resolve) => {
      fs.stat(SOCKET_PATH, (err: NodeJS.ErrnoException | null) => {
        resolve(!err)
      })
    })
  }

  private removeSocket(): Promise<void> {
    return new Promise((resolve, reject) => {
      fs.unlink(SOCKET_PATH, (err: NodeJS.ErrnoException | null) => {
        if (err) reject(err)
        else resolve()
      })
    })
  }

  async stop(): Promise<void> {
    return new Promise((resolve) => {
      // Close all client connections
      for (const client of this.clients) {
        client.destroy()
      }
      this.clients.clear()

      this.server.close(() => {
        resolve()
      })
    })
  }

  isRunning(): boolean {
    return this.server.listening
  }

  getDispatcher(): HookDispatcher {
    return this.dispatcher
  }
}
