import { createHmac, timingSafeEqual } from 'node:crypto'

import { config } from '../config.js'

export interface CampusPass {
  token: string
  expires_at: string
}

interface PassPayload {
  card_uid: string
  exp: number
  nonce: string
}

function sign(payload: string): string {
  return createHmac('sha256', config.passSecret).update(payload).digest('base64url')
}

/**
 * Issues a short lived campus pass for a card. The payload carries card
 * identity and an expiry only: no risk data ever enters a pass.
 */
export function issuePass(cardUid: string, ttlSeconds = config.passTtlSeconds): CampusPass {
  const payload: PassPayload = {
    card_uid: cardUid,
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
    nonce: Math.random().toString(36).slice(2, 12),
  }
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const token = `${encoded}.${sign(encoded)}`
  return { token, expires_at: new Date(payload.exp * 1000).toISOString() }
}

export function verifyPass(token: string): PassPayload | null {
  const [encoded, signature] = token.split('.')
  if (!encoded || !signature) return null

  const expected = sign(encoded)
  const bufferA = Buffer.from(signature)
  const bufferB = Buffer.from(expected)
  if (bufferA.length !== bufferB.length || !timingSafeEqual(bufferA, bufferB)) return null

  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as PassPayload
    if (typeof payload.exp !== 'number' || payload.exp * 1000 < Date.now()) return null
    return payload
  } catch {
    return null
  }
}
