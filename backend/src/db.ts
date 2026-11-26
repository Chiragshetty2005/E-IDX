import pg from 'pg'

import { config } from './config.js'

const { Pool, types } = pg

// numeric and bigint columns are small enough to carry as JS numbers here.
types.setTypeParser(1700, (value) => Number(value))
types.setTypeParser(20, (value) => Number(value))

export const pool = new Pool({
  connectionString: config.databaseUrl,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
})

pool.on('error', (error) => {
  // A pooled connection died in the background. The pool discards it; log it
  // so the failure is visible.
  console.error('[db] idle client error', error)
})

export type QueryParam = string | number | boolean | null | Date | object

export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params: QueryParam[] = [],
): Promise<pg.QueryResult<T>> {
  return pool.query<T>(text, params as unknown[])
}

export async function withTransaction<T>(fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const result = await fn(client)
    await client.query('COMMIT')
    return result
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined)
    throw error
  } finally {
    client.release()
  }
}

/**
 * Runs `fn` inside a transaction with the risk staff scope enabled. The
 * runtime database role cannot read `risk.predictions` directly, so this is
 * the only path that can return academic risk rows.
 */
export async function withStaffScope<T>(fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  return withTransaction(async (client) => {
    await client.query('SELECT risk.enable_staff_scope()')
    return fn(client)
  })
}

export async function closePool(): Promise<void> {
  await pool.end()
}
