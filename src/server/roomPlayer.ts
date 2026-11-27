import 'server-only'
import { createHash, randomBytes } from 'node:crypto'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { RoomError, sanitizeName } from '@/server/rooms'

const PLAYER = 'ig_room_player'
const NAME = 'ig_room_name'
const TOKEN = /^[A-Za-z0-9_-]{43}$/

const cookieOptions = {
    httpOnly: true,
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
}

function hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex')
}

async function playerForToken(token: string): Promise<string> {
    if (!TOKEN.test(token)) return ''
    const rows = await sql<{ player_id: string }>(
        'select player_id from room_sessions where token_hash = $1',
        [hashToken(token)]
    )
    return rows[0]?.player_id ?? ''
}

async function startSession(): Promise<{ id: string; token: string }> {
    const id = crypto.randomUUID()
    const token = randomBytes(32).toString('base64url')
    await sql('insert into room_sessions (token_hash, player_id) values ($1, $2)', [
        hashToken(token),
        id,
    ])
    return { id, token }
}

export async function currentPlayer(requestedName?: unknown) {
    const jar = await cookies()
    let id = await playerForToken(jar.get(PLAYER)?.value ?? '')
    if (!id) {
        const session = await startSession()
        id = session.id
        jar.set(PLAYER, session.token, cookieOptions)
    }
    const stored = sanitizeName(jar.get(NAME)?.value)
    const name = requestedName === undefined ? stored : sanitizeName(requestedName)
    if (requestedName !== undefined || !jar.get(NAME)) jar.set(NAME, name, cookieOptions)
    return { id, name }
}

export function roomErrorResponse(error: unknown) {
    const code = error instanceof RoomError ? error.message : 'request_failed'
    if (!(error instanceof RoomError)) console.error('room', error)
    return NextResponse.json({ error: code }, { status: 400 })
}
