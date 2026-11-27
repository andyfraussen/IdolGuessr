'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
    advanceRound,
    enterRoom,
    getRoom,
    leaveRoom,
    startRound,
    submitRoomGuess,
    type RoomSnapshot,
} from '@/lib/multiplayer'

const POLL_MS = 2000

function ownGuesses(room: RoomSnapshot): number {
    return (
        room.players.find((player) => player.user_id === room.you)?.guesses
            ?.length ?? 0
    )
}

function newer(current: RoomSnapshot | null, next: RoomSnapshot): RoomSnapshot {
    if (!current || next.revision > current.revision) return next
    if (next.revision < current.revision) return current
    if (ownGuesses(next) < ownGuesses(current)) return current
    return JSON.stringify(current) === JSON.stringify(next) ? current : next
}

export function useMultiplayerRoom(code: string) {
    const [room, setRoom] = useState<RoomSnapshot | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const requestRef = useRef(0)

    const applyRoom = useCallback((next: RoomSnapshot) => {
        setRoom((current) => newer(current, next))
        setError(null)
    }, [])

    const refresh = useCallback(async () => {
        const request = ++requestRef.current
        const next = await getRoom(code)
        if (request !== requestRef.current) return next
        applyRoom(next)
        return next
    }, [applyRoom, code])

    useEffect(() => {
        let cancelled = false
        void enterRoom(code)
            .then((snapshot) => {
                if (cancelled) return
                applyRoom(snapshot)
                setLoading(false)
            })
            .catch((err: unknown) => {
                if (cancelled) return
                console.error('enter room', err)
                setError(err instanceof Error ? err.message : 'request_failed')
                setLoading(false)
            })
        return () => {
            cancelled = true
        }
    }, [applyRoom, code])

    useEffect(() => {
        if (!room) return
        const beat = () => {
            if (document.visibilityState === 'hidden') return
            void refresh().catch((err: unknown) => {
                console.error('room poll', err)
            })
        }
        const timer = window.setInterval(beat, POLL_MS)
        const onVisible = () => {
            if (document.visibilityState === 'visible') beat()
        }
        document.addEventListener('visibilitychange', onVisible)
        return () => {
            window.clearInterval(timer)
            document.removeEventListener('visibilitychange', onVisible)
        }
    }, [refresh, room])

    const run = useCallback(
        async (action: () => Promise<RoomSnapshot>) => {
            const next = await action()
            applyRoom(next)
            return next
        },
        [applyRoom]
    )

    const onlineIds = (room?.players ?? [])
        .filter((player) => player.here)
        .map((player) => player.user_id)

    return {
        room,
        onlineIds,
        loading,
        error,
        refresh,
        start: () => run(() => startRound(code)),
        advance: () => run(() => advanceRound(code)),
        submit: (guess: string) => run(() => submitRoomGuess(code, guess)),
        leave: () => leaveRoom(code),
    }
}
