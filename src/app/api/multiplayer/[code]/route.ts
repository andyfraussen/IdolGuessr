import { NextResponse } from 'next/server'
import { currentPlayer, roomErrorResponse } from '@/server/roomPlayer'
import { getRoom } from '@/server/rooms'

export async function GET(
    _request: Request,
    context: { params: Promise<{ code: string }> }
) {
    try {
        const { code } = await context.params
        const player = await currentPlayer()
        const room = await getRoom(code, player.id, player.name)
        return NextResponse.json(room)
    } catch (error) {
        return roomErrorResponse(error)
    }
}
