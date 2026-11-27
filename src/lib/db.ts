import { readdir, readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import pg from 'pg'

const databaseUrl = process.env.DATABASE_URL?.trim() ?? ''

type GlobalDb = {
    igPool?: pg.Pool
    igLocal?: Promise<PGlite>
    igChain?: Promise<void>
}

const globalDb = globalThis as typeof globalThis & GlobalDb

export type Sql = <T = Record<string, unknown>>(
    text: string,
    params?: unknown[]
) => Promise<T[]>

export async function sql<T = Record<string, unknown>>(
    text: string,
    params: unknown[] = []
): Promise<T[]> {
    if (databaseUrl !== '') {
        globalDb.igPool ??= new pg.Pool({ connectionString: databaseUrl, max: 5 })
        return (await globalDb.igPool.query(text, params)).rows as T[]
    }
    globalDb.igLocal ??= startLocal().catch((error: unknown) => {
        globalDb.igLocal = undefined
        throw error
    })
    return (await (await globalDb.igLocal).query<T>(text, params)).rows
}

async function startLocal(): Promise<PGlite> {
    const db = new PGlite()
    const files = (await readdir('migrations').catch(() => []))
        .filter((file) => file.endsWith('.sql'))
        .sort()
    for (const file of files) {
        await db.exec(await readFile(`migrations/${file}`, 'utf8'))
    }
    return db
}

export async function withTx<T>(fn: (query: Sql) => Promise<T>): Promise<T> {
    if (databaseUrl !== '') {
        globalDb.igPool ??= new pg.Pool({ connectionString: databaseUrl, max: 5 })
        const client = await globalDb.igPool.connect()
        const query: Sql = async <T = Record<string, unknown>>(text: string, params: unknown[] = []) =>
            (await client.query(text, params)).rows as T[]
        try {
            await client.query('begin')
            const result = await fn(query)
            await client.query('commit')
            return result
        } catch (error) {
            await client.query('rollback')
            throw error
        } finally {
            client.release()
        }
    }

    const previous = globalDb.igChain ?? Promise.resolve()
    let release: () => void = () => undefined
    const gate = new Promise<void>((resolve) => {
        release = resolve
    })
    globalDb.igChain = previous.then(() => gate)
    await previous
    try {
        return await fn(sql)
    } finally {
        release()
    }
}
