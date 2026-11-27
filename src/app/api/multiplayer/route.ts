import { NextResponse } from 'next/server'
import { currentPlayer, roomErrorResponse } from '@/server/roomPlayer'
import { createRoom } from '@/server/rooms'

export async function POST(request: Request) {
    try {
        const body = (await request.json().catch(() => ({}))) as {
            settings?: unknown
            displayName?: unknown
        }
        const player = await currentPlayer(body.displayName)
        const room = await createRoom(player.id, player.name, body.settings)
        return NextResponse.json(room)
    } catch (error) {
        return roomErrorResponse(error)
    }
}
