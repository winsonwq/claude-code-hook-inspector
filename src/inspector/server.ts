import net from 'net'
import fs from 'fs'
import { IPCMessage, InspectorConfig } from './types.js'
import { HookDispatcher } from './dispatcher.js'
import pino from 'pino'

const SOCKET_PATH = '/tmp/cchi-inspector.sock'

export class InspectorServer {
  private server: net.Server
  private dispatcher: HookDispatcher
  private clients: Set<net.Socket> = new Set()
  private logger: pino.Logger
  private interactive: boolean
  private config: InspectorConfig

  constructor(interactive: boolean = false) {
    this.interactive = interactive
    this.dispatcher = new HookDispatcher(interactive)
    this.logger = pino({ name: 'inspector-server' })

    this.config = {
      socketPath: SOCKET_PATH,
      logDir: '',
      interactive
    }

    this.server = net.createServer((socket) => {
      this.handleClient(socket)
    })

    this.server.on('error', (err) => {
      this.logger.error({ err }, 'Server error')
    })
  }

  setInteractive(interactive: boolean) {
    this.interactive = interactive
    this.dispatcher.setInteractive(interactive)
  }

  private handleClient(socket: net.Socket) {
    this.clients.add(socket)
    let buffer = ''

    this.logger.info({ remoteAddress: socket.remoteAddress }, 'Client connected')

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
          this.logger.error({ err, line }, 'Failed to parse message')
        }
      }
    })

    socket.on('end', () => {
      this.clients.delete(socket)
      this.logger.info({ remoteAddress: socket.remoteAddress }, 'Client disconnected')
    })

    socket.on('error', (err) => {
      this.clients.delete(socket)
      this.logger.error({ err }, 'Socket error')
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
        this.logger.info({ socketPath: SOCKET_PATH }, 'Inspector server started')
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
        this.logger.info('Inspector server stopped')
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
