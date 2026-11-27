'use client'

import { GuessDot } from '@/components/theme/FeedbackIcon'
import type { RoomPlayer } from '@/lib/multiplayer'

interface RoomScoreboardProps {
    players: RoomPlayer[]
    onlineIds: string[]
    youId: string
    pops: Record<string, number>
}

export default function RoomScoreboard({
    players,
    onlineIds,
    youId,
    pops,
}: RoomScoreboardProps) {
    const online = new Set(onlineIds)

    return (
        <div className='w-full shrink-0'>
            <div className='mb-1 flex items-center justify-between px-1 text-[11px] font-bold tracking-wide text-gray-400 uppercase dark:text-zinc-500'>
                <span>Room</span>
                <span>Wins</span>
            </div>
            <ul className='max-h-36 space-y-1 overflow-y-auto'>
                {players.map((player) => {
                    const pop = pops[player.user_id] ?? 0
                    const solved = player.status === 'won'
                    const missed = player.status === 'lost'
                    return (
                        <li
                            key={`${player.user_id}-${pop}`}
                            className={`flex items-center gap-2 rounded-md px-2 py-1.5 ${
                                player.user_id === youId
                                    ? 'bg-pink-50 dark:bg-pink-950/40'
                                    : 'bg-gray-50 dark:bg-zinc-900'
                            } ${pop > 0 ? 'square-pop-animation' : ''}`}
                        >
                            <span
                                className={`h-2 w-2 shrink-0 rounded-full ${
                                    online.has(player.user_id)
                                        ? 'bg-[#3aa346]'
                                        : 'bg-gray-300 dark:bg-zinc-600'
                                }`}
                                aria-label={
                                    online.has(player.user_id) ? 'Here' : 'Away'
                                }
                            />
                            <span className='min-w-0 flex-1 truncate text-sm font-semibold'>
                                {player.display_name}
                                {player.user_id === youId ? ' (you)' : ''}
                            </span>
                            {solved || missed ? (
                                <GuessDot
                                    guess={solved ? 'correct' : 'incorrect'}
                                />
                            ) : (
                                <span className='h-3.5 w-3.5 shrink-0 rounded-full border border-gray-300 dark:border-zinc-600' />
                            )}
                            <span className='w-6 text-right text-sm font-bold tabular-nums'>
                                {player.wins}
                            </span>
                        </li>
                    )
                })}
            </ul>
        </div>
    )
}
