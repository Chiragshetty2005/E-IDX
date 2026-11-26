import { readdir, readFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import pg from 'pg'

import { config } from '../src/config.js'

const HERE = dirname(fileURLToPath(import.meta.url))
const SQL_DIR = resolve(HERE, '..', 'sql')

async function main(): Promise<void> {
  const client = new pg.Client({ connectionString: config.databaseAdminUrl })
  await client.connect()

  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `)

  const files = (await readdir(SQL_DIR)).filter((file) => file.endsWith('.sql')).sort()

  for (const file of files) {
    const name = file.replace(/\.sql$/, '')
    const applied = await client.query('SELECT 1 FROM schema_migrations WHERE name = $1', [name])
    if (applied.rowCount && applied.rowCount > 0) {
      console.log(`[migrate] skip ${name} (already applied)`)
      continue
    }

    const sql = await readFile(join(SQL_DIR, file), 'utf8')
    await client.query('BEGIN')
    try {
      await client.query(sql)
      await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [name])
      await client.query('COMMIT')
      console.log(`[migrate] applied ${name}`)
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    }
  }

  await client.end()
  console.log('[migrate] done')
}

main().catch((error) => {
  console.error('[migrate] failed', error)
  process.exit(1)
})
