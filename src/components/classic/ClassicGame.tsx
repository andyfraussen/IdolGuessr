'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import ColorLegend from '@/components/classic/ColorLegend'
import GuessGrid from '@/components/classic/GuessGrid'
import ClassicFilterModal from '@/components/classic/ClassicFilterModal'
import ClassicModeModal from '@/components/classic/ClassicModeModal'
import ClassicWinModal from '@/components/classic/ClassicWinModal'
import IdolSearchInput from '@/components/classic/IdolSearchInput'
import {
    getClassicPool,
    giveUpClassic,
    loadClassicDaily,
    setClassicGroup,
    startClassicRound,
    submitClassic,
    type ClassicCandidate,
    type ClassicGame as ClassicState,
    type ClassicGroup,
    type ClassicMode,
} from '@/lib/classic'
import { getClassicGame, subscribePlayer } from '@/lib/player'

function friendly(error: unknown) {
    const message = error instanceof Error ? error.message : 'Something went wrong'
    if (message.includes('already_guessed')) return 'You already guessed that idol'
    if (message.includes('no_idol')) return 'No idols match this filter yet'
    if (message.includes('no_active_game')) return 'This round is already finished'
    if (message.includes('round_in_progress')) return 'Finish this idol before starting another'
    return message
}

function formatCountdown(ms: number) {
    const total = Math.max(0, Math.floor(ms / 1000))
    const hours = Math.floor(total / 3600)
    const minutes = Math.floor((total % 3600) / 60)
    const seconds = total % 60
    return [hours, minutes, seconds].map((part) => part.toString().padStart(2, '0')).join(':')
}

function filterLabel(group: ClassicGroup) {
    if (group === 'girl-group') return 'Girl groups'
    if (group === 'boy-group') return 'Boy groups'
    return 'All groups'
}

export default function ClassicGame({ mode }: { mode: ClassicMode }) {
    const router = useRouter()
    const [game, setGame] = useState<ClassicState | null>(null)
    const [pool, setPool] = useState<ClassicCandidate[]>([])
    const [loading, setLoading] = useState(true)
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState('')
    const [newestId, setNewestId] = useState<number | null>(null)
    const [endAt, setEndAt] = useState<string | null>(null)
    const [serverOffset, setServerOffset] = useState(0)
    const [now, setNow] = useState(() => Date.now())
    const [resultOpen, setResultOpen] = useState(true)
    const [confirmGiveUp, setConfirmGiveUp] = useState(false)
    const [filterOpen, setFilterOpen] = useState(false)
    const [modeOpen, setModeOpen] = useState(false)
    const rolled = useRef(false)
    const busyRef = useRef(false)

    useEffect(() => {
        const sync = () => setGame(getClassicGame(mode))
        sync()
        return subscribePlayer(sync)
    }, [mode])

    useEffect(() => {
        let cancel = false
        const load = async () => {
            setLoading(true)
            setError('')
            try {
                const idols = await getClassicPool()
                if (cancel) return
                setPool(idols)
                if (mode === 'daily') {
                    const daily = await loadClassicDaily()
                    if (cancel) return
                    setEndAt(daily.endAt)
                    setServerOffset(new Date(daily.serverNow).getTime() - Date.now())
                } else if (!getClassicGame('infinite')?.status) {
                    await startClassicRound(getClassicGame('infinite')?.groupFilter ?? 'both')
                }
            } catch (err) {
                if (!cancel) setError(friendly(err))
            } finally {
                if (!cancel) setLoading(false)
            }
        }
        void load()
        return () => {
            cancel = true
        }
    }, [mode])

    useEffect(() => {
        if (mode !== 'daily' || !endAt) return
        const id = window.setInterval(() => setNow(Date.now()), 1000)
        return () => window.clearInterval(id)
    }, [mode, endAt])

    const remaining = endAt ? new Date(endAt).getTime() - (now + serverOffset) : null

    useEffect(() => {
        if (mode !== 'daily' || remaining == null || remaining > 0 || rolled.current) return
        rolled.current = true
        void loadClassicDaily()
            .then((daily) => {
                const offset = new Date(daily.serverNow).getTime() - Date.now()
                setEndAt(daily.endAt)
                setServerOffset(offset)
                setResultOpen(true)
                rolled.current = new Date(daily.endAt).getTime() - (Date.now() + offset) <= 0
            })
            .catch((err) => setError(friendly(err)))
    }, [mode, remaining])

    const finished = game?.status === 'won' || game?.status === 'gave_up'
    const countdown = remaining == null ? null : formatCountdown(remaining)

    const pick = async (idol: ClassicCandidate) => {
        if (busyRef.current || game?.status !== 'in_progress') return
        busyRef.current = true
        setBusy(true)
        setError('')
        try {
            await submitClassic(mode, idol.id)
            setNewestId(idol.id)
            setResultOpen(true)
        } catch (err) {
            setError(friendly(err))
        } finally {
            busyRef.current = false
            setBusy(false)
        }
    }

    const reveal = async () => {
        setBusy(true)
        setError('')
        try {
            await giveUpClassic()
            setConfirmGiveUp(false)
            setResultOpen(true)
        } catch (err) {
            setError(friendly(err))
        } finally {
            setBusy(false)
        }
    }

    const next = async () => {
        setBusy(true)
        setError('')
        try {
            await startClassicRound(game?.groupFilter ?? 'both')
            setNewestId(null)
            setResultOpen(true)
        } catch (err) {
            setError(friendly(err))
        } finally {
            setBusy(false)
        }
    }

    const changeGroup = async (group: ClassicGroup) => {
        setError('')
        try {
            await setClassicGroup(group)
        } catch (err) {
            setError(friendly(err))
        }
    }

    return (
        <main className='mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-6'>
            <div className='flex items-center justify-between gap-3'>
            <Link
                    href='/'
                    className='mb-8 flex h-8 cursor-pointer items-center justify-center gap-2 self-start rounded-full bg-zinc-800 px-3 transition-colors hover:bg-zinc-700'
                    aria-label='Back to the game'
                >
                    <svg
                        className='h-4 w-4 text-zinc-300'
                        fill='none'
                        stroke='currentColor'
                        viewBox='0 0 24 24'
                    >
                        <path
                            strokeLinecap='round'
                            strokeLinejoin='round'
                            strokeWidth={2}
                            d='M10 19l-7-7m0 0l7-7m-7 7h18'
                        />
                    </svg>
                    <span className='text-sm text-zinc-300'>
                        Back to the game
                    </span>
                </Link>
                <div className='flex items-center gap-2'>
                    {mode === 'infinite' && (
                        <button
                            type='button'
                            onClick={() => setFilterOpen(true)}
                            className='inline-flex h-8 cursor-pointer items-center rounded-full bg-gray-200 px-3 text-sm text-gray-600 hover:bg-gray-300 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700'
                        >
                            {filterLabel(game?.groupFilter ?? 'both')}
                        </button>
                    )}
                    <button
                        type='button'
                        onClick={() => setModeOpen(true)}
                        className='inline-flex h-8 cursor-pointer items-center rounded-full bg-gray-200 px-3 text-sm text-gray-600 hover:bg-gray-300 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700'
                    >
                        {mode === 'daily' ? 'Daily' : 'Unlimited'}
                    </button>
                </div>
            </div>

            <div className='mt-8 text-center'>
                <h1 className='text-5xl font-bold'>Classic</h1>
                {mode === 'daily' && countdown && (
                    <p className='mt-2 text-sm font-semibold tabular-nums'>{countdown}</p>
                )}
            </div>

            {loading ? (
                <p className='mt-10 text-center text-sm text-gray-500 dark:text-zinc-400'>Loading...</p>
            ) : (
                <>
                    <IdolSearchInput
                        pool={pool}
                        excludedIds={game?.guesses.map((guess) => guess.id) ?? []}
                        disabled={busy || game?.status !== 'in_progress'}
                        pending={busy && game?.status === 'in_progress'}
                        onPick={(idol) => void pick(idol)}
                    />
                    <ColorLegend />
                    {error && <p className='mt-3 text-center text-sm text-red-600'>{error}</p>}
                    <GuessGrid guesses={game?.guesses ?? []} newestId={newestId} />
                    {mode === 'infinite' && game?.status === 'in_progress' && (
                        <div className='mt-4 flex justify-center'>
                            {confirmGiveUp ? (
                                <div className='flex items-center gap-2 text-sm'>
                                    <span>Reveal the answer?</span>
                                    <button
                                        type='button'
                                        onClick={() => void reveal()}
                                        disabled={busy}
                                        className='cursor-pointer rounded-full bg-red-600 px-3 py-1.5 font-semibold text-white'
                                    >
                                        Reveal
                                    </button>
                                    <button
                                        type='button'
                                        onClick={() => setConfirmGiveUp(false)}
                                        className='cursor-pointer rounded-full bg-gray-200 px-3 py-1.5 dark:bg-zinc-800'
                                    >
                                        Cancel
                                    </button>
                                </div>
                            ) : (
                                <button
                                    type='button'
                                    onClick={() => setConfirmGiveUp(true)}
                                    className='cursor-pointer text-sm text-gray-500 underline dark:text-zinc-400'
                                >
                                    Give up
                                </button>
                            )}
                        </div>
                    )}
                    {finished && !resultOpen && (
                        <div className='mt-4 flex justify-center'>
                            <button
                                type='button'
                                onClick={() => setResultOpen(true)}
                                className='cursor-pointer rounded-full bg-black px-4 py-2 text-sm font-semibold text-white dark:bg-white dark:text-black'
                            >
                                Result
                            </button>
                        </div>
                    )}
                </>
            )}

            <ClassicWinModal
                open={!loading && finished && resultOpen}
                mode={mode}
                answer={game?.answer ?? null}
                guesses={game?.guesses ?? []}
                dailyId={game?.dailyId ?? null}
                countdown={countdown}
                onClose={() => setResultOpen(false)}
                onNext={() => void next()}
            />
            <ClassicModeModal
                open={modeOpen}
                active={mode}
                onClose={() => setModeOpen(false)}
                onDaily={() => {
                    setModeOpen(false)
                    if (mode !== 'daily') router.push('/classic/daily')
                }}
                onUnlimited={() => {
                    setModeOpen(false)
                    if (mode !== 'infinite') router.push('/classic')
                }}
            />
            {mode === 'infinite' && (
                <ClassicFilterModal
                    open={filterOpen}
                    value={game?.groupFilter ?? 'both'}
                    onClose={() => setFilterOpen(false)}
                    onChange={(group) => void changeGroup(group)}
                />
            )}
        </main>
    )
}
