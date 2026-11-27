import { NextResponse } from 'next/server'
import { currentPlayer, roomErrorResponse } from '@/server/roomPlayer'
import { leaveRoom } from '@/server/rooms'

export async function POST(
    _request: Request,
    context: { params: Promise<{ code: string }> }
) {
    try {
        const { code } = await context.params
        const player = await currentPlayer()
        await leaveRoom(code, player.id)
        return NextResponse.json({ left: true })
    } catch (error) {
        return roomErrorResponse(error)
    }
}
