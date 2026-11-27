import { NextResponse } from 'next/server'
import { currentPlayer, roomErrorResponse } from '@/server/roomPlayer'
import { advanceRound } from '@/server/rooms'

export async function POST(
    _request: Request,
    context: { params: Promise<{ code: string }> }
) {
    try {
        const { code } = await context.params
        const player = await currentPlayer()
        const room = await advanceRound(code, player.id)
        return NextResponse.json(room)
    } catch (error) {
        return roomErrorResponse(error)
    }
}
