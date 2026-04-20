import net from 'net'
import chalk from 'chalk'

const SOCKET_PATH = '/tmp/cchi-inspector.sock'

export async function stop() {
  console.log(chalk.blue('Stopping inspector server...'))

  // Try to connect and send a stop signal
  // The server should handle this and shut down
  const client = net.createConnection(SOCKET_PATH, () => {
    client.write(JSON.stringify({ type: 'stop' }) + '\n')
    client.end()
    console.log(chalk.green('✓ Inspector server stopped'))
  })

  client.on('error', () => {
    console.log(chalk.yellow('Inspector server was not running'))
  })

  // Also try to unlink the socket file
  try {
    await new Promise<void>((resolve, reject) => {
      net.unlink(SOCKET_PATH, (err) => {
        if (err) resolve() // Ignore errors
        else resolve()
      })
    })
  } catch {}

  // Give it a moment to stop
  await new Promise(r => setTimeout(r, 500))
}
