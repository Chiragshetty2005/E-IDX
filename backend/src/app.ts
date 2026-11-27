import cookie from '@fastify/cookie'
import Fastify, { type FastifyInstance } from 'fastify'

import { query } from './db.js'
import { registerAuth } from './plugins/auth.js'
import { registerErrorHandler } from './plugins/errors.js'
import { adminRoutes } from './routes/admin.js'
import { authRoutes } from './routes/auth.js'
import { facultyRoutes } from './routes/faculty.js'
import { insightRoutes } from './routes/insights.js'
import { meRoutes } from './routes/me.js'
import { parentRoutes } from './routes/parent.js'
import { presenceRoutes } from './routes/presence.js'
import { sessionRoutes } from './routes/sessions.js'
import { studentsRoutes } from './routes/students.js'
import { verificationRoutes } from './routes/verifications.js'

export interface BuildAppOptions {
  logger?: boolean
}

export async function buildApp(options: BuildAppOptions = {}): Promise<FastifyInstance> {
  const app = Fastify({
    logger: options.logger ?? true,
    disableRequestLogging: options.logger === false,
  })

  await registerErrorHandler(app)
  await app.register(cookie)
  await registerAuth(app)

  app.get('/health', async () => {
    const result = await query<{ ok: number }>('SELECT 1 AS ok')
    return {
      status: result.rows[0]?.ok === 1 ? 'ok' : 'degraded',
      time: new Date().toISOString(),
    }
  })

  await app.register(
    async (api) => {
      api.register(authRoutes)
      api.register(meRoutes)
      api.register(parentRoutes)
      api.register(adminRoutes)
      api.register(studentsRoutes)
      api.register(facultyRoutes)
      api.register(presenceRoutes)
      api.register(verificationRoutes)
      api.register(sessionRoutes)
      api.register(insightRoutes)
    },
    { prefix: '/api/v1' },
  )

  return app
}
