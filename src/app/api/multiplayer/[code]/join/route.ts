import { NextResponse } from 'next/server'
import { currentPlayer, roomErrorResponse } from '@/server/roomPlayer'
import { enterOrJoin } from '@/server/rooms'

export async function POST(
    request: Request,
    context: { params: Promise<{ code: string }> }
) {
    try {
        const { code } = await context.params
        const body = (await request.json().catch(() => ({}))) as {
            displayName?: unknown
        }
        const player = await currentPlayer(body.displayName)
        const room = await enterOrJoin(code, player.id, player.name)
        return NextResponse.json(room)
    } catch (error) {
        return roomErrorResponse(error)
    }
}
