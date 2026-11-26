import type { FastifyError, FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'

import { RiskLeakError } from '../lib/privacy.js'

export class HttpError extends Error {
  readonly statusCode: number
  readonly code: string

  constructor(statusCode: number, code: string, message: string) {
    super(message)
    this.statusCode = statusCode
    this.code = code
  }
}

export function badRequest(message: string, code = 'bad_request'): HttpError {
  return new HttpError(400, code, message)
}

export function unauthorized(message = 'Authentication required.', code = 'unauthorized'): HttpError {
  return new HttpError(401, code, message)
}

export function forbidden(message = 'You do not have access to this resource.', code = 'forbidden'): HttpError {
  return new HttpError(403, code, message)
}

export function notFound(message = 'Resource not found.', code = 'not_found'): HttpError {
  return new HttpError(404, code, message)
}

export function conflict(message: string, code = 'conflict'): HttpError {
  return new HttpError(409, code, message)
}

export function unprocessable(message: string, code = 'unprocessable'): HttpError {
  return new HttpError(422, code, message)
}

export async function registerErrorHandler(app: FastifyInstance): Promise<void> {
  app.setErrorHandler((error: FastifyError, request, reply) => {
    if (error instanceof HttpError) {
      return reply.status(error.statusCode).send({
        error: { code: error.code, message: error.message },
      })
    }

    if (error instanceof RiskLeakError) {
      request.log.warn({ field: error.field }, 'blocked an academic risk field in a payload')
      return reply.status(422).send({
        error: {
          code: 'risk_field_blocked',
          message:
            'Academic risk data cannot be written through this endpoint. Remove the risk fields and retry.',
        },
      })
    }

    const statusCode = typeof error.statusCode === 'number' ? error.statusCode : 500
    if (statusCode >= 500) {
      request.log.error({ err: error }, 'unhandled error')
      return reply.status(500).send({
        error: { code: 'internal_error', message: 'Something went wrong handling the request.' },
      })
    }

    return reply.status(statusCode).send({
      error: { code: error.code ?? 'request_error', message: error.message },
    })
  })

  app.setNotFoundHandler((request, reply) => {
    reply.status(404).send({
      error: { code: 'not_found', message: `No route for ${request.method} ${request.url}.` },
    })
  })
}

export function fail(reply: FastifyReply, statusCode: number, code: string, message: string): FastifyReply {
  return reply.status(statusCode).send({ error: { code, message } })
}
