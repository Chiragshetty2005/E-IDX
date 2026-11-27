import type { FastifyReply, FastifyRequest } from 'fastify'

export type Role = 'admin' | 'faculty' | 'parent' | 'student'

export interface AuthUser {
  id: string
  externalId: string
  fullName: string
  email: string | null
  role: Role
  level: 'school' | 'college'
  classLabel: string | null
  programme: string | null
  semester: string | null
  section: string | null
  mentorId: string | null
}

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>
    requireRole: (
      roles: Role[],
    ) => (request: FastifyRequest, reply: FastifyReply) => Promise<void>
  }

  interface FastifyRequest {
    user: AuthUser | null
  }
}
