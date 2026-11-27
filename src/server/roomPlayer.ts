import 'server-only'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { RoomError, sanitizeName } from '@/server/rooms'

const PLAYER = 'ig_room_player'
const NAME = 'ig_room_name'

const cookieOptions = {
    httpOnly: true,
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
}

export async function currentPlayer(requestedName?: unknown) {
    const jar = await cookies()
    const existing = jar.get(PLAYER)?.value ?? ''
    const fresh = !/^[0-9a-f-]{36}$/i.test(existing)
    const id = fresh ? crypto.randomUUID() : existing
    const stored = sanitizeName(jar.get(NAME)?.value)
    const name = requestedName === undefined ? stored : sanitizeName(requestedName)
    if (fresh) jar.set(PLAYER, id, cookieOptions)
    if (requestedName !== undefined || !jar.get(NAME)) jar.set(NAME, name, cookieOptions)
    return { id, name }
}

export function roomErrorResponse(error: unknown) {
    const code = error instanceof RoomError ? error.message : 'request_failed'
    if (!(error instanceof RoomError)) console.error('room', error)
    return NextResponse.json({ error: code }, { status: 400 })
}
