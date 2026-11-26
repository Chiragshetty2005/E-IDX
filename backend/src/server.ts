import { buildApp } from './app.js'
import { config } from './config.js'
import { closePool } from './db.js'

const app = await buildApp({ logger: true })

async function shutdown(signal: string): Promise<void> {
  app.log.info({ signal }, 'shutting down')
  try {
    await app.close()
    await closePool()
  } finally {
    process.exit(0)
  }
}

process.on('SIGINT', () => void shutdown('SIGINT'))
process.on('SIGTERM', () => void shutdown('SIGTERM'))

try {
  await app.listen({ port: config.port, host: config.host })
  app.log.info(
    { url: `http://${config.host}:${config.port}`, env: config.nodeEnv },
    'E-IDX API listening',
  )
} catch (error) {
  app.log.error(error)
  process.exit(1)
}
