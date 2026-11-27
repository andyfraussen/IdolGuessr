'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import {
    advanceRound,
    enterRoom,
    getRoom,
    leaveRoom,
    startRound,
    submitRoomGuess,
    type RoomSnapshot,
} from '@/lib/multiplayer'
import { supabase } from '@/lib/supabase'

const HEARTBEAT_MS = 10_000

// Reusing a topic after removeChannel returns the channel React just closed,
// and subscribe() on that channel never joins. Chain each topic so the next
// subscribe waits until removeChannel has finished.
const topicChain = new Map<string, Promise<void>>()

function afterTopic(topic: string, task: () => Promise<void>): Promise<void> {
    const previous = topicChain.get(topic) ?? Promise.resolve()
    const run = previous.then(task, task)
    topicChain.set(
        topic,
        run.then(
            () => undefined,
            () => undefined
        )
    )
    return run
}

function newer(current: RoomSnapshot | null, next: RoomSnapshot): RoomSnapshot {
    if (!current || next.revision > current.revision) return next
    if (next.revision < current.revision) return current
    return JSON.stringify(current) === JSON.stringify(next) ? current : next
}

export function useMultiplayerRoom(code: string) {
    const [room, setRoom] = useState<RoomSnapshot | null>(null)
    const [onlineIds, setOnlineIds] = useState<string[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const roomRef = useRef<RoomSnapshot | null>(null)
    const channelRef = useRef<RealtimeChannel | null>(null)
    const requestRef = useRef(0)

    const applyRoom = useCallback((next: RoomSnapshot) => {
        setRoom((current) => {
            const chosen = newer(current, next)
            roomRef.current = chosen
            return chosen
        })
        setError(null)
    }, [])

    const refresh = useCallback(async () => {
        const request = ++requestRef.current
        const next = await getRoom(code)
        if (request !== requestRef.current) return next
        applyRoom(next)
        return next
    }, [applyRoom, code])

    const publish = useCallback(
        (next: RoomSnapshot) => {
            applyRoom(next)
            const channel = channelRef.current
            if (!channel) return
            void channel.send({
                type: 'broadcast',
                event: 'state_changed',
                payload: { revision: next.revision },
            })
        },
        [applyRoom]
    )

    useEffect(() => {
        let cancelled = false
        let channel: RealtimeChannel | null = null
        const topic = `multiplayer:${code}`

        void afterTopic(topic, async () => {
            if (cancelled) return
            try {
                const snapshot = await enterRoom(code)
                if (cancelled) return
                applyRoom(snapshot)
                setLoading(false)

                const nextChannel = supabase.channel(topic, {
                    config: { presence: { key: snapshot.you } },
                })
                channel = nextChannel
                channelRef.current = nextChannel

                const readPresence = () => {
                    const state = nextChannel.presenceState() as Record<
                        string,
                        Array<{ user_id?: string }>
                    >
                    const ids = new Set<string>()
                    for (const entries of Object.values(state)) {
                        for (const entry of entries) {
                            if (entry.user_id) ids.add(entry.user_id)
                        }
                    }
                    setOnlineIds([...ids])
                }

                nextChannel
                    .on(
                        'postgres_changes',
                        {
                            event: '*',
                            schema: 'public',
                            table: 'multiplayer_state',
                            filter: `room_id=eq.${snapshot.room_id}`,
                        },
                        () => {
                            void refresh().catch((err: unknown) => {
                                console.error('room refresh', err)
                            })
                        }
                    )
                    .on('broadcast', { event: 'state_changed' }, () => {
                        void refresh().catch((err: unknown) => {
                            console.error('room refresh', err)
                        })
                    })
                    .on('presence', { event: 'sync' }, readPresence)
                    .on('presence', { event: 'join' }, readPresence)
                    .on('presence', { event: 'leave' }, readPresence)
                    .subscribe((status, err) => {
                        if (cancelled) return
                        if (status === 'SUBSCRIBED') {
                            const current = roomRef.current
                            const me = current?.players.find(
                                (player) => player.user_id === current.you
                            )
                            void nextChannel.track({
                                user_id: snapshot.you,
                                display_name: me?.display_name ?? 'Guest',
                            })
                        }
                        if (
                            status === 'CHANNEL_ERROR' ||
                            status === 'TIMED_OUT'
                        ) {
                            console.error(
                                'Room realtime status:',
                                status,
                                err ?? ''
                            )
                        }
                    })
            } catch (err: unknown) {
                if (cancelled) return
                console.error('enter room', err)
                setError(err instanceof Error ? err.message : 'request_failed')
                setLoading(false)
            }
        })

        return () => {
            cancelled = true
            void afterTopic(topic, async () => {
                const current = channel
                channel = null
                if (channelRef.current === current) channelRef.current = null
                if (current) await supabase.removeChannel(current)
            })
        }
    }, [applyRoom, code, refresh])

    useEffect(() => {
        if (!room) return
        const beat = () => {
            if (document.visibilityState === 'hidden') return
            void refresh().catch((err: unknown) => {
                console.error('room heartbeat', err)
            })
        }
        const timer = window.setInterval(beat, HEARTBEAT_MS)
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
            publish(next)
            return next
        },
        [publish]
    )

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
