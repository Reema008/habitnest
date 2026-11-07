/**
 * Vitest global setup for database tests: boots a throwaway embedded Postgres,
 * applies the Supabase emulation bootstrap and every migration in order,
 * then exposes the connection string to test files.
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import EmbeddedPostgres from 'embedded-postgres'
import pg from 'pg'
import type { TestProject } from 'vitest/node'

const root = path.resolve(import.meta.dirname, '../..')

declare module 'vitest' {
  export interface ProvidedContext {
    databaseUrl: string
  }
}

export default async function setup(project: TestProject) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'habitnest-pg-'))
  const port = 55000 + Math.floor(Math.random() * 5000)
  const server = new EmbeddedPostgres({
    databaseDir: dataDir,
    user: 'postgres',
    password: 'postgres',
    port,
    persistent: false,
    onLog: () => {},
  })
  await server.initialise()
  await server.start()
  await server.createDatabase('habitnest_test')

  const url = `postgres://postgres:postgres@localhost:${port}/habitnest_test`
  const client = new pg.Client({ connectionString: url })
  await client.connect()
  try {
    await client.query(fs.readFileSync(path.join(root, 'tests/db/bootstrap.sql'), 'utf8'))
    const dir = path.join(root, 'supabase/migrations')
    for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
      try {
        await client.query('begin')
        await client.query(fs.readFileSync(path.join(dir, file), 'utf8'))
        await client.query('commit')
      } catch (error) {
        await client.query('rollback')
        throw new Error(`Migration ${file} failed: ${(error as Error).message}`)
      }
    }
  } finally {
    await client.end()
  }

  project.provide('databaseUrl', url)

  return async () => {
    await server.stop()
    fs.rmSync(dataDir, { recursive: true, force: true })
  }
}
