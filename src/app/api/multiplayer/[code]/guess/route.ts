import { NextResponse } from 'next/server'
import { currentPlayer, roomErrorResponse } from '@/server/roomPlayer'
import { submitGuess } from '@/server/rooms'

export async function POST(
    request: Request,
    context: { params: Promise<{ code: string }> }
) {
    try {
        const { code } = await context.params
        const body = (await request.json().catch(() => ({}))) as { guess?: string }
        const player = await currentPlayer()
        const room = await submitGuess(code, player.id, body.guess ?? '')
        return NextResponse.json(room)
    } catch (error) {
        return roomErrorResponse(error)
    }
}
